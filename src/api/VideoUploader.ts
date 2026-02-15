/**
 * VideoUploader - 视频文件上传服务
 * 实现视频上传到 VOD（ByteDance 视频对象存储）
 *
 * 完整流程（基于 HAR 分析 + 实际调试验证）：
 *   1. get_upload_token(scene=1) -> 获取 VOD STS 凭证
 *   2. ApplyUploadInner(GET, AWS Sig V4) -> 获取 StoreUri, Auth, UploadHost, Vid, SessionKey
 *   3. 上传视频数据到 CDN（两种模式自动切换）：
 *      - 优先：分片上传（init → transfer × N → finish，无 Authorization 头）
 *      - 降级：直接上传（单次 POST，带 Authorization: Auth 头）
 *        注：部分服务器环境下 CDN 分片 init 返回 204，需降级为直接上传
 *   4. CommitUploadInner(POST, AWS Sig V4)
 *      - 使用 ApplyUploadInner 返回的**服务端 SessionKey**（非客户端构建）
 *
 * 关键发现（HAR 对比 + 调试）：
 *   - ApplyUploadInner 返回的 SessionKey 必须直接使用，客户端构建会导致 "invalid token"
 *   - CDN 分片上传不发送 Authorization 头（CDN 靠 StoreUri 路径鉴权）
 *   - 直接上传使用 ApplyUploadInner 返回的 Auth 作为 Authorization
 *   - CommitUploadInner 需要 AWS SigV4 Authorization 头
 */

import axios from 'axios';
// @ts-ignore
import crc32 from 'crc32';
import fs from 'fs';
import path from 'path';
import { HttpClient } from './HttpClient.js';
import { logger } from '../utils/logger.js';

export interface VideoUploadResult {
  vid: string;            // 视频ID
  uri: string;            // 存储路径
  width: number;
  height: number;
  duration: number;       // 毫秒
  format: string;
  size: number;
}

// ApplyUploadInner 返回的完整结果
interface ApplyUploadResult {
  storeUri: string;
  auth: string;
  uploadHost: string;
  vid: string;
  sessionKey: string;     // 服务端生成的 SessionKey（关键！）
  uploadId?: string;      // 服务端分配的 UploadID
}

// 分片大小: 5MB（与浏览器 SDK 一致）
const CHUNK_SIZE = 5 * 1024 * 1024;

// CDN 上传时必须携带的基础头
const CDN_BASE_HEADERS: Record<string, string> = {
  'Accept': '*/*',
  'Origin': 'https://jimeng.jianying.com',
  'Referer': 'https://jimeng.jianying.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

/**
 * VideoUploader类
 * 使用组合模式，依赖HttpClient
 */
export class VideoUploader {
  private cachedUserId: string | null = null;

  constructor(private httpClient: HttpClient) {}

  /**
   * 获取用户 UID（用于 CDN 上传的 X-Storage-U 头部）
   * 缓存结果避免重复请求
   */
  private async getUserId(): Promise<string> {
    if (this.cachedUserId) {
      return this.cachedUserId;
    }

    try {
      const res = await this.httpClient.request({
        method: 'POST',
        url: '/mweb/v1/get_user_info',
        params: { aid: "513695", device_platform: "web", region: "CN" },
        data: {},
        timeout: 10000,
      });
      const uid = res?.data?.uid;
      if (uid) {
        this.cachedUserId = uid;
        logger.info(`[VideoUploader] 获取用户ID: ${uid}`);
        return uid;
      }
    } catch (error) {
      logger.warn(`[VideoUploader] 获取用户ID失败: ${error}`);
    }

    // fallback: 使用随机数字ID
    this.cachedUserId = String(Math.floor(Math.random() * 9000000000000000) + 1000000000000000);
    logger.info(`[VideoUploader] 使用随机用户ID: ${this.cachedUserId}`);
    return this.cachedUserId;
  }

  /**
   * 上传视频文件
   */
  async upload(videoPath: string): Promise<VideoUploadResult> {
    const startTime = Date.now();
    logger.info(`[VideoUploader] ========== 开始上传视频: ${videoPath} ==========`);

    // 1. 读取视频文件
    const videoBuffer = await this.getFileContent(videoPath);
    const fileSize = videoBuffer.length;
    logger.info(`[VideoUploader] [步骤1/4] 读取视频文件完成: ${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(1)}MB)`);

    // 2. 获取上传凭证 (scene=1 -> VOD)
    let uploadAuth;
    try {
      uploadAuth = await this.getUploadToken();
      logger.info(`[VideoUploader] [步骤2/4] 获取上传凭证成功: space=${uploadAuth.space_name}, domain=${uploadAuth.upload_domain}`);
    } catch (error) {
      logger.error(`[VideoUploader] [步骤2/4] 获取上传凭证失败: ${error}`);
      throw error;
    }

    // 3. ApplyUploadInner -> 获取上传地址、Vid 和服务端 SessionKey
    let applyResult: ApplyUploadResult;
    try {
      applyResult = await this.applyUpload(uploadAuth, fileSize);
      logger.info(`[VideoUploader] [步骤3/4] ApplyUploadInner 成功: host=${applyResult.uploadHost}, vid=${applyResult.vid}`);
    } catch (error) {
      logger.error(`[VideoUploader] [步骤3/4] ApplyUploadInner 失败: ${error}`);
      throw error;
    }

    // 4. 上传视频数据到 CDN
    //    优先尝试分片上传，失败时降级为直接上传（带 Auth）
    try {
      await this.uploadVideoData(videoBuffer, applyResult);
      logger.info(`[VideoUploader] [步骤4/5] 视频数据上传完成`);
    } catch (error) {
      logger.error(`[VideoUploader] [步骤4/5] 视频数据上传失败: ${error}`);
      throw error;
    }

    // 5. CommitUploadInner -> 确认上传，获取 VideoMeta
    //    使用 ApplyUploadInner 返回的服务端 SessionKey
    let commitResult;
    try {
      commitResult = await this.commitUpload(uploadAuth, applyResult.sessionKey);
      logger.info(`[VideoUploader] [步骤5/5] CommitUploadInner 成功: vid=${commitResult.vid}, ${commitResult.width}x${commitResult.height}, ${commitResult.duration}s`);
    } catch (error) {
      logger.error(`[VideoUploader] [步骤5/5] CommitUploadInner 失败: ${error}`);
      throw error;
    }

    const elapsed = Date.now() - startTime;
    logger.info(`[VideoUploader] ========== 视频上传完成，耗时 ${(elapsed / 1000).toFixed(1)}s ==========`);

    return {
      vid: commitResult.vid,
      uri: commitResult.uri,
      width: commitResult.width,
      height: commitResult.height,
      duration: Math.round(commitResult.duration * 1000), // 秒转毫秒
      format: commitResult.format,
      size: fileSize,
    };
  }

  /**
   * 获取 VOD 上传凭证 (scene=1)
   */
  private async getUploadToken(): Promise<any> {
    const uploadParams = {
      aid: "513695",
      device_platform: "web",
      region: "CN",
      web_id: Date.now().toString(),
    };

    const authRes = await this.httpClient.request({
      method: 'POST',
      url: '/mweb/v1/get_upload_token',
      params: uploadParams,
      data: { scene: 1 },
      timeout: 30000
    });

    if (!authRes.data) {
      throw new Error(authRes.errmsg ?? '获取视频上传凭证失败');
    }

    logger.debug(`[VideoUploader] 上传凭证: space=${authRes.data.space_name}, domain=${authRes.data.upload_domain}`);
    return authRes.data;
  }

  /**
   * ApplyUploadInner - 申请上传地址
   * 使用 AWS SigV4 Authorization + x-amz-* 头
   * 返回包含服务端生成 SessionKey 的完整结果
   */
  private async applyUpload(uploadAuth: any, fileSize: number): Promise<ApplyUploadResult> {
    const params: Record<string, any> = {
      Action: 'ApplyUploadInner',
      Version: '2020-11-19',
      SpaceName: uploadAuth.space_name,
      FileType: 'video',
      IsInner: 1,
      FileSize: fileSize,
      s: this.generateRandomString(11),
    };

    const headers = await this.httpClient.generateAuthorizationAndHeader(
      uploadAuth.access_key_id,
      uploadAuth.secret_access_key,
      uploadAuth.session_token,
      'cn-north-1',
      'vod',
      'GET',
      params
    );

    const queryString = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const response = await this.httpClient.request({
      method: 'GET',
      url: `https://${uploadAuth.upload_domain}/?${queryString}`,
      headers
    });

    const uploadNode = response?.Result?.InnerUploadAddress?.UploadNodes?.[0];
    if (!uploadNode) {
      throw new Error('ApplyUploadInner 未返回上传节点');
    }

    const storeInfo = uploadNode.StoreInfos?.[0];
    if (!storeInfo) {
      throw new Error('ApplyUploadInner 未返回存储信息');
    }

    if (!uploadNode.SessionKey) {
      throw new Error('ApplyUploadInner 未返回 SessionKey');
    }

    logger.debug(`[VideoUploader] ApplyUpload: host=${uploadNode.UploadHost}, vid=${uploadNode.Vid}, sessionKey长度=${uploadNode.SessionKey.length}`);

    return {
      storeUri: storeInfo.StoreUri,
      auth: storeInfo.Auth,
      uploadHost: uploadNode.UploadHost,
      vid: uploadNode.Vid,
      sessionKey: uploadNode.SessionKey,
      uploadId: storeInfo.UploadID,
    };
  }

  /**
   * 上传视频数据到 CDN
   * 优先分片上传，失败时降级为直接上传
   */
  private async uploadVideoData(
    videoBuffer: Buffer,
    applyResult: ApplyUploadResult
  ): Promise<void> {
    // 优先尝试分片上传（浏览器标准模式）
    try {
      await this.uploadChunked(videoBuffer, applyResult);
      return; // 分片上传成功
    } catch (chunkedError) {
      logger.warn(`[VideoUploader] 分片上传失败，降级为直接上传: ${chunkedError}`);
    }

    // 降级：直接上传（带 Auth，适用于 CDN 边缘层限制的环境）
    await this.uploadDirect(videoBuffer, applyResult);
  }

  /**
   * 分片上传视频数据到 CDN（浏览器标准模式）
   * CDN 上传阶段不发送 Authorization 头，靠 StoreUri 路径鉴权
   */
  private async uploadChunked(
    videoBuffer: Buffer,
    applyResult: ApplyUploadResult
  ): Promise<void> {
    const totalChunks = Math.ceil(videoBuffer.length / CHUNK_SIZE);
    const baseUrl = `https://${applyResult.uploadHost}/upload/v1/${applyResult.storeUri}`;

    const userId = await this.getUserId();
    const cdnHeaders = {
      ...CDN_BASE_HEADERS,
      'X-Storage-U': userId,
    };

    // Step 1: Init
    const boundary = `WebKitFormBoundary${this.generateRandomString(16)}`;
    const initUrl = `${baseUrl}?uploadmode=part&phase=init`;

    logger.info(`[VideoUploader] [分片] 初始化: ${totalChunks} 片, X-Storage-U=${userId}`);

    const initResp = await axios.post(
      initUrl,
      `------${boundary}--\r\n`,
      {
        headers: {
          ...cdnHeaders,
          'Content-Type': `multipart/form-data; boundary=----${boundary}`,
        },
        validateStatus: () => true,
      }
    );

    const uploadId = initResp.data?.data?.uploadid;
    if (!uploadId) {
      throw new Error(`分片初始化失败: status=${initResp.status}`);
    }

    logger.info(`[VideoUploader] [分片] uploadid=${uploadId}`);

    // Step 2: Transfer
    const partHashes: string[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, videoBuffer.length);
      const chunk = videoBuffer.subarray(start, end);
      const partNumber = i + 1;
      const partUrl = `${baseUrl}?uploadid=${uploadId}&part_number=${partNumber}&phase=transfer`;

      const partResp = await axios.post(partUrl, chunk, {
        headers: {
          ...cdnHeaders,
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': 'attachment; filename="undefined"',
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      if (partResp.data?.code !== 2000) {
        throw new Error(`分片 ${partNumber} 失败: ${JSON.stringify(partResp.data).substring(0, 200)}`);
      }

      const crc32Val = partResp.data?.data?.crc32 || '';
      partHashes.push(`${partNumber}:${crc32Val}`);
      logger.info(`[VideoUploader] [分片] ${partNumber}/${totalChunks} 成功`);
    }

    // Step 3: Finish
    const finishUrl = `${baseUrl}?uploadmode=part&phase=finish&uploadid=${uploadId}`;
    const finishResp = await axios.post(finishUrl, partHashes.join(','), {
      headers: { ...cdnHeaders, 'Content-Type': 'text/plain;charset=UTF-8' },
    });

    if (finishResp.data?.code !== 2000) {
      throw new Error(`分片完成确认失败: ${JSON.stringify(finishResp.data).substring(0, 200)}`);
    }

    logger.info(`[VideoUploader] [分片] 全部完成: ${totalChunks} 片`);
  }

  /**
   * 直接上传视频数据到 CDN（降级模式）
   * 使用 ApplyUploadInner 返回的 Auth 作为 Authorization
   * 适用于 CDN 边缘层对无 Authorization 请求返回 204 的环境
   */
  private async uploadDirect(
    videoBuffer: Buffer,
    applyResult: ApplyUploadResult
  ): Promise<void> {
    const uploadUrl = `https://${applyResult.uploadHost}/upload/v1/${applyResult.storeUri}`;
    const videoCrc32 = crc32(videoBuffer).toString(16);

    logger.info(`[VideoUploader] [直接上传] URL: ${uploadUrl}, size=${videoBuffer.length}, crc32=${videoCrc32}`);

    const resp = await axios.post(uploadUrl, videoBuffer, {
      headers: {
        ...CDN_BASE_HEADERS,
        'Authorization': applyResult.auth,
        'Content-CRC32': videoCrc32,
        'Content-Disposition': 'attachment; filename="undefined"',
        'Content-Type': 'application/octet-stream',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: () => true,
    });

    if (resp.status !== 200 || resp.data?.code !== 2000) {
      throw new Error(`直接上传失败: status=${resp.status}, body=${JSON.stringify(resp.data).substring(0, 300)}`);
    }

    logger.info(`[VideoUploader] [直接上传] 成功: crc32=${resp.data?.data?.crc32}`);
  }

  /**
   * CommitUploadInner - 确认上传
   * 使用 AWS SigV4 Authorization + x-amz-* 头
   * SessionKey 使用 ApplyUploadInner 返回的服务端生成版本
   */
  private async commitUpload(uploadAuth: any, sessionKey: string): Promise<{
    vid: string;
    uri: string;
    width: number;
    height: number;
    duration: number;  // 秒
    format: string;
  }> {
    const params: Record<string, any> = {
      Action: 'CommitUploadInner',
      Version: '2020-11-19',
      SpaceName: uploadAuth.space_name,
    };

    const bodyData = {
      SessionKey: sessionKey,
      Functions: [],
    };

    const headers = await this.httpClient.generateAuthorizationAndHeader(
      uploadAuth.access_key_id,
      uploadAuth.secret_access_key,
      uploadAuth.session_token,
      'cn-north-1',
      'vod',
      'POST',
      params,
      bodyData
    );
    headers['Content-Type'] = 'text/plain;charset=UTF-8';

    const queryString = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const commitUrl = `https://${uploadAuth.upload_domain}/?${queryString}`;
    logger.debug(`[VideoUploader] CommitUploadInner: ${commitUrl}`);

    const response = await this.httpClient.request({
      method: 'POST',
      url: commitUrl,
      data: bodyData,
      headers
    });

    const result = response?.Result?.Results?.[0];
    if (!result) {
      const errMsg = response?.ResponseMetadata?.Error?.Message
        || response?.ResponseMetadata?.Error?.Code
        || JSON.stringify(response).substring(0, 500);
      logger.error(`[VideoUploader] CommitUploadInner 失败: ${JSON.stringify(response).substring(0, 1000)}`);
      throw new Error(`CommitUploadInner 未返回结果: ${errMsg}`);
    }

    const meta = result.VideoMeta || {};
    return {
      vid: result.Vid,
      uri: meta.Uri || '',
      width: meta.Width || meta.OriginWidth || 0,
      height: meta.Height || meta.OriginHeight || 0,
      duration: meta.Duration || 0,
      format: meta.Format || 'MP4',
    };
  }

  /**
   * 读取视频文件内容
   */
  private async getFileContent(filePath: string): Promise<Buffer> {
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      const res = await axios.get(filePath, { responseType: 'arraybuffer' });
      return Buffer.from(res.data);
    }

    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`视频文件不存在: ${absolutePath}`);
    }

    const stats = await fs.promises.stat(absolutePath);
    if (!stats.isFile()) {
      throw new Error(`路径不是文件: ${absolutePath}`);
    }

    return await fs.promises.readFile(absolutePath);
  }

  /**
   * 生成随机字符串
   */
  private generateRandomString(length: number): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
