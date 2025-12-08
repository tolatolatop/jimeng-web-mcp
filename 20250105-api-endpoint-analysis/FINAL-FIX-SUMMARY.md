# JiMeng API 修复总结报告

**日期**: 2025-01-05
**修复目标**: 解决jimeng-web-mcp图像生成API"invalid parameter"错误
**修复状态**: ⚠️ **发现Token认证问题**

---

## 一、执行的修复 Phases

### ✅ Phase 1: 升级 URL 参数版本
- **修改文件**: `src/api/HttpClient.ts`
- **变更内容**:
  - `da_version`: `3.3.2` → `3.3.3`
  - `web_version`: `6.6.0` → `7.5.0`
- **状态**: 已完成

### ✅ Phase 2: 实现 webId 动态生成
- **修改文件**: `src/api/HttpClient.ts:121`
- **变更内容**:
  ```typescript
  // Before
  "webId": "7398608394939885067"  // 硬编码

  // After
  "webId": Date.now().toString() + Math.random().toString().slice(2, 8)  // 动态生成
  ```
- **状态**: 已完成

### ✅ Phase 3: 添加缺失的请求头字段
- **修改文件**: `src/api/HttpClient.ts`
- **新增字段**:
  - `device-time`
  - `sign-ver: "1"`
  - `loc: "cn"`
  - `app-sdk-version: "48.0.0"`
  - `tdid: ""`
  - `lan: "zh-Hans"`
- **状态**: 已完成

### ✅ Phase 4: 实现 sign 签名算法
- **修改文件**: `src/api/HttpClient.ts`
- **算法**: `MD5("9e2c|{URI最后7字符}|7|5.8.0|{时间戳}||11ac")`
- **来源**: 逆向jimeng-free-api项目
- **状态**: 已完成

### ✅ Phase 5: 回退 Appvr 到 5.8.0
- **修改文件**: `src/api/HttpClient.ts:100`
- **变更**: `Appvr: "8.4.0"` → `Appvr: "5.8.0"`
- **原因**: sign算法使用固定版本5.8.0
- **状态**: 已完成

### ✅ Phase 6: 修复图像生成请求体结构

#### Phase 6.1: 修复draft版本
- **修改文件**: `src/api/NewJimengClient.ts:889`
- **变更**: `version: "3.3.2"` → `version: "3.0.2"`
- **状态**: 已完成

#### Phase 6.2: 添加history_option字段
- **修改文件**: `src/api/NewJimengClient.ts:1070-1074`
- **新增**:
  ```typescript
  history_option: {
    type: "",
    id: generateUuid(),
  }
  ```
- **状态**: 已完成

#### Phase 6.3: 修复babi_param编码
- **修改文件**: `src/api/HttpClient.ts:165`
- **变更**: 多次尝试`encodeURI` / `encodeURIComponent` / 不编码
- **最终**: 使用`encodeURIComponent(JSON.stringify(babiParam))`
- **状态**: 已完成

#### Phase 6.4: 移除多余URL参数
- **修改文件**: `src/api/HttpClient.ts:165-171`
- **移除参数**:
  - `da_version`
  - `web_component_open_flag`
  - `web_version`
  - `aigc_features`
  - `msToken`
  - `a_bogus`
- **保留参数** (参考jimeng-free-api):
  ```typescript
  {
    "aid": "513695",
    "device_platform": "web",
    "region": "CN",  // 大写
    "web_id": WEB_ID,  // 动态生成
    "babi_param": encodeURIComponent(JSON.stringify(...))
  }
  ```
- **状态**: 已完成

#### Phase 6.5: 移除多余请求体字段
- **修改**: 移除`gen_type`, `metadata`, `resolution_type`, `intelligent_ratio`
- **状态**: 已完成

#### Phase 6.6: 修复metrics_extra
- **修改文件**: `src/api/NewJimengClient.ts:877-883`
- **变更**:
  ```typescript
  // Before
  {
    promptSource: "custom",
    enterFrom: "click",
    generateId: submitId,
    isRegenerate: false,
  }

  // After (参考jimeng-free-api)
  {
    templateId: "",
    generateCount: 1,
    promptSource: "custom",
    templateSource: "",
    lastRequestId: "",
    originRequestId: "",
  }
  ```
- **状态**: 已完成

---

## 二、参考源对比

### jimeng-free-api (LLM-Red-Team/jimeng-free-api)
- **GitHub**: https://github.com/LLM-Red-Team/jimeng-free-api
- **Stars**: 887
- **最后更新**: 2025-10-04
- **模型支持**: jimeng-3.0
- **测试结果**: ❌ 同样返回"invalid parameter"

### jimeng-free-api-all (zhizinan1997/jimeng-free-api-all)
- **GitHub**: https://github.com/zhizinan1997/jimeng-free-api-all
- **描述**: jimeng-free-api的二次开发
- **模型支持**: jimeng-3.1
- **差异**: 代码与原版基本一致
- **测试结果**: ❌ 同样返回"invalid parameter"

---

## 三、关键发现：Token认证问题

### Token状态测试结果

```json
{
  "ret": "1015",  // ❌ 非正常值（正常应为"0"）
  "errmsg": "check login error",  // ⚠️ 登录检查错误
  "data": {
    "credit": {
      "vip_credit": 0,
      "gift_credit": 0,
      "purchase_credit": 0
    }
  }
}
```

### 问题分析

1. **积分查询API可以响应** - Token至少部分有效
2. **ret=1015 "check login error"** - 登录状态异常
3. **积分全为0** - 可能账号状态不正常

### 可能原因

| 原因 | 可能性 | 说明 |
|------|-------|------|
| Token过期 | 高 | sessionid可能已过期需要更新 |
| 账号封禁/限制 | 中 | 积分全为0可能表示账号受限 |
| 需要重新登录 | 高 | check login error提示需要重新认证 |
| Cookie不完整 | 中 | 可能需要更多Cookie字段 |

---

## 四、测试脚本

### 1. test-minimal-jimeng-api.js
完全按照jimeng-free-api的实现，结果：**invalid parameter**

### 2. test-token-validity.js
测试Token有效性，发现：**ret=1015, check login error**

### 3. test-exact-match.js
完全复制jimeng-free-api-all结构，结果：**invalid parameter**

---

## 五、结论与建议

### 核心问题
**Token认证失败** - 图片生成API返回"invalid parameter"的根本原因可能是Token状态异常（ret=1015）而非请求参数问题。

### 已完成的工作
✅ 所有URL参数已对齐jimeng-free-api
✅ 所有请求头已对齐jimeng-free-api
✅ 请求体结构已对齐jimeng-free-api
✅ sign签名算法已实现

### 待解决问题
❌ Token认证异常（ret=1015）
❌ 积分为0
❌ 需要获取有效的sessionid

### 下一步建议

1. **更新Token**:
   - 访问 https://jimeng.jianying.com 重新登录
   - 获取最新的sessionid
   - 更新.env文件中的JIMENG_API_TOKEN

2. **领取积分**:
   - 测试 `/commerce/v1/benefits/credit_receive` API
   - 尝试领取今日免费积分

3. **使用Chrome DevTools**:
   - 手动在浏览器中生成一张图片
   - 捕获完整的网络请求
   - 对比Cookie、Headers等完整信息
   - 确认是否有额外的认证Cookie字段

4. **测试其他API**:
   - 尝试其他端点（如查询历史记录）
   - 确认Token是否完全失效

---

## 六、修改文件清单

| 文件 | 修改内容 | 行号 |
|-----|---------|-----|
| `src/api/HttpClient.ts` | 导入WEB_ID常量 | 9 |
| `src/api/HttpClient.ts` | 实现sign生成方法 | 44-66 |
| `src/api/HttpClient.ts` | 回退Appvr到5.8.0 | 100 |
| `src/api/HttpClient.ts` | 添加sign相关请求头 | 101-107 |
| `src/api/HttpClient.ts` | 简化generateRequestParams | 146-174 |
| `src/api/NewJimengClient.ts` | 修复draft version | 889 |
| `src/api/NewJimengClient.ts` | 移除gen_type和metadata | 893-908 |
| `src/api/NewJimengClient.ts` | 修复metrics_extra | 877-883 |
| `src/api/NewJimengClient.ts` | 移除resolution_type | 996-1001, 1064-1069 |
| `src/api/NewJimengClient.ts` | 添加history_option | 1070-1074 |
| `src/api/NewJimengClient.ts` | 传递model和hasRefImage参数 | 817 |

---

## 七、测试命令

```bash
# 构建项目
npm run build

# 测试Token有效性
node test-token-validity.js

# 测试图片生成
node test-image-generation.js

# 测试最小化jimeng-free-api实现
node test-minimal-jimeng-api.js
```

---

**报告生成时间**: 2025-01-05 23:20
**下一步行动**: 获取有效Token或使用Chrome DevTools捕获真实请求
