#!/usr/bin/env npx tsx
/**
 * Seedance 2.0 独立测试脚本
 * 直接调用 VideoUploader 和 VideoService 来观察日志
 */
import 'dotenv/config';

// 启用 DEBUG 日志
process.env.DEBUG = 'true';

import { HttpClient } from './src/api/HttpClient.js';
import { ImageUploader } from './src/api/ImageUploader.js';
import { VideoUploader } from './src/api/VideoUploader.js';
import { VideoService } from './src/api/VideoService.js';

const IMAGE_PATH = '/home/vagrant/videos_workspace/origin_first.png';
const VIDEO_PATH = '/home/vagrant/videos_workspace/ref.mp4';

async function testGetUploadToken() {
  console.log('\n===== 测试0: 检查上传凭证响应内容 =====\n');
  const httpClient = new HttpClient();

  // 检查 scene=1 (VOD) 上传凭证
  const vodRes = await httpClient.request({
    method: 'POST',
    url: '/mweb/v1/get_upload_token',
    params: { aid: "513695", device_platform: "web", region: "CN", web_id: Date.now().toString() },
    data: { scene: 1 },
    timeout: 30000
  });
  console.log('VOD 上传凭证(scene=1) 完整响应:', JSON.stringify(vodRes, null, 2));

  // 检查用户信息 API
  try {
    const userRes = await httpClient.request({
      method: 'POST',
      url: '/mweb/v1/get_user_info',
      params: { aid: "513695", device_platform: "web", region: "CN" },
      data: {},
    });
    console.log('用户信息:', JSON.stringify(userRes, null, 2));
  } catch (e) {
    console.log('获取用户信息失败:', e);
  }
}

async function testVideoUploadOnly() {
  console.log('\n===== 测试1: 单独测试视频上传 =====\n');
  const httpClient = new HttpClient();
  const videoUploader = new VideoUploader(httpClient);

  try {
    const result = await videoUploader.upload(VIDEO_PATH);
    console.log('\n✅ 视频上传成功:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('\n❌ 视频上传失败:', error);
  }
}

async function testImageUploadOnly() {
  console.log('\n===== 测试2: 单独测试图片上传 =====\n');
  const httpClient = new HttpClient();
  const imageUploader = new ImageUploader(httpClient);

  try {
    const result = await imageUploader.upload(IMAGE_PATH);
    console.log('\n✅ 图片上传成功:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('\n❌ 图片上传失败:', error);
  }
}

async function testSeedanceGeneration() {
  console.log('\n===== 测试3: Seedance 2.0 完整流程 =====\n');
  const httpClient = new HttpClient();
  const imageUploader = new ImageUploader(httpClient);
  const videoService = new VideoService(httpClient, imageUploader);

  try {
    const result = await videoService.generateSeedance({
      prompt: '银白色长发红眼二次元少女跟随视频中的舞蹈动作起舞',
      materials: [
        { type: 'image', filePath: IMAGE_PATH },
        { type: 'video', filePath: VIDEO_PATH },
      ],
      model: 'seedance-2.0',
      videoAspectRatio: '9:16',
      resolution: '720p',
      duration: 5000,
      async: true,
    });
    console.log('\n✅ Seedance 任务提交成功:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('\n❌ Seedance 生成失败:', error);
  }
}

async function testStandardUploadPath() {
  console.log('\n===== 测试: 标准VOD上传路径 (ApplyUpload → 直接上传 → CommitUpload) =====\n');
  const httpClient = new HttpClient();
  const fs = await import('fs');
  const crc32Module = await import('crc32');
  const crc32 = crc32Module.default;
  const axios = (await import('axios')).default;

  // 获取上传凭证
  const authRes = await httpClient.request({
    method: 'POST', url: '/mweb/v1/get_upload_token',
    params: { aid: "513695", device_platform: "web", region: "CN", web_id: Date.now().toString() },
    data: { scene: 1 }, timeout: 30000
  });
  const uploadAuth = authRes.data;
  console.log(`凭证: space=${uploadAuth.space_name}`);

  const videoBuffer = await fs.promises.readFile(VIDEO_PATH);
  const videoCrc32 = crc32(videoBuffer).toString(16);

  // 1. ApplyUpload (非Inner, version=2020-08-01)
  const applyParams: Record<string, any> = {
    Action: 'ApplyUpload',
    Version: '2020-08-01',
    SpaceName: uploadAuth.space_name,
    FileType: 'video',
    FileSize: videoBuffer.length,
    s: String(Date.now()).slice(-11),
  };
  // @ts-ignore
  const applyHeaders = await httpClient.generateAuthorizationAndHeader(
    uploadAuth.access_key_id, uploadAuth.secret_access_key, uploadAuth.session_token,
    'cn-north-1', 'vod', 'GET', applyParams
  );
  const applyQS = Object.entries(applyParams).map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  
  console.log('1. ApplyUpload (version=2020-08-01)...');
  const applyResp = await httpClient.request({
    method: 'GET',
    url: `https://${uploadAuth.upload_domain}/?${applyQS}`,
    headers: applyHeaders,
  });
  console.log('ApplyUpload 响应:', JSON.stringify(applyResp).substring(0, 800));

  const uploadNode = applyResp?.Result?.UploadAddress;
  if (!uploadNode) {
    console.error('❌ ApplyUpload 未返回 UploadAddress');
    return;
  }

  const storeInfo = uploadNode.StoreInfos?.[0];
  const uploadHost = uploadNode.UploadHosts?.[0];
  const sessionKey = uploadNode.SessionKey;
  console.log(`\nstoreUri: ${storeInfo?.StoreUri}`);
  console.log(`uploadHost: ${uploadHost}`);
  console.log(`sessionKey: ${sessionKey?.substring(0, 80)}...`);
  console.log(`auth: ${storeInfo?.Auth?.substring(0, 60)}...`);

  // 2. 上传视频数据
  const uploadUrl = `https://${uploadHost}/upload/v1/${storeInfo.StoreUri}`;
  console.log(`\n2. 上传视频到: ${uploadUrl}`);

  const uploadResp = await axios.post(uploadUrl, videoBuffer, {
    headers: {
      'Authorization': storeInfo.Auth,
      'Content-CRC32': videoCrc32,
      'Content-Type': 'application/octet-stream',
      'Origin': 'https://jimeng.jianying.com',
      'Referer': 'https://jimeng.jianying.com/',
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: () => true,
  });
  console.log(`上传响应: status=${uploadResp.status}, body=${JSON.stringify(uploadResp.data).substring(0, 300)}`);

  if (uploadResp.status !== 200) {
    console.error('❌ 上传失败');
    return;
  }
  console.log('✅ 上传成功');

  // 3. CommitUpload (非Inner, version=2020-08-01)
  console.log('\n3. CommitUpload (version=2020-08-01)...');
  const commitParams: Record<string, any> = {
    Action: 'CommitUpload',
    Version: '2020-08-01',
    SpaceName: uploadAuth.space_name,
  };
  const commitBody = {
    SessionKey: sessionKey,
    Functions: [],
  };
  // @ts-ignore
  const commitHeaders = await httpClient.generateAuthorizationAndHeader(
    uploadAuth.access_key_id, uploadAuth.secret_access_key, uploadAuth.session_token,
    'cn-north-1', 'vod', 'POST', commitParams, commitBody
  );
  commitHeaders['Content-Type'] = 'text/plain;charset=UTF-8';
  const commitQS = Object.entries(commitParams).map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

  try {
    const commitResp = await httpClient.request({
      method: 'POST',
      url: `https://${uploadAuth.upload_domain}/?${commitQS}`,
      data: commitBody,
      headers: commitHeaders,
    });
    console.log('✅ CommitUpload 响应:', JSON.stringify(commitResp).substring(0, 600));
  } catch (e: any) {
    console.error('❌ CommitUpload 失败:', e.message);
  }
}

async function testDirectUploadV2() {
  console.log('\n===== 测试: 直接上传V2（不带Auth头 + X-Storage-U） =====\n');
  const httpClient = new HttpClient();
  const fs = await import('fs');
  const crc32Module = await import('crc32');
  const crc32 = crc32Module.default;
  const axios = (await import('axios')).default;

  // 1. 获取用户ID
  const userRes = await httpClient.request({
    method: 'POST', url: '/mweb/v1/get_user_info',
    params: { aid: "513695", device_platform: "web", region: "CN" }, data: {},
  });
  const userId = userRes.data.uid;
  console.log(`用户ID: ${userId}`);

  // 2. 获取上传凭证
  const authRes = await httpClient.request({
    method: 'POST', url: '/mweb/v1/get_upload_token',
    params: { aid: "513695", device_platform: "web", region: "CN", web_id: Date.now().toString() },
    data: { scene: 1 }, timeout: 30000
  });
  const uploadAuth = authRes.data;
  console.log(`凭证: space=${uploadAuth.space_name}, domain=${uploadAuth.upload_domain}`);

  // 3. ApplyUploadInner
  const VideoUploader_import = (await import('./src/api/VideoUploader.js')).VideoUploader;
  const vu = new VideoUploader_import(httpClient);
  const videoBuffer = await fs.promises.readFile(VIDEO_PATH);
  // @ts-ignore
  const applyResult = await vu['applyUpload'](uploadAuth, videoBuffer.length);
  console.log(`Apply: host=${applyResult.uploadHost}, storeUri=${applyResult.storeUri}, vid=${applyResult.vid}`);

  // 4. 尝试方案A: 不带Auth的直接上传（使用路径鉴权+X-Storage-U）
  const uploadUrl = `https://${applyResult.uploadHost}/upload/v1/${applyResult.storeUri}`;
  const videoCrc32 = crc32(videoBuffer).toString(16);

  console.log(`\n方案A: 不带Authorization直接上传 (X-Storage-U=${userId})`);
  try {
    const resp = await axios.post(uploadUrl, videoBuffer, {
      headers: {
        'Origin': 'https://jimeng.jianying.com',
        'Referer': 'https://jimeng.jianying.com/',
        'X-Storage-U': userId,
        'Content-CRC32': videoCrc32,
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="undefined"',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: () => true,
    });
    console.log(`响应: status=${resp.status}, body=${JSON.stringify(resp.data).substring(0, 300)}`);

    if (resp.status === 200 && resp.data?.code === 2000) {
      console.log('✅ 方案A上传成功！');
      
      // 尝试 CommitUploadInner
      // @ts-ignore
      const sessionKey = vu['buildSessionKey'](applyResult, videoBuffer.length);
      try {
        // @ts-ignore
        const commitResult = await vu['commitUpload'](uploadAuth, sessionKey);
        console.log('✅ CommitUploadInner 成功:', JSON.stringify(commitResult, null, 2));
      } catch (e: any) {
        console.log('❌ CommitUploadInner 失败:', e.message);
      }
    }
  } catch (e: any) {
    console.log(`❌ 方案A失败: ${e.message}`);
  }

  // 5. 尝试方案B: 带Auth的直接上传 + 用简化SessionKey commit
  console.log(`\n方案B: 带Authorization直接上传 + 简化commit`);

  // 重新申请（避免token复用问题）
  // @ts-ignore
  const applyResult2 = await vu['applyUpload'](uploadAuth, videoBuffer.length);
  const uploadUrl2 = `https://${applyResult2.uploadHost}/upload/v1/${applyResult2.storeUri}`;

  try {
    const resp2 = await axios.post(uploadUrl2, videoBuffer, {
      headers: {
        'Authorization': applyResult2.auth,
        'Content-CRC32': videoCrc32,
        'Content-Type': 'application/octet-stream',
        'Origin': 'https://jimeng.jianying.com',
        'Referer': 'https://jimeng.jianying.com/',
        'X-Storage-U': userId,
        'Content-Disposition': 'attachment; filename="undefined"',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: () => true,
    });
    console.log(`响应: status=${resp2.status}, body=${JSON.stringify(resp2.data).substring(0, 300)}`);

    if (resp2.status === 200) {
      console.log('✅ 方案B上传成功！');
      
      // 使用 CommitUpload (非Inner) 试试
      const commitParams = {
        Action: 'CommitUpload',
        Version: '2020-11-19',
        SpaceName: uploadAuth.space_name,
      };
      const commitBody = {
        SessionKey: Buffer.from(JSON.stringify({
          accountType: "space",
          fileType: "video",
          uri: applyResult2.storeUri,
          vid: applyResult2.vid,
        })).toString('base64'),
        Functions: [],
      };
      // @ts-ignore
      const commitHeaders = await httpClient.generateAuthorizationAndHeader(
        uploadAuth.access_key_id, uploadAuth.secret_access_key, uploadAuth.session_token,
        'cn-north-1', 'vod', 'POST', commitParams, commitBody
      );
      commitHeaders['Content-Type'] = 'text/plain;charset=UTF-8';

      const commitQueryString = Object.entries(commitParams)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

      try {
        const commitResp = await httpClient.request({
          method: 'POST',
          url: `https://${uploadAuth.upload_domain}/?${commitQueryString}`,
          data: commitBody,
          headers: commitHeaders,
        });
        console.log('CommitUpload (非Inner) 响应:', JSON.stringify(commitResp).substring(0, 500));
      } catch (e: any) {
        console.log('CommitUpload (非Inner) 失败:', e.message);
      }
    }
  } catch (e: any) {
    console.log(`❌ 方案B失败: ${e.message}`);
  }
}

async function testDirectUpload() {
  console.log('\n===== 测试: 直接上传视频（非分片模式） =====\n');
  const httpClient = new HttpClient();
  const fs = await import('fs');
  const crc32Module = await import('crc32');
  const crc32 = crc32Module.default;

  // 1. 获取上传凭证
  const authRes = await httpClient.request({
    method: 'POST', url: '/mweb/v1/get_upload_token',
    params: { aid: "513695", device_platform: "web", region: "CN", web_id: Date.now().toString() },
    data: { scene: 1 }, timeout: 30000
  });
  const uploadAuth = authRes.data;
  console.log(`凭证: space=${uploadAuth.space_name}, domain=${uploadAuth.upload_domain}`);

  // 2. ApplyUploadInner
  const VideoUploader_import = (await import('./src/api/VideoUploader.js')).VideoUploader;
  const vu = new VideoUploader_import(httpClient);
  const videoBuffer = await fs.promises.readFile(VIDEO_PATH);
  // @ts-ignore
  const applyResult = await vu['applyUpload'](uploadAuth, videoBuffer.length);
  console.log(`Apply结果: host=${applyResult.uploadHost}, storeUri=${applyResult.storeUri}, vid=${applyResult.vid}, auth=${applyResult.auth.substring(0, 50)}...`);

  // 3. 直接上传（类似图片上传模式：Authorization + CRC32 + octet-stream）
  const uploadUrl = `https://${applyResult.uploadHost}/upload/v1/${applyResult.storeUri}`;
  const videoCrc32 = crc32(videoBuffer).toString(16);
  console.log(`\n直接上传 URL: ${uploadUrl}`);
  console.log(`CRC32: ${videoCrc32}, Size: ${videoBuffer.length}`);

  try {
    const axios = (await import('axios')).default;
    const uploadResp = await axios.post(uploadUrl, videoBuffer, {
      headers: {
        'Authorization': applyResult.auth,
        'Content-CRC32': videoCrc32,
        'Content-Type': 'application/octet-stream',
        'Origin': 'https://jimeng.jianying.com',
        'Referer': 'https://jimeng.jianying.com/',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: () => true,
    });
    console.log(`\n直接上传响应: status=${uploadResp.status}`);
    console.log(`body: ${JSON.stringify(uploadResp.data).substring(0, 500)}`);

    if (uploadResp.status === 200 && uploadResp.data?.code === 2000) {
      console.log('\n✅ 直接上传成功！尝试 CommitUploadInner...');

      // 4. CommitUploadInner
      // @ts-ignore
      const sessionKey = vu['buildSessionKey'](applyResult, videoBuffer.length);
      // @ts-ignore
      const commitResult = await vu['commitUpload'](uploadAuth, sessionKey);
      console.log('✅ Commit 成功:', JSON.stringify(commitResult, null, 2));
    }
  } catch (error: any) {
    console.error(`\n❌ 直接上传失败: ${error.message}`);
    if (error.response) {
      console.error(`status=${error.response.status}, data=${JSON.stringify(error.response.data).substring(0, 500)}`);
    }
  }
}

async function testCdnInit() {
  console.log('\n===== 测试: CDN init 直接对比 =====\n');
  const httpClient = new HttpClient();

  // 1. 获取上传凭证
  const authRes = await httpClient.request({
    method: 'POST', url: '/mweb/v1/get_upload_token',
    params: { aid: "513695", device_platform: "web", region: "CN", web_id: Date.now().toString() },
    data: { scene: 1 }, timeout: 30000
  });
  const uploadAuth = authRes.data;
  console.log(`凭证: space=${uploadAuth.space_name}, domain=${uploadAuth.upload_domain}`);

  // 2. ApplyUploadInner
  const VideoUploader_import = (await import('./src/api/VideoUploader.js')).VideoUploader;
  const vu = new VideoUploader_import(httpClient);
  // @ts-ignore - access private method for testing
  const applyResult = await vu['applyUpload'](uploadAuth, 5402894);
  console.log(`Apply结果: host=${applyResult.uploadHost}, storeUri=${applyResult.storeUri}, vid=${applyResult.vid}`);

  const baseUrl = `https://${applyResult.uploadHost}/upload/v1/${applyResult.storeUri}`;
  const initUrl = `${baseUrl}?uploadmode=part&phase=init`;

  // 3. 用 child_process 调用 curl 做对比
  const { execSync } = await import('child_process');

  // 用户 ID
  const userRes = await httpClient.request({
    method: 'POST', url: '/mweb/v1/get_user_info',
    params: { aid: "513695", device_platform: "web", region: "CN" }, data: {},
  });
  const userId = userRes.data.uid;
  console.log(`用户ID: ${userId}`);

  const boundary = 'WebKitFormBoundaryTEST1234567890AB';
  const bodyContent = `------${boundary}--\r\n`;

  console.log(`\nInit URL: ${initUrl}`);
  console.log(`Body: "${bodyContent}" (${bodyContent.length} bytes)`);

  // curl 请求
  const curlCmd = `curl -v -s -X POST "${initUrl}" \
    -H "Content-Type: multipart/form-data; boundary=----${boundary}" \
    -H "Origin: https://jimeng.jianying.com" \
    -H "Referer: https://jimeng.jianying.com/" \
    -H "X-Storage-U: ${userId}" \
    -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" \
    -d '${bodyContent}' 2>&1`;

  console.log(`\n执行 curl:\n${curlCmd}\n`);
  const curlResult = execSync(curlCmd, { encoding: 'utf-8', timeout: 30000 });
  console.log(`curl 结果:\n${curlResult}`);
}

async function testApplyWithRawAxios() {
  console.log('\n===== 测试: 直接用 axios 调 ApplyUploadInner（对比 httpClient） =====\n');
  const httpClient = new HttpClient();
  const axios = (await import('axios')).default;

  // 获取上传凭证
  const authRes = await httpClient.request({
    method: 'POST', url: '/mweb/v1/get_upload_token',
    params: { aid: "513695", device_platform: "web", region: "CN", web_id: Date.now().toString() },
    data: { scene: 1 }, timeout: 30000
  });
  const uploadAuth = authRes.data;
  console.log(`凭证: space=${uploadAuth.space_name}, domain=${uploadAuth.upload_domain}`);
  console.log(`session_token 前40字符: ${uploadAuth.session_token.substring(0, 40)}...`);
  console.log(`session_token 长度: ${uploadAuth.session_token.length}`);

  const params: Record<string, any> = {
    Action: 'ApplyUploadInner',
    Version: '2020-11-19',
    SpaceName: uploadAuth.space_name,
    FileType: 'video',
    IsInner: 1,
    FileSize: 5402894,
    s: 'test12345ab',
  };
  const queryString = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';

  const url = `https://${uploadAuth.upload_domain}/?${queryString}`;
  console.log(`\nURL: ${url}`);

  // 方案1: 直接用 axios，只传 x-amz-* 头
  console.log('\n--- 方案1: 纯 axios (只传 x-amz-date + x-amz-security-token) ---');
  try {
    const resp1 = await axios.get(url, {
      headers: {
        'x-amz-date': timestamp,
        'x-amz-security-token': uploadAuth.session_token,
      },
      validateStatus: () => true,
    });
    console.log(`status=${resp1.status}`);
    console.log(`body: ${JSON.stringify(resp1.data).substring(0, 500)}`);
  } catch (e: any) {
    console.log(`请求失败: ${e.message}`);
  }

  // 方案2: 通过 httpClient.request()
  console.log('\n--- 方案2: 通过 httpClient.request() ---');
  try {
    const resp2 = await httpClient.request({
      method: 'GET',
      url: url,
      headers: {
        'X-Amz-Date': timestamp,
        'X-Amz-Security-Token': uploadAuth.session_token,
      },
    });
    console.log(`成功: ${JSON.stringify(resp2).substring(0, 500)}`);
  } catch (e: any) {
    console.log(`失败: ${e.message}`);
  }
}

async function testDirectUploadWithFixedCommit() {
  console.log('\n===== 测试: 直接上传 + 修复后的 CommitUploadInner（无Authorization） =====\n');
  const httpClient = new HttpClient();
  const axios = (await import('axios')).default;
  const crypto = (await import('crypto')).default;
  const fs = await import('fs');
  const crc32Module = await import('crc32');
  const crc32 = crc32Module.default;

  // 1. 获取上传凭证
  const authRes = await httpClient.request({
    method: 'POST', url: '/mweb/v1/get_upload_token',
    params: { aid: "513695", device_platform: "web", region: "CN", web_id: Date.now().toString() },
    data: { scene: 1 }, timeout: 30000
  });
  const uploadAuth = authRes.data;
  console.log(`凭证: space=${uploadAuth.space_name}`);

  // 2. ApplyUploadInner (带 Authorization)
  const VideoUploader_import = (await import('./src/api/VideoUploader.js')).VideoUploader;
  const vu = new VideoUploader_import(httpClient);
  const videoBuffer = await fs.promises.readFile(VIDEO_PATH);
  // @ts-ignore
  const applyResult = await vu['applyUpload'](uploadAuth, videoBuffer.length);
  console.log(`ApplyUpload: host=${applyResult.uploadHost}, vid=${applyResult.vid}`);

  // 3. 直接上传（带 Auth）
  const uploadUrl = `https://${applyResult.uploadHost}/upload/v1/${applyResult.storeUri}`;
  const videoCrc32 = crc32(videoBuffer).toString(16);
  console.log(`\n直接上传到: ${uploadUrl}`);

  const userRes = await httpClient.request({
    method: 'POST', url: '/mweb/v1/get_user_info',
    params: { aid: "513695", device_platform: "web", region: "CN" }, data: {},
  });
  const userId = userRes.data.uid;

  const uploadResp = await axios.post(uploadUrl, videoBuffer, {
    headers: {
      'Authorization': applyResult.auth,
      'Content-CRC32': videoCrc32,
      'Content-Disposition': 'attachment; filename="undefined"',
      'Content-Type': 'application/octet-stream',
      'Origin': 'https://jimeng.jianying.com',
      'Referer': 'https://jimeng.jianying.com/',
      'X-Storage-U': userId,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: () => true,
  });
  console.log(`上传: status=${uploadResp.status}, body=${JSON.stringify(uploadResp.data).substring(0, 200)}`);

  if (uploadResp.status !== 200) {
    console.error('❌ 上传失败');
    return;
  }
  console.log('✅ 直接上传成功');

  // 4. CommitUploadInner (无 Authorization 头)
  // @ts-ignore
  const sessionKey = vu['buildSessionKey'](applyResult, videoBuffer.length);
  console.log(`\nSessionKey (前80字符): ${sessionKey.substring(0, 80)}...`);

  const commitParams: Record<string, any> = {
    Action: 'CommitUploadInner',
    Version: '2020-11-19',
    SpaceName: uploadAuth.space_name,
  };
  const commitBody = {
    SessionKey: sessionKey,
    Functions: [],
  };
  const commitQueryString = Object.entries(commitParams)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  const commitUrl = `https://${uploadAuth.upload_domain}/?${commitQueryString}`;

  // 方案A: 无 Authorization 头（只有 x-amz-*）
  console.log('\n--- 方案A: CommitUploadInner 无 Authorization 头 ---');
  const now1 = new Date();
  const ts1 = now1.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const bodyHash1 = crypto.createHash('sha256').update(JSON.stringify(commitBody)).digest('hex');

  try {
    const resp1 = await axios.post(commitUrl, JSON.stringify(commitBody), {
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        'x-amz-date': ts1,
        'x-amz-security-token': uploadAuth.session_token,
        'x-amz-content-sha256': bodyHash1,
      },
      validateStatus: () => true,
    });
    console.log(`status=${resp1.status}`);
    console.log(`body: ${JSON.stringify(resp1.data).substring(0, 600)}`);
    if (resp1.data?.Result?.Results?.[0]) {
      console.log('✅ 方案A CommitUploadInner 成功!');
      const meta = resp1.data.Result.Results[0].VideoMeta;
      console.log(`vid=${resp1.data.Result.Results[0].Vid}, ${meta?.Width}x${meta?.Height}, ${meta?.Duration}s`);
      return;
    }
  } catch (e: any) {
    console.log(`方案A失败: ${e.message}`);
  }

  // 方案B: 新申请 ApplyUploadInner + 直接上传 + 带 Authorization 的 CommitUploadInner
  console.log('\n--- 方案B: 重新申请 + CommitUploadInner 带 Authorization 头 ---');
  // @ts-ignore
  const applyResult2 = await vu['applyUpload'](uploadAuth, videoBuffer.length);
  const uploadUrl2 = `https://${applyResult2.uploadHost}/upload/v1/${applyResult2.storeUri}`;

  const uploadResp2 = await axios.post(uploadUrl2, videoBuffer, {
    headers: {
      'Authorization': applyResult2.auth,
      'Content-CRC32': videoCrc32,
      'Content-Disposition': 'attachment; filename="undefined"',
      'Content-Type': 'application/octet-stream',
      'Origin': 'https://jimeng.jianying.com',
      'Referer': 'https://jimeng.jianying.com/',
      'X-Storage-U': userId,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: () => true,
  });
  console.log(`上传2: status=${uploadResp2.status}`);

  if (uploadResp2.status === 200) {
    // @ts-ignore
    const sessionKey2 = vu['buildSessionKey'](applyResult2, videoBuffer.length);
    const commitBody2 = {
      SessionKey: sessionKey2,
      Functions: [],
    };
    // @ts-ignore
    const commitHeaders2 = await httpClient.generateAuthorizationAndHeader(
      uploadAuth.access_key_id, uploadAuth.secret_access_key, uploadAuth.session_token,
      'cn-north-1', 'vod', 'POST', commitParams, commitBody2
    );
    commitHeaders2['Content-Type'] = 'text/plain;charset=UTF-8';

    try {
      const commitUrl2 = `https://${uploadAuth.upload_domain}/?${commitQueryString}`;
      const resp2 = await axios.post(commitUrl2, JSON.stringify(commitBody2), {
        headers: commitHeaders2,
        validateStatus: () => true,
      });
      console.log(`status=${resp2.status}`);
      console.log(`body: ${JSON.stringify(resp2.data).substring(0, 600)}`);
      if (resp2.data?.Result?.Results?.[0]) {
        console.log('✅ 方案B CommitUploadInner 成功!');
      }
    } catch (e: any) {
      console.log(`方案B失败: ${e.message}`);
    }
  }
}

async function testCdnDebug() {
  console.log('\n===== 测试: CDN 204 深度调试 =====\n');
  const httpClient = new HttpClient();
  const axios = (await import('axios')).default;

  // 1. 获取上传凭证
  const authRes = await httpClient.request({
    method: 'POST', url: '/mweb/v1/get_upload_token',
    params: { aid: "513695", device_platform: "web", region: "CN", web_id: Date.now().toString() },
    data: { scene: 1 }, timeout: 30000
  });
  const uploadAuth = authRes.data;

  // 2. ApplyUploadInner - 打印完整响应
  const VideoUploader_import = (await import('./src/api/VideoUploader.js')).VideoUploader;
  const vu = new VideoUploader_import(httpClient);
  const fs = await import('fs');
  const videoBuffer = await fs.promises.readFile(VIDEO_PATH);
  // @ts-ignore
  const applyResult = await vu['applyUpload'](uploadAuth, videoBuffer.length);
  console.log('ApplyUpload 完整结果:', JSON.stringify(applyResult, null, 2));

  // 获取用户ID
  const userRes = await httpClient.request({
    method: 'POST', url: '/mweb/v1/get_user_info',
    params: { aid: "513695", device_platform: "web", region: "CN" }, data: {},
  });
  const userId = userRes.data.uid;

  const baseUrl = `https://${applyResult.uploadHost}/upload/v1/${applyResult.storeUri}`;
  const boundary = 'WebKitFormBoundary' + Math.random().toString(36).substring(2, 18);
  const initUrl = `${baseUrl}?uploadmode=part&phase=init`;
  const initBody = `------${boundary}--\r\n`;

  console.log(`\nCDN host: ${applyResult.uploadHost}`);
  console.log(`Init URL: ${initUrl}`);
  console.log(`Body: "${initBody}" (${initBody.length} bytes)`);
  console.log(`X-Storage-U: ${userId}`);

  // 3. 测试1: 完整浏览器头部
  console.log('\n--- 测试1: 完整浏览器头部 ---');
  try {
    const resp1 = await axios.post(initUrl, initBody, {
      headers: {
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        'Connection': 'keep-alive',
        'Content-Type': `multipart/form-data; boundary=----${boundary}`,
        'Host': applyResult.uploadHost,
        'Origin': 'https://jimeng.jianying.com',
        'Referer': 'https://jimeng.jianying.com/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'X-Storage-U': userId,
        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
      },
      validateStatus: () => true,
      maxRedirects: 0,
    });
    console.log(`status: ${resp1.status}`);
    console.log(`响应头:`, JSON.stringify(resp1.headers, null, 2));
    console.log(`body: ${JSON.stringify(resp1.data).substring(0, 500)}`);
  } catch (e: any) {
    console.log(`错误: ${e.message}`);
  }

  // 4. 测试2: 先发 OPTIONS 再发 POST
  console.log('\n--- 测试2: 先 OPTIONS 再 POST ---');
  try {
    const optResp = await axios({
      method: 'OPTIONS',
      url: initUrl,
      headers: {
        'Access-Control-Request-Headers': 'content-type,x-storage-u',
        'Access-Control-Request-Method': 'POST',
        'Origin': 'https://jimeng.jianying.com',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      validateStatus: () => true,
    });
    console.log(`OPTIONS status: ${optResp.status}`);
    console.log(`OPTIONS CORS headers:`, {
      'access-control-allow-origin': optResp.headers['access-control-allow-origin'],
      'access-control-allow-methods': optResp.headers['access-control-allow-methods'],
      'access-control-allow-headers': optResp.headers['access-control-allow-headers'],
    });
    
    // 然后 POST
    const resp2 = await axios.post(initUrl, initBody, {
      headers: {
        'Content-Type': `multipart/form-data; boundary=----${boundary}`,
        'Origin': 'https://jimeng.jianying.com',
        'Referer': 'https://jimeng.jianying.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'X-Storage-U': userId,
      },
      validateStatus: () => true,
    });
    console.log(`POST status: ${resp2.status}`);
    console.log(`body: ${JSON.stringify(resp2.data).substring(0, 500)}`);
  } catch (e: any) {
    console.log(`错误: ${e.message}`);
  }

  // 5. 测试3: 直接上传（非分片），打印完整响应头
  console.log('\n--- 测试3: 直接上传（非分片）---');
  const directUrl = `https://${applyResult.uploadHost}/upload/v1/${applyResult.storeUri}`;
  const crc32Module = await import('crc32');
  const crc32 = crc32Module.default;
  const videoCrc32 = crc32(videoBuffer).toString(16);
  
  try {
    const resp3 = await axios.post(directUrl, videoBuffer, {
      headers: {
        'Authorization': applyResult.auth,
        'Content-CRC32': videoCrc32,
        'Content-Disposition': 'attachment; filename="undefined"',
        'Content-Type': 'application/octet-stream',
        'Origin': 'https://jimeng.jianying.com',
        'Referer': 'https://jimeng.jianying.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'X-Storage-U': userId,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: () => true,
    });
    console.log(`status: ${resp3.status}`);
    console.log(`响应头:`, JSON.stringify(resp3.headers, null, 2));
    console.log(`body: ${JSON.stringify(resp3.data).substring(0, 500)}`);
  } catch (e: any) {
    console.log(`错误: ${e.message}`);
  }
}

async function testServerSessionKey() {
  console.log('\n===== 测试: 服务端 SessionKey + 直接上传 =====\n');
  const httpClient = new HttpClient();
  const axios = (await import('axios')).default;
  const fs = await import('fs');
  const crc32Module = await import('crc32');
  const crc32 = crc32Module.default;

  // 1. 获取上传凭证
  const authRes = await httpClient.request({
    method: 'POST', url: '/mweb/v1/get_upload_token',
    params: { aid: "513695", device_platform: "web", region: "CN", web_id: Date.now().toString() },
    data: { scene: 1 }, timeout: 30000
  });
  const uploadAuth = authRes.data;
  console.log(`凭证: space=${uploadAuth.space_name}`);

  // 2. ApplyUploadInner - 获取完整响应（含服务端 SessionKey）
  const params: Record<string, any> = {
    Action: 'ApplyUploadInner',
    Version: '2020-11-19',
    SpaceName: uploadAuth.space_name,
    FileType: 'video',
    IsInner: 1,
    FileSize: 5402894,
    s: Math.random().toString(36).substring(2, 13),
  };
  // @ts-ignore
  const headers = await httpClient.generateAuthorizationAndHeader(
    uploadAuth.access_key_id, uploadAuth.secret_access_key, uploadAuth.session_token,
    'cn-north-1', 'vod', 'GET', params
  );
  const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  const applyResp = await httpClient.request({
    method: 'GET',
    url: `https://${uploadAuth.upload_domain}/?${qs}`,
    headers
  });

  const uploadNode = applyResp?.Result?.InnerUploadAddress?.UploadNodes?.[0];
  const storeInfo = uploadNode?.StoreInfos?.[0];
  const serverSessionKey = uploadNode?.SessionKey;
  
  console.log(`uploadHost: ${uploadNode?.UploadHost}`);
  console.log(`vid: ${uploadNode?.Vid}`);
  console.log(`storeUri: ${storeInfo?.StoreUri}`);
  console.log(`uploadID: ${storeInfo?.UploadID}`);
  console.log(`serverSessionKey 长度: ${serverSessionKey?.length}`);
  console.log(`serverSessionKey 前80字符: ${serverSessionKey?.substring(0, 80)}...`);
  console.log(`Auth 前60字符: ${storeInfo?.Auth?.substring(0, 60)}...`);

  // 3. 直接上传视频
  const videoBuffer = await fs.promises.readFile(VIDEO_PATH);
  const videoCrc32 = crc32(videoBuffer).toString(16);
  const uploadUrl = `https://${uploadNode.UploadHost}/upload/v1/${storeInfo.StoreUri}`;
  console.log(`\n直接上传到: ${uploadUrl}`);

  const uploadResp = await axios.post(uploadUrl, videoBuffer, {
    headers: {
      'Authorization': storeInfo.Auth,
      'Content-CRC32': videoCrc32,
      'Content-Disposition': 'attachment; filename="undefined"',
      'Content-Type': 'application/octet-stream',
      'Origin': 'https://jimeng.jianying.com',
      'Referer': 'https://jimeng.jianying.com/',
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: () => true,
  });
  console.log(`上传: status=${uploadResp.status}, body=${JSON.stringify(uploadResp.data).substring(0, 200)}`);

  if (uploadResp.status !== 200 || uploadResp.data?.code !== 2000) {
    console.error('❌ 上传失败');
    return;
  }
  console.log('✅ 直接上传成功');

  // 4. CommitUploadInner 使用服务端 SessionKey
  console.log('\n--- CommitUploadInner (服务端 SessionKey) ---');
  const commitParams: Record<string, any> = {
    Action: 'CommitUploadInner',
    Version: '2020-11-19',
    SpaceName: uploadAuth.space_name,
  };
  const commitBody = {
    SessionKey: serverSessionKey,
    Functions: [],
  };
  // @ts-ignore
  const commitHeaders = await httpClient.generateAuthorizationAndHeader(
    uploadAuth.access_key_id, uploadAuth.secret_access_key, uploadAuth.session_token,
    'cn-north-1', 'vod', 'POST', commitParams, commitBody
  );
  commitHeaders['Content-Type'] = 'text/plain;charset=UTF-8';
  const commitQS = Object.entries(commitParams).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  const commitUrl = `https://${uploadAuth.upload_domain}/?${commitQS}`;

  try {
    const commitResp = await axios.post(commitUrl, JSON.stringify(commitBody), {
      headers: commitHeaders,
      validateStatus: () => true,
    });
    console.log(`status: ${commitResp.status}`);
    console.log(`body: ${JSON.stringify(commitResp.data).substring(0, 600)}`);
    
    if (commitResp.data?.Result?.Results?.[0]) {
      const meta = commitResp.data.Result.Results[0].VideoMeta;
      console.log(`\n✅ CommitUploadInner 成功!`);
      console.log(`vid=${commitResp.data.Result.Results[0].Vid}`);
      console.log(`${meta?.Width}x${meta?.Height}, ${meta?.Duration}s, ${meta?.Format}`);
    } else {
      console.log('❌ CommitUploadInner 未返回结果');
    }
  } catch (e: any) {
    console.error(`❌ CommitUploadInner 失败: ${e.message}`);
  }
}

async function main() {
  console.log('JIMENG_API_TOKEN:', process.env.JIMENG_API_TOKEN ? '已设置 (长度' + process.env.JIMENG_API_TOKEN.length + ')' : '未设置');

  // 测试完整 Seedance 2.0 流程
  await testSeedanceGeneration();
}

main().catch(console.error);
