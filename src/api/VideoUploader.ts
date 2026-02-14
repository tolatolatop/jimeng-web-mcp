/**
 * VideoUploader - 视频文件上传服务
 * 实现视频上传到 VOD（ByteDance 视频对象存储）
 * 流程：get_upload_token(scene=1) → ApplyUploadInner → 分片上传 → CommitUploadInner
 */

import axios from 'axios';
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

// 分片大小: 2MB
const CHUNK_SIZE = 2 * 1024 * 1024;

/**
 * VideoUploader类
 * 使用组合模式，依赖HttpClient
 */
export class VideoUploader {
  constructor(private httpClient: HttpClient) {}

  /**
   * 上传视频文件
   */
  async upload(videoPath: string): Promise<VideoUploadResult> {
    // 1. 读取视频文件
    const videoBuffer = await this.getFileContent(videoPath);
    const fileSize = videoBuffer.length;
    logger.debug(`[VideoUploader] 视频文件大小: ${fileSize} bytes`);

    // 2. 获取上传凭证 (scene=1 → VOD)
    const uploadAuth = await this.getUploadToken();

    // 3. ApplyUploadInner → 获取上传地址和 Vid
    const applyResult = await this.applyUpload(uploadAuth, fileSize);
    const { storeUri, auth, uploadHost, vid, sessionKey } = applyResult;

    // 4. 分片上传视频数据
    await this.uploadChunks(videoBuffer, storeUri, auth, uploadHost);

    // 5. CommitUploadInner → 确认上传，获取 VideoMeta
    const commitResult = await this.commitUpload(uploadAuth, sessionKey);

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
      data: { scene: 1 },  // scene=1 → VOD (视频)
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
   */
  private async applyUpload(uploadAuth: any, fileSize: number): Promise<{
    storeUri: string;
    auth: string;
    uploadHost: string;
    vid: string;
    sessionKey: string;
  }> {
    const params: Record<string, any> = {
      Action: 'ApplyUploadInner',
      Version: '2020-11-19',
      SpaceName: uploadAuth.space_name,  // "dreamina"
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

    return {
      storeUri: storeInfo.StoreUri,
      auth: storeInfo.Auth,
      uploadHost: uploadNode.UploadHost,
      vid: uploadNode.Vid,
      sessionKey: storeInfo.UploadID || response?.Result?.InnerUploadAddress?.SessionKey || '',
    };
  }

  /**
   * 分片上传视频数据
   */
  private async uploadChunks(
    videoBuffer: Buffer,
    storeUri: string,
    auth: string,
    uploadHost: string
  ): Promise<void> {
    const totalChunks = Math.ceil(videoBuffer.length / CHUNK_SIZE);
    const baseUrl = `https://${uploadHost}/upload/v1/${storeUri}`;

    if (totalChunks === 1) {
      // 小文件直接上传
      await this.uploadSingleFile(baseUrl, videoBuffer, auth);
      return;
    }

    // 分片上传：init → upload parts → finish
    // Step 1: Init
    const initUrl = `${baseUrl}?uploadmode=part&phase=init`;
    const initResp = await axios.post(initUrl, null, {
      headers: { Authorization: auth, 'Content-Type': 'application/octet-stream' }
    });
    const uploadId = initResp.data?.data?.uploadid;
    if (!uploadId) {
      throw new Error('分片上传初始化失败：未返回uploadid');
    }

    // Step 2: Upload parts
    const partHashes: string[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, videoBuffer.length);
      const chunk = videoBuffer.subarray(start, end);
      const partNumber = i + 1;

      const partUrl = `${baseUrl}?uploadmode=part&phase=transfer&uploadid=${uploadId}&part_number=${partNumber}`;
      const partResp = await axios.post(partUrl, chunk, {
        headers: { Authorization: auth, 'Content-Type': 'application/octet-stream' },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      const partHash = partResp.data?.data?.hash || partResp.data?.data?.crc32 || '';
      partHashes.push(`${partNumber}:${partHash}`);
      logger.debug(`[VideoUploader] 上传分片 ${partNumber}/${totalChunks}`);
    }

    // Step 3: Finish
    const finishUrl = `${baseUrl}?uploadmode=part&phase=finish&uploadid=${uploadId}`;
    await axios.post(finishUrl, partHashes.join(','), {
      headers: { Authorization: auth, 'Content-Type': 'text/plain' }
    });

    logger.debug(`[VideoUploader] 分片上传完成: ${totalChunks} 片`);
  }

  /**
   * 单文件直接上传（小文件）
   */
  private async uploadSingleFile(baseUrl: string, data: Buffer, auth: string): Promise<void> {
    await axios.post(baseUrl, data, {
      headers: {
        Authorization: auth,
        'Content-Type': 'application/octet-stream',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    logger.debug('[VideoUploader] 单文件上传完成');
  }

  /**
   * CommitUploadInner - 确认上传
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

    const queryString = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const response = await this.httpClient.request({
      method: 'POST',
      url: `https://${uploadAuth.upload_domain}/?${queryString}`,
      data: bodyData,
      headers
    });

    const result = response?.Result?.Results?.[0];
    if (!result) {
      throw new Error('CommitUploadInner 未返回结果');
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
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
