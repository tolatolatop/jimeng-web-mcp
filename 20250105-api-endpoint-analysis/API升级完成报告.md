# JiMeng API 端点升级完成报告

**日期**: 2025-01-05
**Token**: 1adad6f6353b778c58f993cd1e9d022e (已更新并验证)

## 一、升级概述

本次升级对所有 JiMeng API 端点进行了统一的请求格式规范化，确保所有 API 调用使用最新的参数格式和签名机制。

### 升级范围

1. ✅ **图片上传 API** (`/mweb/v1/get_upload_token`)
2. ✅ **积分查询 API** (`/commerce/v1/benefits/user_credit`)
3. ✅ **积分领取 API** (`/commerce/v1/benefits/credit_receive`)
4. ✅ **图片生成 API** (`/mweb/v1/aigc_draft/generate`) - 已在前序验证
5. ✅ **视频生成 API** (`/mweb/v1/aigc_draft/generate`) - 已测试验证

---

## 二、详细修改记录

### 2.1 ImageUploader.ts - 图片上传认证

**文件位置**: `src/api/ImageUploader.ts:276-290`

**问题**: 使用了过时的硬编码 URL 参数 `da_version=3.2.2`

#### 修改前:
```typescript
const authRes = await this.httpClient.request({
  method: 'POST',
  url: '/mweb/v1/get_upload_token?aid=513695&da_version=3.2.2&aigc_features=app_lip_sync',
  data: { scene: 2 },
  timeout: 30000
});
```

#### 修改后:
```typescript
// 使用标准请求参数（不需要babi_param，因为这不是生成API）
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
  data: { scene: 2 },
  timeout: 30000
});
```

**改进点**:
- ✅ 移除过时的 `da_version` 参数
- ✅ 使用标准化的参数对象
- ✅ 添加必需的 `device_platform`, `region`, `web_id` 参数
- ✅ 参数通过 `params` 传递，确保正确的签名计算

---

### 2.2 NewCreditService.ts - 积分管理 API

**文件位置**: `src/api/NewCreditService.ts`

**问题**: 积分 API 调用完全缺少 URL 参数

#### 2.2.1 getCredit() 方法 (lines 40-54)

**修改前**:
```typescript
const result = await this.httpClient.request({
  method: 'POST',
  url: '/commerce/v1/benefits/user_credit',
  data: {},
  headers: { 'Referer': 'https://jimeng.jianying.com/ai-tool/image/generate' }
});
```

**修改后**:
```typescript
// 积分API需要基础URL参数（不需要babi_param）
const creditParams = {
  aid: "513695",
  device_platform: "web",
  region: "CN",
  web_id: Date.now().toString(),
};

const result = await this.httpClient.request({
  method: 'POST',
  url: '/commerce/v1/benefits/user_credit',
  params: creditParams,
  data: {},
  headers: { 'Referer': 'https://jimeng.jianying.com/ai-tool/image/generate' }
});
```

#### 2.2.2 receiveCredit() 方法 (lines 75-88)

**修改前**:
```typescript
const credit = await this.httpClient.request({
  method: 'POST',
  url: '/commerce/v1/benefits/credit_receive',
  data: { 'time_zone': 'Asia/Shanghai' },
  headers: { 'Referer': 'https://jimeng.jianying.com/ai-tool/image/generate' }
});
```

**修改后**:
```typescript
// 积分API需要基础URL参数（不需要babi_param）
const creditParams = {
  aid: "513695",
  device_platform: "web",
  region: "CN",
  web_id: Date.now().toString(),
};

const credit = await this.httpClient.request({
  method: 'POST',
  url: '/commerce/v1/benefits/credit_receive',
  params: creditParams,
  data: { 'time_zone': 'Asia/Shanghai' },
  headers: { 'Referer': 'https://jimeng.jianying.com/ai-tool/image/generate' }
});
```

**改进点**:
- ✅ 添加完整的 URL 参数对象
- ✅ 使用与其他 API 一致的参数格式
- ✅ 确保签名计算正确

---

### 2.3 HttpClient.ts - 核心签名机制

**文件位置**: `src/api/HttpClient.ts`

**已实现功能** (前序已完成):
- ✅ MD5 签名生成 (`generateSign()` method)
- ✅ 标准请求头注入 (包括 `sign`, `device-time`, `Appvr` 等)
- ✅ 请求参数生成器 (`generateRequestParams()`)

#### generateRequestParams() 实现 (lines 151-174):
```typescript
generateRequestParams(model?: string, hasRefImage?: boolean): any {
  const actualModel = model || 'jimeng-4.0';

  // 构建babi_param（参考jimeng-free-api-all）
  const babiParam = {
    "scenario": "image_video_generation",
    "feature_key": hasRefImage ? "to_image_referenceimage_generate" : "aigc_to_image",
    "feature_entrance": "to_image",
    "feature_entrance_detail": hasRefImage
      ? "to_image-referenceimage-byte_edit"
      : `to_image-${actualModel}`,
  };

  // 完全按照jimeng-free-api-all的简化参数结构
  const rqParams: any = {
    "aid": parseInt("513695"),
    "device_platform": "web",
    "region": "CN",
    "web_id": WEB_ID,
    "babi_param": encodeURIComponent(JSON.stringify(babiParam)),
  };

  return rqParams;
}
```

**说明**:
- 此方法专门用于**生成类 API**（图片/视频生成）
- 包含 `babi_param` 参数（业务追踪参数）
- **非生成类 API**（如上传、积分）不使用此方法，而是手动构建基础参数

---

### 2.4 VideoService.ts - 视频生成 API

**文件位置**: `src/api/VideoService.ts:595, 665, 803`

**当前状态**: ✅ 已正确使用 `generateRequestParams()`

#### 关键代码:
```typescript
// Line 595 - Text-to-Video
const requestParams = this.httpClient.generateRequestParams();

// Line 665 - Multi-frame Video
const requestParams = this.httpClient.generateRequestParams();

// Line 803 - Main Reference Video
const requestParams = this.httpClient.generateRequestParams();
```

**验证结果**:
- ✅ 视频生成测试通过（已生成猫咪视频）
- ✅ 使用正确的 URL 参数格式
- ✅ 包含必需的 `babi_param`

---

### 2.5 NewJimengClient.ts - 图片生成 API

**文件位置**: `src/api/NewJimengClient.ts:238, 431, 465, 817`

**当前状态**: ✅ 已在前序修复中完成

#### 关键代码:
```typescript
// Line 238 - Query results
const requestParams = this.httpClient.generateRequestParams();

// Line 817 - Image generation
const requestParams = this.httpClient.generateRequestParams(apiParams.model_name, hasRefImage);
```

**验证结果**:
- ✅ 图片生成测试通过（MCP 工具生成 4 张图片成功）
- ✅ 使用正确的草稿版本 `"3.0.2"`
- ✅ 包含 `history_option` 字段
- ✅ 正确的 `metrics_extra` 结构

---

## 三、统一参数格式规范

### 3.1 基础 URL 参数（所有 API）

```typescript
{
  aid: "513695",              // 应用ID
  device_platform: "web",     // 平台标识
  region: "CN",               // 地区
  web_id: Date.now().toString() // 动态web_id（时间戳）
}
```

**适用范围**:
- ✅ 图片上传认证 (`/mweb/v1/get_upload_token`)
- ✅ 积分查询 (`/commerce/v1/benefits/user_credit`)
- ✅ 积分领取 (`/commerce/v1/benefits/credit_receive`)
- ✅ 所有生成类 API (下方扩展格式)

---

### 3.2 生成类 API 扩展参数

```typescript
{
  aid: parseInt("513695"),
  device_platform: "web",
  region: "CN",
  web_id: WEB_ID,
  babi_param: encodeURIComponent(JSON.stringify({
    scenario: "image_video_generation",
    feature_key: hasRefImage ? "to_image_referenceimage_generate" : "aigc_to_image",
    feature_entrance: "to_image",
    feature_entrance_detail: hasRefImage
      ? "to_image-referenceimage-byte_edit"
      : `to_image-${model}`
  }))
}
```

**适用范围**:
- ✅ 图片生成 (`/mweb/v1/aigc_draft/generate` with `draft_type: 1`)
- ✅ 视频生成 (`/mweb/v1/aigc_draft/generate` with `draft_type: 2`)
- ✅ 结果查询 (`/mweb/v1/get_history_by_ids`)

---

### 3.3 请求头标准化

所有请求包含以下关键头部：

```typescript
{
  "sign": MD5签名,              // MD5(9e2c|{uri后7字符}|7|5.8.0|{时间戳}||11ac)
  "device-time": 时间戳字符串,
  "sign-ver": "1",
  "Appvr": "5.8.0",           // 与sign版本一致
  "Appid": "5001",            // 默认助手ID
  "Cookie": `sessionid=${TOKEN}`,
  // ... 其他标准头部
}
```

---

## 四、测试验证记录

### 4.1 Token 验证
```bash
✅ Token: 1adad6f6353b778c58f993cd1e9d022e
✅ 积分余额: 30
✅ 响应: ret="0" (成功)
```

### 4.2 图片生成测试
```bash
✅ 直接 API 调用: 成功生成 4 张图片
✅ MCP 工具调用: 成功生成 4 张猫咪图片
✅ 连续生成支持: 自动触发 (count > 4)
```

### 4.3 视频生成测试
```bash
✅ 视频生成: 成功生成猫咪视频
✅ 任务 ID: h1fd1sgg****
✅ 视频 URL: 已获取
```

### 4.4 API 端点验证状态

| API 端点 | 状态 | 修改内容 | 测试结果 |
|---------|------|---------|---------|
| `/mweb/v1/get_upload_token` | ✅ 已修复 | 添加标准URL参数 | 未单独测试，图片生成含上传 |
| `/commerce/v1/benefits/user_credit` | ✅ 已修复 | 添加URL参数 | 间接验证（Token验证） |
| `/commerce/v1/benefits/credit_receive` | ✅ 已修复 | 添加URL参数 | 未单独测试 |
| `/mweb/v1/aigc_draft/generate` (图片) | ✅ 已验证 | 前序已修复 | ✅ 通过 |
| `/mweb/v1/aigc_draft/generate` (视频) | ✅ 已验证 | 使用正确参数 | ✅ 通过 |
| `/mweb/v1/get_history_by_ids` | ✅ 已验证 | 使用正确参数 | 间接验证（查询结果） |

---

## 五、关键改进点总结

### 5.1 移除的过时参数
- ❌ `da_version=3.2.2` - 已从 ImageUploader 移除
- ❌ 硬编码 URL 字符串 - 统一使用参数对象

### 5.2 新增的必需参数
- ✅ `device_platform: "web"`
- ✅ `region: "CN"`
- ✅ `web_id: Date.now().toString()`
- ✅ 生成类 API 的 `babi_param`

### 5.3 参数传递方式标准化
- ✅ URL 参数通过 `params` 对象传递
- ✅ 请求体通过 `data` 对象传递
- ✅ 确保签名计算基于正确的参数

### 5.4 代码一致性提升
- ✅ 所有 API 使用统一的参数构建模式
- ✅ 生成类 API 统一使用 `generateRequestParams()`
- ✅ 非生成类 API 使用一致的基础参数对象

---

## 六、后续建议

### 6.1 需要进一步验证的功能
1. **积分领取 API** - 建议进行单独的积分领取测试
2. **图片上传 API** - 虽然图片生成成功，建议单独测试上传流程
3. **错误处理** - 验证参数错误时的响应格式

### 6.2 监控要点
1. 关注 JiMeng 是否有新的 API 格式变更
2. 定期验证 `sign` 签名算法是否有更新
3. 监控 `Appvr` 版本号变化（当前 5.8.0）

### 6.3 代码维护
1. 保持 `HttpClient.generateRequestParams()` 作为唯一的参数生成点
2. 避免在各个服务中重复构建参数
3. 统一管理版本号和应用 ID 等常量

---

## 七、结论

本次升级成功完成了所有 JiMeng API 端点的参数格式规范化：

✅ **ImageUploader** - 上传认证 API 已更新
✅ **NewCreditService** - 积分 API 已更新
✅ **NewJimengClient** - 图片生成 API 已验证
✅ **VideoService** - 视频生成 API 已验证
✅ **HttpClient** - 核心签名机制已完善

**所有修改均已完成构建，项目运行正常。**

---

**报告生成时间**: 2025-01-05
**Token**: 1adad6f6353b778c58f993cd1e9d022e
**项目构建状态**: ✅ 成功
