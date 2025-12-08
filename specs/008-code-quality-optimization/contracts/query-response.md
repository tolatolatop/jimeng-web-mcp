# Contract: 查询响应格式

**Feature**: 008-code-quality-optimization
**Entity**: QueryResponse
**Method**: `parseQueryResult()`

## Contract Specification

### Input

```typescript
interface QueryInput {
  historyId: string;  // 任务ID（图片或视频）
}
```

### Output (优化后)

```typescript
interface QueryResultResponse {
  // 必需字段
  status: GenerationStatus;  // pending | processing | completed | failed
  progress: number;          // 0-100

  // 条件字段
  imageUrls?: string[];      // 完成时（图片任务）
  videoUrl?: string;         // 完成时（视频任务）
  error?: string;            // 失败时

  // 内部使用字段
  finishedCount?: number;    // 用于继续生成判断（非调试）

  // ❌ 移除的调试字段
  // totalCount?: number;
  // itemCount?: number;
  // _debug?: {...};
}
```

### Behavior Changes

**优化前** (问题):
```typescript
// ❌ 泄露内部调试信息到生产环境
result = {
  status, progress, imageUrls,
  totalCount,        // Debug 1
  itemCount,         // Debug 2
  _debug: {          // Debug 3
    hasCacheEntry: !!CacheManager.get(id),      // Cache call 1
    continuationSent: CacheManager.get(id)?.continuationSent,  // Cache call 2
    shouldTriggerContinuation: ...  // Cache call 3
  }
};
```

**优化后** (正确):
```typescript
// ✅ 仅返回必要字段
const cacheEntry = CacheManager.get(id);  // 单次调用
result = {
  status, progress,
  finishedCount,  // 内部使用（继续生成判断）
  imageUrls: status === 'completed' ? imageUrls : undefined
};

// ✅ 调试信息移至日志
if (process.env.DEBUG === 'true') {
  logger.debug('Query result', {
    historyId: id,
    totalCount, itemCount,
    hasCacheEntry: !!cacheEntry,
    continuationSent: cacheEntry?.continuationSent
  });
}
```

### Validation Rules

```typescript
// 1. 必需字段存在
assert(result.status !== undefined);
assert(result.progress !== undefined);
assert(result.progress >= 0 && result.progress <= 100);

// 2. 条件字段正确性
if (result.status === 'completed') {
  assert(result.imageUrls || result.videoUrl);  // 至少一个
}
if (result.status === 'failed') {
  assert(result.error !== undefined);
}

// 3. 生产环境无调试字段
if (process.env.DEBUG !== 'true') {
  assert(result._debug === undefined);
  assert(result.totalCount === undefined);
  assert(result.itemCount === undefined);
}

// 4. 开发环境有调试日志
if (process.env.DEBUG === 'true') {
  // logger.debug 应被调用
}
```

### Test Cases

| Scenario | Status | Expected Fields | Forbidden Fields |
|----------|--------|-----------------|------------------|
| 任务进行中 | `processing` | `status`, `progress` | `_debug`, `totalCount` |
| 图片完成 | `completed` | `status`, `progress`, `imageUrls` | `_debug`, `totalCount` |
| 视频完成 | `completed` | `status`, `progress`, `videoUrl` | `_debug`, `itemCount` |
| 任务失败 | `failed` | `status`, `progress`, `error` | `_debug` |
| 开发模式 | any | 所有 + logger.debug 输出 | - |

### CacheManager Call Optimization

**优化前**:
```typescript
// 每次查询调用3次
Line 524: const entry1 = CacheManager.get(id);  // 1
Line 525: const entry2 = CacheManager.get(id);  // 2
Line 526: const entry3 = CacheManager.get(id);  // 3
```

**优化后**:
```typescript
// 仅调用1次
const cacheEntry = CacheManager.get(id);  // 单次调用
// 复用 cacheEntry 变量
```

**性能提升**: 减少67% 缓存访问（3次→1次）

### Contract Test

```typescript
describe('Query Response Contract', () => {
  it('should not include debug fields in production', async () => {
    // Given: 生产环境（无DEBUG）
    delete process.env.DEBUG;

    // When: 查询任务状态
    const result = await getImageResult(historyId);

    // Then: 无调试字段
    expect(result._debug).toBeUndefined();
    expect(result.totalCount).toBeUndefined();
    expect(result.itemCount).toBeUndefined();

    // But: 必要字段存在
    expect(result.status).toBeDefined();
    expect(result.progress).toBeDefined();
  });

  it('should log debug info when DEBUG=true', async () => {
    // Given: 开发环境
    process.env.DEBUG = 'true';
    const logSpy = jest.spyOn(logger, 'debug');

    // When: 查询任务
    await getImageResult(historyId);

    // Then: 日志被调用
    expect(logSpy).toHaveBeenCalledWith(
      'Query result',
      expect.objectContaining({
        historyId, totalCount, itemCount
      })
    );
  });

  it('should call CacheManager.get only once', async () => {
    const getSpy = jest.spyOn(CacheManager, 'get');

    await getImageResult(historyId);

    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it('should include finishedCount for internal use', async () => {
    const result = await getImageResult(historyId);

    // finishedCount 用于继续生成判断，非调试字段
    expect(typeof result.finishedCount).toBe('number');
  });
});
```

### Error Conditions

| Condition | Response | Debug Behavior |
|-----------|----------|----------------|
| Invalid historyId | `{ status: 'failed', error: '无效的historyId' }` | logger.error() |
| API error | `{ status: 'failed', error: API消息 }` | logger.error() |
| Timeout | `{ status: 'processing', progress: last }` | logger.warn() |

### Performance Requirements

- **CacheManager 调用**: 1次（优化前3次）
- **响应 payload**: 减少约30%（移除调试字段）
- **日志开销**: 仅开发环境，生产零开销

### Backward Compatibility

- ✅ 必要字段不变（status, progress, imageUrls, videoUrl, error）
- ⚠️ 移除调试字段（_debug, totalCount, itemCount）
  - ✅ 这些字段未在文档中承诺
  - ✅ 现有测试不依赖调试字段
  - ✅ 用户代码通常只关心 status + imageUrls
- ✅ `finishedCount` 保留（内部使用）

---

**实现文件**: `src/api/NewJimengClient.ts` (parseQueryResult 方法)
**类型文件**: `src/types/api.types.ts` (QueryResultResponse 接口)
**测试文件**: `tests/integration/backward-compatibility.test.ts`
**性能提升**: CacheManager 调用减少67%，响应 payload 减少~30%
