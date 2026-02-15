# 即梦 (JiMeng) 平台 API 参考文档

> 本文档基于项目源码和 HAR 抓包分析，完整记录即梦 AI Web 端使用的所有 HTTP API。
> 仅供学习研究使用。

---

## 目录

- [1. 认证机制](#1-认证机制)
- [2. 内部 API（jimeng.jianying.com）](#2-内部-api)
- [3. 积分系统 API](#3-积分系统-api)
- [4. ImageX 图片上传 API](#4-imagex-图片上传-api)
- [5. VOD 视频上传 API](#5-vod-视频上传-api)
- [6. 模型常量](#6-模型常量)
- [7. 任务状态码与错误码](#7-任务状态码与错误码)

---

## 1. 认证机制

即梦平台使用两套独立认证：内部 API 使用 Cookie + Sign 签名，外部存储 API（ImageX / VOD）使用 AWS SigV4 签名。

### 1.1 Cookie 生成

**来源**: `src/utils/auth.ts`

```
sessionid={token}; sessionid_ss={token}; sid_tt={token};
sid_guard={token}%7C{timestamp}%7C5183999%7C{date};
install_id={random_16}; ttreq=1${random_40};
passport_csrf_token={random_hex_32};
passport_csrf_token_default={random_hex_32};
is_staff_user=false;
n_mh={random_base64url_32};
uid_tt={random_hex_32}; uid_tt_ss={random_hex_32};
sid_ucp_v1=placeholder; ssid_ucp_v1=placeholder
```

| 字段 | 来源 | 说明 |
|------|------|------|
| `sessionid` | 浏览器 Cookie | 核心认证令牌 |
| `sessionid_ss` / `sid_tt` | 同 sessionid | 冗余副本 |
| `sid_guard` | URL 编码时间戳 | 安全守卫标记 |
| `install_id` | 随机 16 位字符串 | 设备安装标识 |
| `ttreq` | `1$` + 随机 40 位字符串 | 请求追踪 |
| `passport_csrf_token` | `crypto.randomBytes(16).toString('hex')` | CSRF 防护 |
| `n_mh` | `crypto.randomBytes(32).toString('base64url')` | 签名占位 |
| `uid_tt` | `crypto.randomBytes(16).toString('hex')` | 用户标识 |

### 1.2 Sign 签名算法

**来源**: `src/api/HttpClient.ts` → `generateSign()`

```
sign = MD5("9e2c|{uri_last_7_chars}|7|8.4.0|{device_time}||11ac")
```

| 组件 | 值 | 说明 |
|------|------|------|
| PREFIX | `9e2c` | 固定前缀 |
| URI 后缀 | URI 路径最后 7 个字符 | 如 `/mweb/v1/aigc_draft/generate` → `enerate` |
| PLATFORM_CODE | `7` | 平台标识（Web） |
| VERSION_CODE | `8.4.0` | 应用版本号 |
| device_time | Unix 时间戳（秒） | 当前时间 |
| （空字段） | | 保留为空 |
| SUFFIX | `11ac` | 固定后缀 |

### 1.3 AWS SigV4 签名（外部 API）

**来源**: `src/api/HttpClient.ts` → `generateAuthorizationAndHeader()`

用于 ImageX 和 VOD 上传 API，基于 AWS Signature Version 4。

**Authorization 头格式**:
```
AWS4-HMAC-SHA256 Credential={access_key_id}/{date}/{region}/{service}/aws4_request,
SignedHeaders={signed_headers},
Signature={signature}
```

**签名密钥派生**:
```
kDate    = HMAC-SHA256("AWS4" + secretAccessKey, date)
kRegion  = HMAC-SHA256(kDate, region)
kService = HMAC-SHA256(kRegion, service)
kSigning = HMAC-SHA256(kService, "aws4_request")
```

| 服务 | Region | Service |
|------|--------|---------|
| ImageX | `cn-north-1` | `imagex` |
| VOD | `cn-north-1` | `vod` |

**附加头部**: `X-Amz-Date`（ISO 8601）, `X-Amz-Security-Token`, `X-Amz-Content-Sha256`

### 1.4 公共请求头（内部 API）

所有 `jimeng.jianying.com` 下 API 共享：

```http
Accept: application/json, text/plain, */*
Accept-Encoding: gzip, deflate, br, zstd
Accept-Language: zh-CN,zh;q=0.9
Cache-Control: no-cache
Content-Type: application/json
Appid: 513695
Appvr: 8.4.0
device-time: {unix_timestamp_seconds}
sign-ver: 1
sign: {md5_sign}
loc: cn
app-sdk-version: 48.0.0
tdid: 
lan: zh-Hans
Origin: https://jimeng.jianying.com
Pragma: no-cache
Priority: u=1, i
Referer: https://jimeng.jianying.com
Pf: 7
Sec-Ch-Ua: "Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"
Sec-Ch-Ua-Mobile: ?0
Sec-Ch-Ua-Platform: "Windows"
Sec-Fetch-Dest: empty
Sec-Fetch-Mode: cors
Sec-Fetch-Site: same-origin
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36
Cookie: {generated_cookie}
```

### 1.5 公共查询参数

由 `generateRequestParams()` 生成：

| 参数 | 值 | 说明 |
|------|------|------|
| `aid` | `513695` | 应用 ID |
| `device_platform` | `web` | 平台 |
| `region` | `cn` | 区域 |
| `webId` | 随机大整数 | Web 会话标识 |
| `web_version` | `7.5.0` | Web 版本 |
| `da_version` | `3.3.9` | 数据分析版本 |
| `aigc_features` | `app_lip_sync` | 功能标记 |
| `babi_param` | URL 编码 JSON | 追踪参数 |

**babi_param**:
```json
{
  "scenario": "image_video_generation",
  "feature_key": "aigc_to_image",
  "feature_entrance": "to_image",
  "feature_entrance_detail": "to_image-{model_name}"
}
```

---

## 2. 内部 API

Base URL: `https://jimeng.jianying.com`

### 2.1 AIGC 生成

```
POST /mweb/v1/aigc_draft/generate
```

统一生成入口，图片和视频共用。通过 `draft_content` 结构区分模式。

**来源**: `src/api/NewJimengClient.ts`, `src/api/VideoService.ts`

**请求体**:
```json
{
  "extend": {
    "root_model": "{model_internal_name}",
    "m_video_commerce_info": { ... }
  },
  "submit_id": "{uuid}",
  "metrics_extra": "{json_string}",
  "draft_content": "{json_string}",
  "http_common_info": { "aid": 513695 },
  "action": 1,
  "history_id": "{id}"
}
```

- `action`: `1` = 初始生成, `2` = 继续生成
- `history_id`: 仅 `action=2` 时提供

#### draft_content - 图片生成

```json
{
  "version": "3.0.2",
  "component_list": [{
    "type": "image_base_component",
    "id": "{uuid}",
    "min_version": "3.0.0",
    "aigc_mode": "workbench",
    "generate_type": "generate",
    "gen_type": 1,
    "abilities": {
      "type": "txt2img",
      "id": "{uuid}",
      "prompt": "{user_prompt}",
      "negative_prompt": "",
      "seed": "{random_int}",
      "image_ratio": "{ratio_type}",
      "resolution_type": "2k",
      "large_image_info": {
        "width": 2048, "height": 2048,
        "format": "webp", "image_scene_list": []
      },
      "req_key": "{model_internal_name}",
      "sample_strength": 0.5,
      "image_count": 4,
      "ability_list": [],
      "history_option": { "is_new": true },
      "logo_info": {}
    }
  }]
}
```

`gen_type`: `1` = 文生图, `12` = 图生图

#### draft_content - 文生视频 / 首尾帧

```json
{
  "version": "3.0.2",
  "component_list": [{
    "type": "video_base_component",
    "abilities": {
      "type": "video",
      "prompt": "{user_prompt}",
      "req_key": "{model_name}",
      "mode": 0,
      "video_ratio": "16:9",
      "resolution": "720p",
      "time_duration": 5.0,
      "fps": 24,
      "first_frame": "{image_uri}",
      "last_frame": "{image_uri}",
      "key_frames": {}
    }
  }]
}
```

`mode`: `0` = 文生视频/首尾帧

#### draft_content - 多帧视频

```json
{
  "abilities": {
    "type": "video",
    "mode": 0,
    "key_frames": {
      "0": { "image_uri": "{uri}", "prompt": "{prompt}" },
      "2000": { "image_uri": "{uri}", "prompt": "{prompt}" },
      "4000": { "image_uri": "{uri}", "prompt": "{prompt}" }
    }
  }
}
```

`key_frames` 的 key 是时间偏移（毫秒）。

#### draft_content - 主体参考 (video_mix)

```json
{
  "abilities": {
    "type": "video",
    "mode": 2,
    "video_mode": 2,
    "idip_frames": ["{uri_1}", "{uri_2}"],
    "idip_meta_list": [
      { "type": "text", "content": "xxx" },
      { "type": "image", "content": "", "image_idx": 0 },
      { "type": "text", "content": "yyy" }
    ]
  }
}
```

`[图N]` 语法解析为 `idip_meta_list` 中的 image 类型条目。

#### draft_content - Seedance 2.0

```json
{
  "abilities": {
    "type": "video",
    "req_key": "dreamina_seedance_40",
    "unified_edit_input": {
      "material_list": [
        { "type": "image", "uri": "{uri}", "width": 1920, "height": 1080 },
        { "type": "video", "vid": "{vid}", "width": 1920, "height": 1080, "duration": 5000 }
      ],
      "meta_list": [
        { "type": "prompt", "content": "{user_prompt}" }
      ]
    }
  }
}
```

**响应**:
```json
{
  "ret": "0",
  "data": {
    "aigc_data": {
      "history_record_id": "4721606420748",
      "task": { "submit_id": "{uuid}" },
      "submit_id": "{uuid}"
    }
  }
}
```

---

### 2.2 任务状态查询

```
POST /mweb/v1/get_history_by_ids
```

**来源**: `src/api/NewJimengClient.ts`, `src/api/VideoService.ts`

**请求体**:
```json
{
  "history_ids": ["4721606420748"],
  "submit_ids": ["{uuid}"],
  "image_info": {
    "width": 2048, "height": 2048,
    "format": "webp", "image_scene_list": []
  },
  "http_common_info": { "aid": 513695 }
}
```

**响应**:
```json
{
  "data": {
    "{task_id}": {
      "status": 50,
      "total_image_count": 4,
      "finished_image_count": 4,
      "fail_code": "",
      "item_list": [{
        "image": {
          "url": "https://...",
          "large_images": [{ "image_url": "https://...", "width": 2048, "height": 2048 }]
        },
        "video": {
          "video_url": "https://...",
          "transcoded_video": { "origin": { "video_url": "https://..." } }
        }
      }]
    }
  }
}
```

---

### 2.3 上传凭证获取

```
POST /mweb/v1/get_upload_token
```

**来源**: `src/api/ImageUploader.ts`, `src/api/VideoUploader.ts`

**查询参数**: `aid=513695`, `device_platform=web`, `region=CN`, `web_id={timestamp}`

**请求体**:
```json
{ "scene": 1 }
```

`scene`: `1` = VOD（视频）, `2` = ImageX（图片）

**响应（scene=2, ImageX）**:
```json
{
  "data": {
    "access_key_id": "AKLTxxxxx",
    "secret_access_key": "xxxxxxxx",
    "session_token": "STSxxxxx"
  }
}
```

**响应（scene=1, VOD）**:
```json
{
  "data": {
    "access_key_id": "AKLTxxxxx",
    "secret_access_key": "xxxxxxxx",
    "session_token": "STSxxxxx",
    "space_name": "aigc_draft_img",
    "upload_domain": "vod.bytedanceapi.com"
  }
}
```

---

### 2.4 用户信息

```
POST /mweb/v1/get_user_info
```

获取用户 UID（用于 CDN 上传的 `X-Storage-U` 头）。

**来源**: `src/api/VideoUploader.ts`

**查询参数**: `aid=513695`, `device_platform=web`, `region=CN`

**请求体**: `{}`

**响应**:
```json
{ "data": { "uid": "1234567890123456" } }
```

---

### 2.5 图片审核

```
POST /mweb/v1/imagex/submit_audit_job
```

**来源**: `src/api/ImageUploader.ts`

**查询参数**: `aid=513695`, `web_version=7.5.0`, `da_version=3.3.9`, `aigc_features=app_lip_sync`

**请求体**:
```json
{ "uri_list": ["tos-cn-i-tb4s082cfz/xxxxx.png"] }
```

---

### 2.6 队列信息查询

```
POST /mweb/v1/get_history_queue_info
```

**来源**: `src/api/NewJimengClient.ts`

**请求体**:
```json
{ "history_ids": ["{id1}", "{id2}"] }
```

---

## 3. 积分系统 API

Base URL: `https://jimeng.jianying.com`

所有积分 API 需附加: `Referer: https://jimeng.jianying.com/ai-tool/image/generate`

### 3.1 积分余额查询

```
POST /commerce/v1/benefits/user_credit
```

**来源**: `src/api/NewCreditService.ts` → `getCredit()`

**请求体**: `{}`

**响应**:
```json
{
  "credit": {
    "gift_credit": 120,
    "purchase_credit": 0,
    "vip_credit": 60
  }
}
```

### 3.2 每日积分领取

```
POST /commerce/v1/benefits/credit_receive
```

**来源**: `src/api/NewCreditService.ts` → `receiveCredit()`

每天可领 60-80 免费积分。

**请求体**: `{ "time_zone": "Asia/Shanghai" }`

**响应**:
```json
{
  "ret": "0",
  "data": {
    "cur_total_credits": 180,
    "receive_quota": 60,
    "is_first_receive": true
  }
}
```

### 3.3 积分历史查询

```
POST /commerce/v1/benefits/user_credit_history
```

**来源**: `src/api/NewCreditService.ts` → `getCreditHistory()`

**请求体**: `{ "count": 20, "cursor": "0" }`

**响应**:
```json
{
  "data": {
    "records": [{
      "amount": 90,
      "create_time": 1700000000,
      "title": "视频生成",
      "history_type": 2,
      "submit_id": "{uuid}",
      "status": "Checked"
    }],
    "has_more": true,
    "new_cursor": "20"
  }
}
```

`history_type`: `1` = 收入, `2` = 支出

### 3.4 VIP 订阅信息

```
POST /commerce/v1/subscription/user_info
```

**来源**: `src/api/NewCreditService.ts` → `getSubscriptionInfo()`

**请求体**: `{ "aid": 513695, "scene": "vip", "need_sign_info": true }`

**响应**:
```json
{
  "data": {
    "flag": true,
    "cur_vip_level": "standard",
    "start_time": 1700000000,
    "end_time": 1702592000,
    "is_cancel_subscribe": false,
    "subscribe_type": "monthly",
    "subscribe_cycle": 1
  }
}
```

---

## 4. ImageX 图片上传 API

**流程**: `get_upload_token(scene=2)` → `ApplyImageUpload` → 上传数据 → `CommitImageUpload` → `submit_audit_job`

### 4.1 申请图片上传（ApplyImageUpload）

```
GET https://imagex.bytedanceapi.com/?Action=ApplyImageUpload&...
```

**来源**: `src/api/ImageUploader.ts`

**查询参数**:

| 参数 | 值 |
|------|------|
| `Action` | `ApplyImageUpload` |
| `Version` | `2018-08-01` |
| `ServiceId` | `tb4s082cfz` |
| `FileSize` | `{bytes}` |
| `s` | `{random_11_chars}` |

**请求头**: AWS SigV4（region=`cn-north-1`, service=`imagex`）

**响应**:
```json
{
  "Result": {
    "UploadAddress": {
      "UploadHosts": ["tos-cn-i-tb4s082cfz.bytedance.com"],
      "StoreInfos": [{
        "StoreUri": "tos-cn-i-tb4s082cfz/xxxx.png",
        "Auth": "bearer_auth_token"
      }],
      "SessionKey": "base64_session_key"
    }
  }
}
```

### 4.2 上传图片数据

```
POST https://{UploadHost}/upload/v1/{StoreUri}
```

**请求头**:
```http
Authorization: {Auth}
Content-Crc32: {crc32_hex}
Content-Type: application/octet-stream
```

**请求体**: 原始图片二进制

**响应**: `{ "code": 2000, "message": "success" }`

### 4.3 提交图片上传（CommitImageUpload）

```
POST https://imagex.bytedanceapi.com/?Action=CommitImageUpload&...
```

**查询参数**: `Action=CommitImageUpload`, `Version=2018-08-01`, `ServiceId=tb4s082cfz`, `FileSize={bytes}`

**请求头**: AWS SigV4（body hash 包含请求体）

**请求体**: `{ "SessionKey": "{session_key_from_apply}" }`

**响应**:
```json
{
  "Result": {
    "PluginResult": [{ "ImageUri": "tos-cn-i-tb4s082cfz/xxxx.png" }]
  }
}
```

---

## 5. VOD 视频上传 API

**流程**: `get_upload_token(scene=1)` → `ApplyUploadInner` → 上传数据 → `CommitUploadInner`

> **关键**: `ApplyUploadInner` 返回的 `SessionKey` 必须原样传给 `CommitUploadInner`，不可客户端构建。

### 5.1 申请视频上传（ApplyUploadInner）

```
GET https://{upload_domain}/?Action=ApplyUploadInner&...
```

**来源**: `src/api/VideoUploader.ts`

**查询参数**:

| 参数 | 值 |
|------|------|
| `Action` | `ApplyUploadInner` |
| `Version` | `2020-11-19` |
| `SpaceName` | `{space_name}` |
| `FileType` | `video` |
| `IsInner` | `1` |
| `FileSize` | `{bytes}` |
| `s` | `{random_11_chars}` |

**请求头**: AWS SigV4（region=`cn-north-1`, service=`vod`）

**响应**:
```json
{
  "Result": {
    "InnerUploadAddress": {
      "UploadNodes": [{
        "UploadHost": "tos-d-cn-i-xxxx.bytedance.com",
        "Vid": "v0xxxx",
        "SessionKey": "eyJhbGciOiJIUzI1NiIs...",
        "StoreInfos": [{
          "StoreUri": "tos-cn-v-xxxx/yyyy.mp4",
          "Auth": "bearer_auth_string",
          "UploadID": "upload_id"
        }]
      }]
    }
  }
}
```

### 5.2 分片上传视频数据

**来源**: `src/api/VideoUploader.ts` → `uploadChunked()`

分片大小: **5MB**

**CDN 基础请求头**:
```http
Accept: */*
Origin: https://jimeng.jianying.com
Referer: https://jimeng.jianying.com/
User-Agent: Mozilla/5.0 ...
X-Storage-U: {user_id}
```

#### Init

```
POST https://{Host}/upload/v1/{StoreUri}?uploadmode=part&phase=init
Content-Type: multipart/form-data; boundary=----{boundary}
Body: ------{boundary}--\r\n
```
→ `{ "data": { "uploadid": "xxx" } }`

#### Transfer (× N)

```
POST ...?uploadid={id}&part_number={n}&phase=transfer
Content-Type: application/octet-stream
Body: {chunk_binary}
```
→ `{ "code": 2000, "data": { "crc32": "xxx" } }`

#### Finish

```
POST ...?uploadmode=part&phase=finish&uploadid={id}
Content-Type: text/plain;charset=UTF-8
Body: 1:{crc32_1},2:{crc32_2},...
```
→ `{ "code": 2000 }`

### 5.3 直接上传视频数据（降级模式）

分片 init 返回 204 时自动降级。

```
POST https://{Host}/upload/v1/{StoreUri}
```

**请求头**:
```http
Authorization: {Auth}
Content-CRC32: {crc32_hex}
Content-Disposition: attachment; filename="undefined"
Content-Type: application/octet-stream
```

**请求体**: 完整视频二进制

**响应**: `{ "code": 2000, "data": { "crc32": "xxx" } }`

### 5.4 提交视频上传（CommitUploadInner）

```
POST https://{upload_domain}/?Action=CommitUploadInner&Version=2020-11-19&SpaceName={space}
```

**请求头**: AWS SigV4 + `Content-Type: text/plain;charset=UTF-8`

**请求体**:
```json
{ "SessionKey": "{server_generated_key}", "Functions": [] }
```

**响应**:
```json
{
  "Result": {
    "Results": [{
      "Vid": "v0xxxx",
      "VideoMeta": {
        "Uri": "tos-cn-v-xxxx/yyyy.mp4",
        "Width": 1920, "Height": 1080,
        "Duration": 5.0, "Format": "MP4"
      }
    }]
  }
}
```

---

## 6. 模型常量

**来源**: `src/types/models.ts`

### 6.1 图片模型

| 用户名 | 内部名 |
|--------|--------|
| `jimeng-4.5` | `high_aes_general_v40l` |
| `jimeng-4.1` | `high_aes_general_v41` |
| `jimeng-4.0` | `high_aes_general_v40` |
| `jimeng-3.1` | `high_aes_general_v30l_art_fangzhou:general_v3.0_18b` |
| `jimeng-3.0` | `high_aes_general_v30l:general_v3.0_18b` |
| `jimeng-2.1` | `high_aes_general_v21_L:general_v2.1_L` |
| `jimeng-2.0-pro` | `high_aes_general_v20_L:general_v2.0_L` |
| `jimeng-2.0` | `high_aes_general_v20:general_v2.0` |
| `jimeng-1.4` | `high_aes_general_v14:general_v1.4` |
| `jimeng-xl-pro` | `text2img_xl_sft` |

### 6.2 视频模型

| 用户名 | 内部名 |
|--------|--------|
| `jimeng-video-3.0` | `dreamina_ic_generate_video_model_vgfm_3.0` |
| `jimeng-video-3.0-pro` | `dreamina_ic_generate_video_model_vgfm_3.0_pro` |
| `jimeng-video-2.0-pro` | `dreamina_ic_generate_video_model_vgfm1.0` |
| `jimeng-video-2.0` | `dreamina_ic_generate_video_model_vgfm_lite` |
| `seedance-2.0` | `dreamina_seedance_40` |

### 6.3 宽高比预设 (2K)

| 名称 | ratio_type | 尺寸 |
|------|-----------|------|
| `1:1` | 1 | 2048 × 2048 |
| `3:4` | 2 | 1728 × 2304 |
| `16:9` | 3 | 2560 × 1440 |
| `4:3` | 4 | 2304 × 1728 |
| `9:16` | 5 | 1440 × 2560 |
| `2:3` | 6 | 1664 × 2496 |
| `3:2` | 7 | 2496 × 1664 |
| `21:9` | 8 | 3024 × 1296 |

### 6.4 宽高比预设 (4K)

| 名称 | ratio_type | 尺寸 |
|------|-----------|------|
| `1:1` | 1 | 4096 × 4096 |
| `3:4` | 2 | 3520 × 4693 |
| `16:9` | 3 | 5404 × 3040 |
| `4:3` | 4 | 4693 × 3520 |
| `9:16` | 5 | 3040 × 5404 |
| `2:3` | 6 | 3328 × 4992 |
| `3:2` | 7 | 4992 × 3328 |
| `21:9` | 8 | 6197 × 2656 |

---

## 7. 任务状态码与错误码

### 7.1 任务状态码

| status | 含义 |
|--------|------|
| `20` | 排队中 |
| `30` | 失败 |
| `42` | 部分完成 |
| `45` | 处理中 |
| `50` | 完成 |

### 7.2 内部 API 错误

| ret | errmsg | 说明 |
|-----|--------|------|
| `0` | — | 成功 |
| `1014` | `system busy` | 系统繁忙 |

### 7.3 外部 API 错误

| CodeN | Code | 说明 |
|-------|------|------|
| `100024` | `InvalidAuthorization` | Authorization 头无效 |
| `30406` | `invalid token` | SessionKey 无效 |

### 7.4 CDN 上传状态

| HTTP 状态 | 说明 |
|----------|------|
| `200` + `code: 2000` | 成功 |
| `204` | CDN 边缘拒绝（触发降级为直接上传） |

### 7.5 生成失败码

| fail_code | 说明 |
|-----------|------|
| `130006` | 内容安全审核未通过 |
| `140001` | 资源不足 / 配额用尽 |

---

## API 汇总

| 分类 | 端点数 |
|------|--------|
| 内部 API (jimeng.jianying.com) | 6 |
| 积分系统 API | 4 |
| ImageX 图片上传 API | 3 |
| VOD 视频上传 API | 4 |
| **合计** | **17** |

---

> **免责声明**: 本文档基于项目源码逆向分析，仅供学习研究。API 随平台更新可能变化，请以实际抓包为准。
