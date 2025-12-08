# Chrome DevTools 真实请求抓取对比报告

**抓取时间**: 2025-01-05
**Token**: 1adad6f6353b778c58f993cd1e9d022e
**浏览器**: Chrome 141.0.0.0 (macOS)

---

## 一、关键发现总结

### 🔴 重大差异发现

1. **Appvr 版本号不一致**
   - **浏览器实际使用**: `8.4.0`
   - **我们代码使用**: `5.8.0`
   - **影响**: 可能导致API请求被识别为旧版本客户端

2. **URL参数格式差异**
   - **浏览器**: 多数API使用完整URL参数
   - **我们代码**: 部分API缺少URL参数

3. **da_version 版本号**
   - **浏览器实际使用**: `3.2.8` 或 `3.3.3`
   - **我们代码**: 未使用此参数

---

## 二、详细请求格式对比

### 2.1 积分查询API (`/commerce/v1/benefits/user_credit`)

#### 浏览器真实请求:

**URL**:
```
POST https://jimeng.jianying.com/commerce/v1/benefits/user_credit
```

**关键请求头**:
```http
appid: 513695
appvr: 8.4.0
sign: 14e1660a70ac1388d45c1e415350955a
device-time: 1759678255
sign-ver: 1
pf: 7
lan: ZH
content-type: application/json
referer: https://jimeng.jianying.com/ai-tool/generate/?type=image
```

**⚠️ 重要**: **没有URL参数**，请求体为空 `{}`

#### 我们当前代码 (NewCreditService.ts:40-54):

```typescript
const creditParams = {
  aid: "513695",
  device_platform: "web",
  region: "CN",
  web_id: Date.now().toString(),
};

const result = await this.httpClient.request({
  method: 'POST',
  url: '/commerce/v1/benefits/user_credit',
  params: creditParams,  // ❌ 浏览器实际没有这些URL参数
  data: {},
  headers: { 'Referer': 'https://jimeng.jianying.com/ai-tool/image/generate' }
});
```

**问题**: 我们添加了URL参数，但浏览器实际没有使用。

---

### 2.2 实验参数API (`/mweb/v1/get_experiment_params`)

#### 浏览器真实请求:

**URL**:
```
POST https://jimeng.jianying.com/mweb/v1/get_experiment_params?aid=513695&device_platform=web&region=CN&web_id=7556785579800331826&web_version=7.5.0&da_version=3.2.8&aigc_features=app_lip_sync
```

**关键请求头**:
```http
appid: 513695
appvr: 8.4.0
sign: 5f65d9939c380f54ea4a27bc30374617
device-time: 1759678253
sign-ver: 1
loc: cn
app-sdk-version: 48.0.0
pf: 7
lan: zh-Hans
content-type: application/json
referer: https://jimeng.jianying.com/ai-tool/generate/?type=image
```

**URL参数**:
```
aid=513695
device_platform=web
region=CN
web_id=7556785579800331826
web_version=7.5.0
da_version=3.2.8
aigc_features=app_lip_sync
```

#### 我们当前代码:

**问题**:
1. ❌ 缺少 `web_version=7.5.0`
2. ❌ 缺少 `da_version=3.2.8`
3. ❌ 缺少 `aigc_features=app_lip_sync`

---

### 2.3 积分领取API (`/commerce/v1/benefits/credit_receive`)

#### 浏览器真实请求:

**URL**:
```
POST https://jimeng.jianying.com/commerce/v1/benefits/credit_receive?msToken=xxx&a_bogus=xxx
```

**⚠️ 重要发现**:
- 使用了 `msToken` 和 `a_bogus` 参数
- **没有**我们添加的 `aid`, `device_platform`, `region`, `web_id` 参数

#### 我们当前代码 (NewCreditService.ts:75-88):

```typescript
const creditParams = {
  aid: "513695",
  device_platform: "web",
  region: "CN",
  web_id: Date.now().toString(),
};

const credit = await this.httpClient.request({
  method: 'POST',
  url: '/commerce/v1/benefits/credit_receive',
  params: creditParams,  // ❌ 浏览器实际使用 msToken + a_bogus
  data: { 'time_zone': 'Asia/Shanghai' },
  headers: { 'Referer': 'https://jimeng.jianying.com/ai-tool/image/generate' }
});
```

**问题**: 参数格式完全不匹配。

---

### 2.4 图片上传Token API (`/mweb/v1/get_upload_token`)

#### 从其他API推断的可能格式:

**URL** (预期):
```
POST https://jimeng.jianying.com/mweb/v1/get_upload_token?aid=513695&web_version=7.5.0&da_version=3.3.3&aigc_features=app_lip_sync
```

#### 我们当前代码 (ImageUploader.ts:276-290):

```typescript
const uploadParams = {
  aid: "513695",
  device_platform: "web",
  region: "CN",
  web_id: Date.now().toString(),
};

const authRes = await this.httpClient.request({
  method: 'POST',
  url: '/mweb/v1/get_upload_token',
  params: uploadParams,  // ❌ 可能缺少 web_version, da_version, aigc_features
  data: { scene: 2 },
  timeout: 30000
});
```

**问题**: 可能缺少关键参数。

---

## 三、请求头标准格式

### 3.1 浏览器实际使用的请求头

```http
Accept: application/json, text/plain, */*
Accept-Encoding: gzip, deflate, br, zstd
Accept-Language: zh-CN,zh;q=0.9
Cache-Control: no-cache
Content-Type: application/json
Referer: https://jimeng.jianying.com/ai-tool/generate/?type=image
Origin: https://jimeng.jianying.com
Pragma: no-cache

# 核心认证头
appid: 513695
appvr: 8.4.0          # ⚠️ 我们用的是 5.8.0
sign: xxx             # MD5签名
device-time: xxx      # Unix时间戳
sign-ver: 1
pf: 7
lan: zh-Hans          # 或 ZH
loc: cn
app-sdk-version: 48.0.0
tdid:
```

### 3.2 我们代码当前使用的请求头 (HttpClient.ts:92-120)

```typescript
const FAKE_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Encoding": "gzip, deflate, br, zstd",
  "Accept-language": "zh-CN,zh;q=0.9",
  "Cache-control": "no-cache",
  "Content-Type": "application/json",
  "Last-event-id": "undefined",
  Appid: DEFAULT_ASSISTANT_ID,
  Appvr: "5.8.0",  // ❌ 应该是 8.4.0
  "device-time": deviceTime.toString(),
  "sign-ver": "1",
  sign: sign,
  loc: "cn",
  "app-sdk-version": "48.0.0",
  tdid: "",
  lan: "zh-Hans",
  Origin: "https://jimeng.jianying.com",
  Pragma: "no-cache",
  Priority: "u=1, i",
  Referer: "https://jimeng.jianying.com",
  Pf: "7",
  // ... 其他浏览器头部
};
```

**差异**:
1. ✅ 大部分头部正确
2. ❌ `Appvr` 版本号错误（5.8.0 vs 8.4.0）
3. ✅ `sign` 签名机制正确
4. ❌ 多了不必要的 `Last-event-id: "undefined"`

---

## 四、URL参数模式分析

### 4.1 模式1: 完整参数（生成类API）

**适用API**:
- `/mweb/v1/get_experiment_params`
- `/mweb/v1/get_ug_info`
- `/lv/v1/user/get_enable_list`
- `/mweb/v1/video_generate/get_common_config`
- `/mweb/v1/get_asset_list`

**参数格式**:
```
aid=513695
web_version=7.5.0
da_version=3.2.8 或 3.3.3
aigc_features=app_lip_sync
```

部分还包括:
```
device_platform=web
region=CN
web_id=7556785579800331826
```

### 4.2 模式2: 无URL参数（积分类API）

**适用API**:
- `/commerce/v1/benefits/user_credit`
- `/commerce/v1/subscription/user_info`
- `/commerce/v1/subscription/price_list`

**参数**: 无，请求体为空或包含少量参数

### 4.3 模式3: 特殊参数（积分领取）

**适用API**:
- `/commerce/v1/benefits/credit_receive`

**参数格式**:
```
msToken=xxx
a_bogus=xxx
```

---

## 五、关键差异汇总表

| 项目 | 浏览器实际 | 我们代码 | 状态 | 影响 |
|------|-----------|---------|------|------|
| **Appvr版本** | `8.4.0` | `5.8.0` | ❌ 不匹配 | **高** - 可能被识别为旧客户端 |
| **积分API URL参数** | 无 | 有 (aid, device_platform等) | ❌ 多余 | **中** - 可能被忽略或导致错误 |
| **web_version** | `7.5.0` | 缺失 | ❌ 缺少 | **中** - 部分API可能需要 |
| **da_version** | `3.2.8`/`3.3.3` | 缺失 | ❌ 缺少 | **中** - 部分API可能需要 |
| **aigc_features** | `app_lip_sync` | 缺失 | ❌ 缺少 | **低** - 可能是功能标识 |
| **sign签名** | MD5算法 | MD5算法 | ✅ 匹配 | **无** - 正确实现 |
| **积分领取参数** | msToken + a_bogus | aid + device_platform | ❌ 不匹配 | **高** - 可能导致失败 |

---

## 六、修复建议

### 6.1 高优先级修复

#### 1. 更新 Appvr 版本号 (HttpClient.ts:100)

**修改前**:
```typescript
Appvr: "5.8.0",
```

**修改后**:
```typescript
Appvr: "8.4.0",
```

#### 2. 修复积分API参数 (NewCreditService.ts)

**修改前**:
```typescript
// getCredit() - 移除URL参数
const result = await this.httpClient.request({
  method: 'POST',
  url: '/commerce/v1/benefits/user_credit',
  params: creditParams,  // ❌ 移除
  data: {},
  headers: { 'Referer': 'https://jimeng.jianying.com/ai-tool/image/generate' }
});
```

**修改后**:
```typescript
// getCredit() - 无URL参数
const result = await this.httpClient.request({
  method: 'POST',
  url: '/commerce/v1/benefits/user_credit',
  data: {},
  headers: {
    'Referer': 'https://jimeng.jianying.com/ai-tool/image/generate',
    'appid': '513695',
    'appvr': '8.4.0'
  }
});
```

**积分领取API需要研究 msToken 和 a_bogus 的生成机制**。

### 6.2 中优先级修复

#### 3. 添加完整URL参数 (HttpClient.generateRequestParams)

**修改前**:
```typescript
const rqParams: any = {
  "aid": parseInt("513695"),
  "device_platform": "web",
  "region": "CN",
  "web_id": WEB_ID,
  "babi_param": encodeURIComponent(JSON.stringify(babiParam)),
};
```

**修改后**:
```typescript
const rqParams: any = {
  "aid": parseInt("513695"),
  "device_platform": "web",
  "region": "CN",
  "web_id": WEB_ID,
  "web_version": "7.5.0",           // 新增
  "da_version": "3.3.3",            // 新增
  "aigc_features": "app_lip_sync",  // 新增
  "babi_param": encodeURIComponent(JSON.stringify(babiParam)),
};
```

#### 4. 图片上传API参数更新 (ImageUploader.ts)

**修改后**:
```typescript
const uploadParams = {
  aid: "513695",
  web_version: "7.5.0",
  da_version: "3.3.3",
  aigc_features: "app_lip_sync"
};
```

### 6.3 低优先级优化

#### 5. 清理不必要的请求头

**移除**:
```typescript
"Last-event-id": "undefined",  // ❌ 浏览器没有此头
```

---

## 七、待验证项

### 7.1 无法捕获的请求

由于测试环境限制，以下请求未能捕获：

1. **图片生成API** (`/mweb/v1/aigc_draft/generate`)
   - 需要完整输入提示词才能触发
   - 预计使用与其他生成API相同的参数格式

2. **图片上传API** (`/mweb/v1/get_upload_token`)
   - 需要实际上传图片才能触发
   - 预计参数格式类似其他API

### 7.2 需要进一步研究

1. **msToken 和 a_bogus 参数**
   - 用于积分领取API
   - 可能是动态生成的防刷参数
   - 需要分析JS代码了解生成逻辑

2. **da_version 的版本号规律**
   - 不同API使用 `3.2.8` 或 `3.3.3`
   - 需要确定使用规则

3. **babi_param 的完整结构**
   - 仅在生成类API中使用
   - 当前实现可能已正确，需验证

---

## 八、结论

### 关键问题

1. **Appvr 版本号错误** - 使用 `5.8.0` 而非 `8.4.0`，可能导致API识别为旧版本客户端
2. **积分API参数错误** - 添加了不必要的URL参数，浏览器实际不使用
3. **缺少必需参数** - 多数API缺少 `web_version`, `da_version`, `aigc_features`

### 修复优先级

1. ✅ **立即修复**: Appvr 版本号
2. ✅ **立即修复**: 积分API移除URL参数
3. ⚠️ **尽快修复**: 添加 web_version, da_version, aigc_features 参数
4. 📋 **需研究**: msToken 和 a_bogus 生成机制

### 测试建议

1. 修复 Appvr 后立即测试图片生成
2. 验证积分查询是否仍然正常
3. 测试图片上传功能
4. 监控所有API响应状态

---

**报告生成时间**: 2025-01-05
**Token**: 1adad6f6353b778c58f993cd1e9d022e
**Chrome版本**: 141.0.0.0
**抓取请求数**: 136 个 (XHR/Fetch)
