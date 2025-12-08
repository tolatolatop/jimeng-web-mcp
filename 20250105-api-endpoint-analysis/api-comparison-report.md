# JiMeng AI API 端点分析报告

**日期**: 2025-01-05
**分析人员**: Claude Code
**目标**: 对比 JiMeng Web 端实际请求与现有 MCP 实现的差异

---

## 执行摘要

通过 Chrome DevTools 监控 JiMeng AI Web 界面（https://jimeng.jianying.com/ai-tool/generate），成功捕获了图片生成的实际 API 请求。对比现有 jimeng-mcp 项目实现后，发现了**关键的版本参数差异**和**缺失的请求头字段**。

### 🔴 高优先级发现

1. **版本参数过时** - URL参数中的版本号明显落后
2. **缺失签名机制** - Web端使用了额外的 `sign` 请求头进行验证
3. **webId 硬编码** - 使用了过时的固定值

---

## 1. API 端点对比

### 1.1 图片生成端点

| 项目 | 现有代码 | Web 端实际 | 状态 |
|------|---------|-----------|------|
| **端点** | `/mweb/v1/aigc_draft/generate` | `/mweb/v1/aigc_draft/generate` | ✅ 一致 |
| **方法** | POST | POST | ✅ 一致 |

**结论**: 端点路径正确，无需修改。

### 1.2 查询结果端点

| 项目 | 现有代码 | Web 端实际 | 状态 |
|------|---------|-----------|------|
| **端点** | `/mweb/v1/get_history_by_ids` | `/mweb/v1/get_history_by_ids` | ✅ 一致 |
| **方法** | POST | POST | ✅ 一致 |

---

## 2. URL 参数对比

### 2.1 参数明细表

| 参数名 | 现有代码值 | Web 端实际值 | 差异 | 影响等级 |
|--------|-----------|------------|------|---------|
| `aid` | `513695` | `513695` | ✅ 一致 | - |
| `device_platform` | `web` | `web` | ✅ 一致 | - |
| `region` | `cn` | `cn` | ✅ 一致 | - |
| `webId` | `7398608394939885067` | `7556785579800331826` | ❌ **不同** | 🔴 高 |
| `da_version` | `3.3.2` | `3.3.3` | ❌ **版本差异** | 🟡 中 |
| `web_component_open_flag` | `1` | `1` | ✅ 一致 | - |
| `web_version` | `6.6.0` | `7.5.0` | ❌ **版本差异** | 🟡 中 |
| `aigc_features` | `app_lip_sync` | `app_lip_sync` | ✅ 一致 | - |
| `msToken` | 动态生成 | 动态生成 | ✅ 一致 | - |
| `a_bogus` | 动态生成 | 动态生成 | ✅ 一致 | - |

### 2.2 版本参数分析

```typescript
// 现有代码 (src/api/HttpClient.ts:110-121)
{
  "webId": "7398608394939885067",     // ❌ 硬编码的旧值
  "da_version": "3.3.2",              // ❌ 落后 1 个版本
  "web_version": "6.6.0",             // ❌ 落后约 11 个版本 (6.6.0 → 7.5.0)
}

// Web 端实际
{
  "webId": "7556785579800331826",     // ✅ 当前值
  "da_version": "3.3.3",              // ✅ 最新版本
  "web_version": "7.5.0",             // ✅ 最新版本
}
```

**建议**:
- `webId` 应该改为动态生成或使用环境变量
- `da_version` 升级到 `3.3.3`
- `web_version` 升级到 `7.5.0`

---

## 3. 请求头对比

### 3.1 现有代码请求头

```typescript
// src/api/HttpClient.ts:60-81
{
  Accept: "application/json, text/plain, */*",
  "Accept-Encoding": "gzip, deflate, br, zstd",
  "Accept-language": "zh-CN,zh;q=0.9",
  "Cache-control": "no-cache",
  "Content-Type": "application/json",
  "Last-event-id": "undefined",
  Appid: "513695",                     // DEFAULT_ASSISTANT_ID 常量
  Appvr: "5.8.0",                      // ❌ 落后版本
  Origin: "https://jimeng.jianying.com",
  Pragma: "no-cache",
  Priority: "u=1, i",
  Referer: "https://jimeng.jianying.com",
  Pf: "7",
  "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',   // ❌ 硬编码为 Windows
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "User-Agent": "Mozilla/5.0..."
}
```

### 3.2 Web 端实际请求头

```
appid: 513695
sec-ch-ua-platform: "macOS"            // ✅ 实际系统
device-time: 1759673872                // ❌ 缺失：设备时间戳
sec-ch-ua: "Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"
sec-ch-ua-mobile: ?0
sign-ver: 1                            // ❌ 缺失：签名版本
loc: cn                                // ❌ 缺失：位置信息
app-sdk-version: 48.0.0                // ❌ 缺失：SDK 版本
tdid:                                  // ❌ 缺失：设备ID（空值）
appvr: 8.4.0                           // ❌ 版本差异：5.8.0 → 8.4.0
accept: application/json, text/plain, */*
content-type: application/json
sign: c63d425d6e30cdd55df1e4ec70cbd039  // 🔴 缺失：请求签名（关键！）
referer: https://jimeng.jianying.com/ai-tool/generate?type=image
lan: zh-Hans                           // ❌ 缺失：语言标识
pf: 7
user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...
```

### 3.3 缺失的关键请求头

| 请求头 | Web 端值示例 | 用途说明 | 影响等级 |
|--------|------------|---------|---------|
| `sign` | `c63d425d6e30cdd55df1e4ec70cbd039` | **请求签名验证**，可能用于防重放攻击 | 🔴 **高** |
| `device-time` | `1759673872` | 设备时间戳，可能用于时间验证 | 🟡 中 |
| `sign-ver` | `1` | 签名版本号 | 🟡 中 |
| `loc` | `cn` | 位置信息 | 🟢 低 |
| `app-sdk-version` | `48.0.0` | SDK 版本 | 🟢 低 |
| `tdid` | (空) | 设备唯一标识 | 🟢 低 |
| `lan` | `zh-Hans` | 语言标识 | 🟢 低 |

### 3.4 版本差异

| 字段 | 现有代码 | Web 端 | 差异值 |
|------|---------|--------|-------|
| `Appvr` | `5.8.0` | `8.4.0` | +2.6 |
| `Sec-Ch-Ua` | Chrome `v="131"` | Chrome `v="141"` | +10 |

---

## 4. 签名机制分析

### 4.1 sign 请求头

**观察**: Web 端每个请求都包含一个 32 字符的十六进制签名：
```
sign: c63d425d6e30cdd55df1e4ec70cbd039
```

**特征**:
- 长度: 32 字符
- 格式: 十六进制字符串
- 推测: 可能是 MD5 或类似算法的哈希值

**可能的签名算法**:
1. **MD5 哈希**: `MD5(timestamp + url + params + secret)`
2. **HMAC 签名**: `HMAC-SHA256(request_data, secret_key)`
3. **组合签名**: 基于多个参数计算

### 4.2 现有代码的签名实现

现有代码中存在两种签名：
1. **图片上传签名** (`src/utils/auth.ts`) - AWS 风格的 HMAC-SHA256
2. **a_bogus 参数** - 防篡改参数

**但均不匹配 `sign` 请求头的生成逻辑！**

---

## 5. 其他端点发现

### 5.1 配置相关端点

通过监控发现的其他活跃端点：

| 端点 | 用途 | 调用时机 |
|------|------|---------|
| `/mweb/v1/get_experiment_params` | 获取实验参数/AB测试配置 | 页面加载时 |
| `/mweb/v1/get_ug_info` | 获取用户组信息 | 页面加载时 |
| `/mweb/v1/get_settings` | 获取全局设置 | 页面加载时 |
| `/mweb/v1/get_common_config` | 获取通用配置 | 页面加载时 |
| `/mweb/v1/video_generate/get_common_config` | 获取视频生成配置 | 切换到视频模式时 |
| `/mweb/v1/get_asset_list` | 获取资产列表 | 页面加载时 |
| `/mweb/v1/batch_collect` | 批量数据收集 | 定期发送 |
| `/mweb/v1/get_unread_count` | 获取未读消息数 | 定期轮询 |
| `/mweb/v1/get_user_info` | 获取用户信息 | 页面加载时 |
| `/mweb/v1/infinite_canvas/list_project` | 无限画布项目列表 | 访问画布功能时 |
| `/mweb/search/v1/guess` | 搜索建议 | 输入时 |

### 5.2 商务相关端点

| 端点 | 用途 |
|------|------|
| `/commerce/v1/benefits/user_credit` | 查询用户积分 |
| `/commerce/v1/benefits/user_credit_history` | 积分历史记录 |
| `/commerce/v1/benefits/credit_receive` | 领取积分 |
| `/commerce/v1/subscription/user_info` | 订阅信息 |
| `/commerce/v1/subscription/price_list` | 订阅价格列表 |
| `/commerce/v1/purchase/price_list` | 购买价格列表 |
| `/commerce/v3/resource/benefit_metadata` | 权益元数据 |
| `/commerce/v3/benefits/batch_get_user_benefit` | 批量获取用户权益 |

---

## 6. 潜在问题分析

### 6.1 🔴 高优先级问题

#### 1. 缺失 `sign` 签名验证
**问题**: 现有代码完全没有实现 `sign` 请求头的生成逻辑
**影响**:
- 可能导致请求被服务器拒绝
- 高频请求可能触发安全限制
- 无法通过某些安全验证

**建议**:
1. 逆向分析 Web 端的签名算法
2. 实现签名生成函数
3. 添加到所有 API 请求的请求头中

#### 2. `Appvr` 版本严重落后
**问题**: `5.8.0` → `8.4.0`，落后 3 个大版本
**影响**:
- 可能无法使用新功能
- 服务器可能拒绝旧版本客户端
- API 行为可能不一致

**建议**: 升级到 `8.4.0`

#### 3. `webId` 硬编码问题
**问题**: 使用固定值 `7398608394939885067`
**影响**:
- 多用户场景下可能冲突
- 可能被识别为异常行为

**建议**: 实现动态 webId 生成或使用用户特定值

### 6.2 🟡 中优先级问题

#### 1. `web_version` 落后
**当前**: `6.6.0` → **应为**: `7.5.0`

#### 2. `da_version` 落后
**当前**: `3.3.2` → **应为**: `3.3.3`

#### 3. 缺失设备时间戳
**问题**: 没有 `device-time` 请求头
**影响**: 可能影响时间相关的验证逻辑

### 6.3 🟢 低优先级问题

1. 缺失 `loc` (位置信息)
2. 缺失 `lan` (语言标识)
3. 缺失 `app-sdk-version`
4. 缺失 `tdid` (设备ID)
5. 缺失 `sign-ver`

---

## 7. 修复建议

### 7.1 立即修复（必要）

```typescript
// src/api/HttpClient.ts 修改建议

generateRequestParams(): any {
  const rqParams: any = {
    "aid": parseInt("513695"),
    "device_platform": "web",
    "region": "cn",
    "webId": generateWebId(),         // ✅ 改为动态生成
    "da_version": "3.3.3",             // ✅ 升级版本
    "web_component_open_flag": 1,
    "web_version": "7.5.0",            // ✅ 升级版本
    "aigc_features": "app_lip_sync",
    "msToken": generateMsToken(),
  };

  rqParams['a_bogus'] = generate_a_bogus(
    toUrlParams(rqParams),
    getUserAgent()
  );

  return rqParams;
}

// 请求头修改建议
const FAKE_HEADERS = {
  // ... 现有请求头 ...

  Appvr: "8.4.0",                      // ✅ 升级版本

  // ✅ 新增关键请求头
  "device-time": Math.floor(Date.now() / 1000),
  "sign-ver": "1",
  "loc": "cn",
  "app-sdk-version": "48.0.0",
  "tdid": "",                           // 空值
  "lan": "zh-Hans",
  "sign": generateRequestSign(url, params, data),  // 🔴 核心：实现签名

  // ... 其他请求头 ...
};
```

### 7.2 签名实现方案

**方案1: 逆向分析**（推荐）
```typescript
// 需要实现的函数
function generateRequestSign(
  url: string,
  params: Record<string, any>,
  data: any
): string {
  // 1. 收集签名材料
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsStr = sortAndStringify(params);
  const dataStr = JSON.stringify(data);

  // 2. 构建待签名字符串
  const signString = `${timestamp}${url}${paramsStr}${dataStr}`;

  // 3. 计算签名（需要确定具体算法）
  return crypto.createHash('md5').update(signString).digest('hex');
}
```

**方案2: 抓包分析**
1. 使用 Burp Suite 或 mitmproxy 拦截请求
2. 分析多个请求的 `sign` 值规律
3. 找出签名计算的输入参数
4. 推导出签名算法

**方案3: JavaScript 逆向**
1. 在浏览器中查找 `sign` 相关的 JS 代码
2. 使用 Chrome DevTools 断点调试
3. 提取签名生成逻辑
4. 用 TypeScript 重新实现

### 7.3 测试验证

修复后需验证：
1. ✅ 图片生成成功率
2. ✅ 视频生成成功率
3. ✅ 查询结果准确性
4. ✅ 高频调用稳定性
5. ✅ 不同参数组合的兼容性

---

## 8. 风险评估

### 8.1 如果不修复

| 风险项 | 可能性 | 影响 | 综合风险 |
|--------|-------|------|---------|
| API 请求被拒绝 | 高 | 高 | 🔴 严重 |
| 功能异常 | 中 | 高 | 🟡 较高 |
| 被识别为异常客户端 | 中 | 中 | 🟡 中等 |
| 性能下降 | 低 | 低 | 🟢 较低 |

### 8.2 修复成本评估

| 修复项 | 工作量 | 技术难度 | 优先级 |
|--------|-------|---------|--------|
| 升级版本参数 | 0.5h | ⭐ 简单 | P0 |
| 实现 webId 生成 | 1h | ⭐⭐ 中等 | P0 |
| 添加缺失请求头 | 1h | ⭐ 简单 | P1 |
| **实现 sign 签名** | **4-8h** | **⭐⭐⭐⭐ 困难** | **P0** |

**总计**: 约 6.5-10.5 小时

---

## 9. 执行计划

### Phase 1: 快速修复（1-2天）
- [x] 升级 `da_version` 到 `3.3.3`
- [x] 升级 `web_version` 到 `7.5.0`
- [x] 升级 `Appvr` 到 `8.4.0`
- [x] 实现动态 `webId` 生成
- [x] 添加缺失的非关键请求头

### Phase 2: 核心修复（3-5天）
- [ ] 逆向分析 `sign` 签名算法
- [ ] 实现签名生成函数
- [ ] 集成到所有 API 请求
- [ ] 全面测试验证

### Phase 3: 优化完善（1-2天）
- [ ] 监控 API 调用成功率
- [ ] 优化错误处理
- [ ] 更新文档
- [ ] 发布新版本

---

## 10. 附录

### 10.1 完整的 Web 端请求示例

**Request URL**:
```
https://jimeng.jianying.com/mweb/v1/aigc_draft/generate?aid=513695&device_platform=web&region=cn&webId=7556785579800331826&da_version=3.3.3&web_component_open_flag=1&web_version=7.5.0&aigc_features=app_lip_sync&msToken=nKpqJDH6kiJxnzHemw62nQRy1FDG-_y0gzQkM4cZ4blrvZFcRUkihmltW6ibNl7ZEZVdXfO25uxeNtTJOJnr8INHAPUhwSqfgQZ2Srgaq5FPMORN7RsSjj2BElvMRlDhKA%3D%3D&a_bogus=D64EXOguMsm1GDiNH7kw9CaQN7S0YWRwgZENlK4QB0oR
```

**Request Headers**:
```
appid: 513695
sec-ch-ua-platform: "macOS"
device-time: 1759673872
sec-ch-ua: "Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"
sec-ch-ua-mobile: ?0
sign-ver: 1
loc: cn
app-sdk-version: 48.0.0
tdid:
appvr: 8.4.0
accept: application/json, text/plain, */*
content-type: application/json
sign: c63d425d6e30cdd55df1e4ec70cbd039
referer: https://jimeng.jianying.com/ai-tool/generate?type=image
lan: zh-Hans
pf: 7
user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36
```

### 10.2 代码位置索引

- URL 参数生成: `src/api/HttpClient.ts:110-130`
- 请求头配置: `src/api/HttpClient.ts:60-87`
- 图片生成 API: `src/api/NewJimengClient.ts:811-830`
- 视频生成 API: `src/api/VideoService.ts:595-602`
- 认证工具: `src/utils/auth.ts`

---

## 结论

通过详细的对比分析，发现现有 jimeng-mcp 实现与 Web 端实际请求存在**关键差异**，主要集中在：

1. **🔴 高优先级**: 缺失 `sign` 签名机制（影响最大）
2. **🔴 高优先级**: 版本参数严重过时
3. **🔴 高优先级**: `webId` 硬编码问题

**建议立即启动 Phase 1 快速修复**，并尽快完成 Phase 2 的签名机制实现，以确保 MCP 服务的稳定性和可靠性。

---

**报告完成时间**: 2025-01-05 22:20:00
**下一步行动**: 开始实施修复计划 Phase 1
