# Data Model: 代码质量优化实体

**Feature**: 008-code-quality-optimization
**Date**: 2025-01-04
**Source**: research.md findings

## Overview

本文档定义3个需要优化的实体的前后对比。这不是数据库模型，而是代码逻辑实体的简化方案。

## Entity 1: ContinuationState (继续生成状态)

### 优化前

```typescript
interface ContinuationState {
  isPartial: boolean;          // 额外状态标志
  targetCount: number;
  finishedCount: number;
  imageUrls: string[];
}

// 双重完成检查逻辑
if (result.status === "completed" && result.imageUrls && result.imageUrls.length >= targetCount) {
  return result.imageUrls;  // Check 1
}

if (result.finishedCount && result.finishedCount >= targetCount && result.imageUrls && result.imageUrls.length > 0) {
  return result.imageUrls;  // Check 2 - 重复！
}
```

### 优化后

```typescript
interface ContinuationState {
  // 移除 isPartial 标志
  targetCount: number;
  finishedCount: number;
  imageUrls: string[];
}

// 单一完成检查
if (result.finishedCount >= targetCount && result.imageUrls && result.imageUrls.length > 0) {
  return result.imageUrls;  // 单一条件，清晰明确
}
```

### 变更说明

| 属性 | 优化前 | 优化后 | 原因 |
|------|--------|--------|------|
| `isPartial` | 存在 | **删除** | 冗余状态，finishedCount 已足够 |
| 完成检查 | 双重条件 | **单一条件** | 简化逻辑，减少冗余 |
| 代码行数 | 67 lines | **~25 lines** | 减少60% |

### 影响范围

- **文件**: `src/api/NewJimengClient.ts`
- **方法**: `generateImage()`, `performSyncContinueGeneration()`
- **测试**: `tests/integration/continue-generation.test.ts`

---

## Entity 2: PromptBuilder (Prompt 构建逻辑)

### 优化前

```typescript
// src/utils/prompt-validator.ts (71 lines - UNUSED)
export class PromptValidator {
  private countPattern = /[一共总].*\d+.*张图?/;

  hasCountDeclaration(prompt: string): boolean {
    return this.countPattern.test(prompt);
  }

  appendCountIfMissing(prompt: string, count: number): string {
    if (this.hasCountDeclaration(prompt)) {
      return prompt;
    }
    return `${prompt}，一共${count}张图`;
  }
  // ... 更多未使用的方法
}

// src/api/NewJimengClient.ts
private buildPromptWithFrames(basePrompt: string, frames: string[]): string {
  // ⚠️ 未调用 promptValidator！
  return `${basePrompt} ${framesText}，一共${frames.length}张图`;
  // 可能重复追加 "一共N张图"
}
```

### 优化后

```typescript
// 删除 src/utils/prompt-validator.ts

// src/api/NewJimengClient.ts
private buildPromptWithFrames(basePrompt: string, frames: string[]): string {
  if (frames.length === 0) return basePrompt;

  const numberedFrames = frames.map((f, i) => `第${i + 1}张：${f}`).join(" ");
  const combined = `${basePrompt} ${numberedFrames}`;

  // 内联检测逻辑（仅5行）
  if (/[一共总].*\d+.*张图?/.test(combined)) {
    return combined;  // 已有声明，不重复
  }
  return `${combined}，一共${frames.length}张图`;
}
```

### 变更说明

| 组件 | 优化前 | 优化后 | 原因 |
|------|--------|--------|------|
| `PromptValidator` 类 | 71 lines | **删除** | 未使用的抽象 |
| 内联检测 | 无 | **5 lines** | 简单正则，无需类 |
| 重复声明检测 | ❌ 无 | ✅ **有** | 避免 "一共N张图" 重复 |

### 影响范围

- **删除文件**: `src/utils/prompt-validator.ts`
- **修改文件**: `src/api/NewJimengClient.ts` (buildPromptWithFrames 方法)
- **测试**: MCP 工具测试验证 prompt 格式

---

## Entity 3: QueryResponse (查询响应)

### 优化前

```typescript
interface QueryResultResponse {
  status: GenerationStatus;
  progress: number;
  imageUrls?: string[];
  videoUrl?: string;
  error?: string;

  // 调试字段（生产环境不应有）
  totalCount?: number;           // Debug 1
  finishedCount?: number;        // Debug 2 (内部使用)
  itemCount?: number;            // Debug 3
  _debug?: {                     // Debug 4 (整个对象)
    hasCacheEntry: boolean;      // → CacheManager.get() call 1
    continuationSent: boolean;   // → CacheManager.get() call 2
    shouldTriggerContinuation: boolean; // → CacheManager.get() call 3
  };
}

// parseQueryResult 中
const cacheEntry = CacheManager.get(id);  // Call 1
result._debug = {
  hasCacheEntry: !!CacheManager.get(id),  // Call 2 (重复!)
  continuationSent: CacheManager.get(id)?.continuationSent, // Call 3
  ...
};
```

### 优化后

```typescript
interface QueryResultResponse {
  status: GenerationStatus;
  progress: number;
  imageUrls?: string[];
  videoUrl?: string;
  error?: string;

  // 仅保留内部使用的必要字段
  finishedCount?: number;  // 用于继续生成判断，非调试字段

  // 移除所有调试字段
  // ❌ totalCount, itemCount, _debug
}

// parseQueryResult 中
const cacheEntry = CacheManager.get(id);  // 单次调用
result = { status, progress, finishedCount };  // 简洁响应

// 调试信息移至日志
if (process.env.DEBUG === 'true') {
  logger.debug('Query result', {
    totalCount, itemCount,
    hasCacheEntry: !!cacheEntry,
    continuationSent: cacheEntry?.continuationSent
  });
}
```

### 变更说明

| 字段 | 优化前 | 优化后 | 原因 |
|------|--------|--------|------|
| `_debug` 对象 | 存在 | **删除** | 生产环境不应泄露内部状态 |
| `totalCount` | 存在 | **删除** | 调试专用 |
| `itemCount` | 存在 | **删除** | 调试专用 |
| `finishedCount` | 调试字段 | **保留** | 内部使用（继续生成判断）|
| CacheManager 调用 | 3次 | **1次** | 减少67%开销 |
| 调试日志 | 无 | **logger.debug()** | 开发环境可见 |

### 影响范围

- **文件**: `src/api/NewJimengClient.ts` (parseQueryResult 方法)
- **类型**: `src/types/api.types.ts` (QueryResultResponse 接口)
- **测试**: 所有查询相关测试（验证响应格式）

---

## Entity Relationships

```
generateImage()
    ↓
    使用 buildPromptWithFrames() [Entity 2: PromptBuilder]
    ↓
    提交任务，返回 historyId
    ↓
    (如果 targetCount > 4)
    ↓
    performSyncContinueGeneration() [Entity 1: ContinuationState]
    ↓
    轮询 parseQueryResult() [Entity 3: QueryResponse]
    ↓
    检查 finishedCount >= targetCount
    ↓
    返回完整 imageUrls
```

## Validation Rules

### Entity 1: ContinuationState

```typescript
// 完成条件验证
assert(result.finishedCount >= targetCount);
assert(result.imageUrls.length > 0);
assert(result.imageUrls.length === targetCount); // 最终验证
```

### Entity 2: PromptBuilder

```typescript
// Prompt 格式验证
const prompt = buildPromptWithFrames("测试", ["场景1", "场景2"]);

// 不应重复
assert(!prompt.match(/一共.*一共/));

// 应包含编号
assert(prompt.includes("第1张"));
assert(prompt.includes("第2张"));

// 应包含总数声明
assert(prompt.includes("一共2张图"));
```

### Entity 3: QueryResponse

```typescript
// 生产环境响应验证
const result = await queryResult(historyId);

// 必须有的字段
assert(result.status !== undefined);
assert(result.progress !== undefined);

// 不应有调试字段（生产环境）
if (process.env.DEBUG !== 'true') {
  assert(result._debug === undefined);
  assert(result.totalCount === undefined);
  assert(result.itemCount === undefined);
}
```

## State Transitions

### Entity 1: ContinuationState

```
[Initial] → submitTask()
    ↓
[pending] → 等待前4张完成
    ↓
[processing] (finishedCount = 4) → 触发继续生成
    ↓
[processing] (finishedCount = 5, 6, 7...) → 继续等待
    ↓
[completed] (finishedCount >= targetCount) → 返回结果
```

**简化后**: 移除 `isPartial` 中间状态，仅依赖 `finishedCount` 数值

---

## Implementation Notes

1. **向后兼容性**: 所有优化不影响公共 API
2. **测试验证**: 现有测试 100% 通过
3. **阶段执行**: 低风险优先 (Entity 3 → Entity 2 → Entity 1)
4. **回滚能力**: 每个实体独立提交，可单独回滚
