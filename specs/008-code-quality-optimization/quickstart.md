# Quickstart: 代码质量优化验证

**Feature**: 008-code-quality-optimization
**Purpose**: 快速验证3个优化点是否正确实施
**Time**: ~5分钟

## Prerequisites

```bash
cd /Users/lupin/mcp-services/jimeng-mcp
export JIMENG_API_TOKEN="your_token_here"
```

## Step 1: 验证继续生成逻辑简化 (FR-001)

### 测试代码

```bash
# 运行继续生成集成测试
npm test tests/integration/continue-generation.test.ts
```

### 预期结果

```
✅ 测试通过
✅ 7张图片全部返回
✅ 使用简化的单一完成条件
✅ 代码行数从67行减少到~25行
```

### 手动验证

```typescript
// 检查 src/api/NewJimengClient.ts
// 应该只有一个完成检查：
if (result.finishedCount >= targetCount && result.imageUrls && result.imageUrls.length > 0) {
  return result.imageUrls;
}

// 不应出现：
// ❌ isPartial 标志
// ❌ 双重 status=completed 检查
```

**验证点**:
- [ ] 测试通过
- [ ] 无 `isPartial` 变量
- [ ] 单一完成检查
- [ ] 代码简洁（~25行）

---

## Step 2: 验证 PromptValidator 删除 (FR-002)

### 测试代码

```bash
# 检查文件是否存在
ls src/utils/prompt-validator.ts 2>/dev/null && echo "❌ 文件仍存在" || echo "✅ 文件已删除"

# 运行 prompt 构建测试
npm test tests/integration/mcp-image-tools.test.ts
```

### 预期结果

```
✅ prompt-validator.ts 已删除
✅ MCP 工具测试通过
✅ Prompt 不重复 "一共N张图"
```

### 手动验证

```typescript
// 检查 src/api/NewJimengClient.ts buildPromptWithFrames 方法
// 应该有内联检测逻辑：
if (/[一共总].*\d+.*张图?/.test(combined)) {
  return combined;  // 已有声明
}
return `${combined}，一共${frames.length}张图`;
```

**测试用例**:
```bash
# 测试重复检测
node -e "
const prompt = '一共9张图';
const combined = prompt + ' 场景描述';
const hasCount = /[一共总].*\d+.*张图?/.test(combined);
console.log(hasCount ? '✅ 检测到已有声明' : '❌ 未检测到');
"
```

**验证点**:
- [ ] `prompt-validator.ts` 不存在
- [ ] 内联检测逻辑正确
- [ ] 测试通过
- [ ] 不重复追加

---

## Step 3: 验证调试信息清理 (FR-003)

### 测试代码

```bash
# 运行查询响应测试
npm test tests/integration/backward-compatibility.test.ts

# 手动查询测试
node -r dotenv/config -e "
import { getImageResult } from './lib/index.js';

const historyId = 'test-id';
getImageResult(historyId).then(result => {
  console.log('Response fields:', Object.keys(result));
  console.log('Has _debug:', '_debug' in result ? '❌' : '✅');
  console.log('Has totalCount:', 'totalCount' in result ? '❌ (debug field)' : '✅');
  console.log('Has itemCount:', 'itemCount' in result ? '❌ (debug field)' : '✅');
});
"
```

### 预期结果 (生产环境)

```json
{
  "status": "processing",
  "progress": 50,
  "finishedCount": 2
}
```

**不应包含**:
- ❌ `_debug` 对象
- ❌ `totalCount`（非必要时）
- ❌ `itemCount`（非必要时）

### 开发环境验证

```bash
DEBUG=true node -r dotenv/config -e "
// 开发环境应有日志输出
import { getImageResult } from './lib/index.js';
getImageResult('test-id').then(() => {
  console.log('✅ 检查日志是否包含 totalCount, itemCount');
});
"
```

**预期**: logger.debug() 输出包含调试信息

**验证点**:
- [ ] 生产环境无 `_debug`, `totalCount`, `itemCount`
- [ ] 开发环境有日志输出
- [ ] CacheManager.get() 仅调用1次
- [ ] 测试通过

---

## Step 4: 完整集成测试

### 运行所有测试

```bash
# 单元测试
npm test tests/unit/

# 集成测试
npm test tests/integration/

# E2E测试
npm test tests/e2e/

# 构建验证
npm run build && npm run type-check
```

### 预期结果

```
Tests:       XX passed, XX total
Time:        XXs
```

**所有测试必须通过**: ✅ 100%

---

## Step 5: 性能验证

### 代码行数统计

```bash
# 统计优化文件行数
echo "NewJimengClient.ts 行数:"
wc -l src/api/NewJimengClient.ts

echo "prompt-validator.ts 是否存在:"
test -f src/utils/prompt-validator.ts && wc -l src/utils/prompt-validator.ts || echo "✅ 已删除（节省71行）"
```

### CacheManager 调用次数

```bash
# 搜索 CacheManager.get 调用
echo "parseQueryResult 中的 CacheManager.get 调用:"
grep -n "CacheManager.get" src/api/NewJimengClient.ts | grep -A5 "parseQueryResult"
```

**预期**: 仅1次调用

### 手动性能测试

```typescript
// 测试继续生成性能（7张图）
import { generateImage } from './lib/index.js';

console.time('continuation-7-images');
const result = await generateImage({
  frames: ['1', '2', '3', '4', '5', '6', '7'],
  prompt: '性能测试',
  async: false,
  refresh_token: process.env.JIMENG_API_TOKEN
});
console.timeEnd('continuation-7-images');

console.log('✅ 返回数量:', result.length);
console.log('✅ 预期: 7张，实际:', result.length === 7 ? '匹配' : '不匹配');
```

---

## Validation Checklist

### FR-001: 继续生成逻辑简化
- [ ] 测试通过
- [ ] 移除 `isPartial` 标志
- [ ] 单一完成检查
- [ ] 代码行数减少60% (67→~25)
- [ ] 7张图片正确返回

### FR-002: PromptValidator 删除
- [ ] `prompt-validator.ts` 文件不存在
- [ ] 内联检测逻辑正确
- [ ] 不重复追加 "一共N张图"
- [ ] 测试通过
- [ ] 节省71行代码

### FR-003: 调试信息清理
- [ ] 生产环境无 `_debug`, `totalCount`, `itemCount`
- [ ] 开发环境有调试日志
- [ ] CacheManager.get() 仅1次调用
- [ ] 响应 payload 更小
- [ ] 测试通过

### 通用验证
- [ ] 所有单元测试通过
- [ ] 所有集成测试通过
- [ ] 所有E2E测试通过
- [ ] 构建成功
- [ ] 类型检查通过
- [ ] 100% 向后兼容

---

## Rollback Plan

如果发现问题，按优化点独立回滚：

```bash
# 回滚 FR-003（调试信息清理）
git revert <commit-fr-003>

# 回滚 FR-002（PromptValidator）
git revert <commit-fr-002>

# 回滚 FR-001（继续生成逻辑）
git revert <commit-fr-001>
```

---

## Success Criteria

全部验证点通过 = **优化成功** ✅

**预期收益**:
- 代码行数减少 ~116 lines (20-25%)
- CacheManager 调用减少 67% (3次→1次)
- API 响应更简洁
- 代码更易维护
