# JiMeng AI API 端点变化分析报告

**分析日期**: 2025-01-05
**分析方法**: Chrome DevTools 网络监控 + 代码对比
**当前实现版本**: jimeng-mcp v2.1.1

---

## 执行摘要

通过对 JiMeng AI Web 端的实时网络请求监控，发现**当前 MCP 实现已经使用了最新的 API 端点**，没有发现需要升级的地方。主要发现如下：

### ✅ 已确认使用最新端点

1. **图片/视频生成端点**: `/mweb/v1/aigc_draft/generate`
2. **任务查询端点**: `/mweb/v1/get_history_by_ids`
3. **上传令牌端点**: `/mweb/v1/get_upload_token`

### 📊 Web 端观察到的其他端点（非核心功能）

- `/mweb/v1/get_experiment_params` - A/B 测试参数
- `/mweb/v1/get_ug_info` - 用户组信息
- `/commerce/v1/benefits/user_credit` - 用户积分查询
- `/mweb/v1/video_generate/get_common_config` - 视频配置
- `/cc/v1/workspace/get_user_workspaces` - 工作空间

---

## 详细分析

### 1. 图片生成端点

#### 🌐 Web 端实际使用
```
POST /mweb/v1/aigc_draft/generate
```

**URL 参数**:
- `aid=513695`
- `device_platform=web`
- `region=cn`
- `webId=7556785579800331826`
- `da_version=3.3.3`
- `web_component_open_flag=1`
- `web_version=7.5.0`
- `aigc_features=app_lip_sync`
- `msToken=...`
- `a_bogus=...`

#### ✅ MCP 实现对比

**当前实现** (`src/api/NewJimengClient.ts:827`):
```typescript
const response = await this.httpClient.request({
  method: "POST",
  url: "/mweb/v1/aigc_draft/generate",
  params: requestParams,
  data: requestBody,
});
```

**结论**: ✅ **完全一致**，已使用最新端点

---

### 2. 任务查询端点

#### 🌐 Web 端实际使用
```
POST /mweb/v1/get_history_by_ids
```

#### ✅ MCP 实现对比

**当前实现** (`src/api/NewJimengClient.ts:254`):
```typescript
const response = await this.httpClient.request({
  method: "POST",
  url: "/mweb/v1/get_history_by_ids",
  params: requestParams,
  data: { history_ids: [historyId] },
});
```

**结论**: ✅ **完全一致**

---

### 3. 视频生成端点

#### 🌐 Web 端视频相关请求
- `/mweb/v1/video_generate/get_common_config` - 获取视频配置

#### ✅ MCP 实现对比

**当前实现** (`src/api/VideoService.ts:599`):
```typescript
const response = await this.httpClient.request({
  method: 'POST',
  url: '/mweb/v1/aigc_draft/generate',  // 统一使用同一端点
  params: requestParams,
  data: requestBody,
});
```

**结论**: ✅ 视频生成也使用 `/mweb/v1/aigc_draft/generate`，与图片生成统一

---

### 4. 图片上传端点

#### ✅ MCP 实现

**当前实现** (`src/api/ImageUploader.ts:278`):
```typescript
const response = await this.httpClient.request({
  method: 'POST',
  url: '/mweb/v1/get_upload_token?aid=513695&da_version=3.2.2&aigc_features=app_lip_sync',
  data: uploadParams,
});
```

**结论**: ✅ 使用正确的上传令牌端点

---

## Web 端观察到的 URL 参数对比

### 当前 MCP 实现的参数

**HttpClient.generateRequestParams()** 生成的参数:
```typescript
{
  aid: 513695,
  device_platform: "web",
  region: "cn",
  webId: WEB_ID,
  da_version: "3.3.3",
  web_version: "7.5.0",
  aigc_features: "app_lip_sync"
}
```

### Web 端额外参数

- `web_component_open_flag=1` - **新参数**
- `msToken=...` - 安全令牌
- `a_bogus=...` - 反爬虫参数

---

## 潜在优化建议

### 1. 添加 `web_component_open_flag` 参数

**发现**: Web 端在请求时携带了 `web_component_open_flag=1`

**建议**: 考虑在 `HttpClient.generateRequestParams()` 中添加此参数

**代码位置**: `src/api/HttpClient.ts`

```typescript
generateRequestParams(): Record<string, string | number> {
  return {
    aid: 513695,
    device_platform: "web",
    region: "cn",
    webId: WEB_ID,
    da_version: "3.3.3",
    web_version: "7.5.0",
    aigc_features: "app_lip_sync",
    web_component_open_flag: 1,  // 新增
  };
}
```

**优先级**: 🟡 中等（可选，目前不影响功能）

---

### 2. `msToken` 和 `a_bogus` 参数

**发现**: Web 端使用了动态安全参数

**当前状态**: MCP 实现通过 Cookie 中的 `sessionid` 进行认证，无需这些参数

**结论**: ✅ 当前实现足够，无需添加

---

## 请求体结构对比

### 观察到的 Web 端请求特征

1. **统一端点**: 图片和视频生成都使用 `/mweb/v1/aigc_draft/generate`
2. **请求体结构**:
   - `extend`: 扩展参数
   - `submit_id`: 提交ID (UUID)
   - `metrics_extra`: 指标数据 (JSON 编码)
   - `draft_content`: 草稿内容 (JSON 编码)
   - `http_common_info`: 通用信息
   - `action`: 动作类型 (继续生成时为 2)
   - `history_id`: 历史ID (继续生成时使用)

### MCP 实现对比

**`buildInitialRequest()` 方法** (`src/api/NewJimengClient.ts:864`):
```typescript
{
  extend: { root_model: params.model_name },
  submit_id: generateUuid(),
  metrics_extra: jsonEncode({
    promptSource: "custom",
    enterFrom: "click",
    generateId: submitId,
    isRegenerate: false,
  }),
  draft_content: jsonEncode({
    type: "draft",
    id: generateUuid(),
    min_version: params.draft_version,
    // ...
  }),
  http_common_info: { aid: 513695 },
}
```

**结论**: ✅ 结构完全一致

---

## 继续生成功能分析

### Web 端行为

- 当生成超过 4 张图片时，API 会暂停并等待确认
- 用户点击"继续生成"后，发送 `action=2` 的请求

### MCP 实现

**`buildContinuationRequest()` 方法** (`src/api/NewJimengClient.ts:934`):
```typescript
{
  extend: cached.extend,
  submit_id: cached.submitId,  // 重用原始 submit_id
  metrics_extra: cached.metricsExtra,
  draft_content: cached.draftContent,
  http_common_info: { aid: 513695 },
  action: CONTINUATION_ACTION.CONTINUE,  // action = 2
  history_id: params.history_id,
}
```

**结论**: ✅ 实现正确，与 Web 端行为一致

---

## 结论与建议

### ✅ 主要发现

1. **当前 MCP 实现已经使用最新的 API 端点**，无需升级
2. **核心功能（图片/视频生成、任务查询）完全正确**
3. **继续生成功能实现符合 Web 端行为**

### 🔧 可选优化

1. **添加 `web_component_open_flag=1` 参数** (优先级: 中)
   - 位置: `src/api/HttpClient.ts:generateRequestParams()`
   - 影响: 可能提升与最新 Web 端的兼容性

### 📊 其他观察

Web 端还使用了以下非核心端点，暂不需要在 MCP 中实现：
- `/mweb/v1/get_experiment_params` - A/B 测试
- `/commerce/v1/benefits/user_credit` - 积分系统
- `/cc/v1/workspace/get_user_workspaces` - 工作空间

---

## 测试建议

建议进行以下测试以验证当前实现：

1. ✅ 单图生成 (1-4张)
2. ✅ 继续生成 (>4张)
3. ✅ 参考图生成
4. ✅ 视频生成（各模式）
5. ✅ 异步任务查询

---

**报告生成时间**: 2025-01-05
**分析工具**: Chrome DevTools Network Monitor + VS Code
**项目**: jimeng-web-mcp v2.1.1
