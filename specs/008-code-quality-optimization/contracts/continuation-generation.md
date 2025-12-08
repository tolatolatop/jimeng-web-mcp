# Contract: 继续生成行为

**Feature**: 008-code-quality-optimization
**Entity**: ContinuationState
**Method**: `generateImage()` with continuation

## Contract Specification

### Input

```typescript
interface ContinuationInput {
  historyId: string;      // 任务ID
  targetCount: number;    // 目标图片总数（由API从prompt识别）
}
```

### Output

```typescript
interface ContinuationOutput {
  imageUrls: string[];    // 所有生成的图片URL
}
```

### Behavior

**正常流程**:
1. 当 `targetCount > 4` 时触发继续生成
2. 生成前4张图片后暂停
3. 发送单次 `action=2` 继续请求
4. API 自动完成剩余所有图片（非逐批）
5. 轮询直到 `finishedCount >= targetCount`
6. 返回完整 `imageUrls`

**简化逻辑** (优化重点):
- ✅ 使用单一完成条件: `finishedCount >= targetCount && imageUrls.length > 0`
- ❌ 移除 `isPartial` 标志
- ❌ 移除重复的 `status=completed` 检查

### Validation Rules

```typescript
// 1. 返回数量匹配
assert(imageUrls.length === targetCount);

// 2. 所有URL有效
imageUrls.forEach(url => {
  assert(url.startsWith('https://'));
  assert(url.includes('byteimg.com'));
});

// 3. 无重复URL
const uniqueUrls = new Set(imageUrls);
assert(uniqueUrls.size === imageUrls.length);
```

### Error Conditions

| Condition | Error Type | Message |
|-----------|------------|---------|
| `targetCount <= 4` | N/A | 不触发继续生成 |
| API 返回失败 | Error | "继续生成失败: {error}" |
| 轮询超时 | Error | "继续生成超时" |
| 返回数量不足 | Error | "预期{targetCount}张，实际{actual}张" |

### Contract Test

```typescript
describe('Continuation Generation Contract', () => {
  it('should return all images with single completion check', async () => {
    // Given: 请求7张图片
    const result = await generateImage({
      frames: ['场景1', '场景2', '场景3', '场景4', '场景5', '场景6', '场景7'],
      prompt: '测试继续生成',
      async: false
    });

    // Then: 使用简化逻辑返回全部7张
    expect(result).toHaveLength(7);
    expect(result.every(url => url.startsWith('https://'))).toBe(true);
  });

  it('should not trigger continuation for 4 or fewer images', async () => {
    const result = await generateImage({
      frames: ['场景1', '场景2', '场景3', '场景4'],
      prompt: '测试4张不触发',
      async: false
    });

    expect(result).toHaveLength(4);
    // Should NOT call performSyncContinueGeneration
  });
});
```

### Performance Requirements

- **轮询间隔**: 2s → 10s (exponential backoff)
- **超时限制**: 600s (10分钟)
- **最大循环**: 300次

### Backward Compatibility

- ✅ 公共 API 签名不变
- ✅ 返回值格式不变（string[]）
- ✅ 行为结果相同（全部图片一次返回）
- ✅ 仅简化内部实现逻辑

---

**实现文件**: `src/api/NewJimengClient.ts`
**测试文件**: `tests/integration/continue-generation.test.ts`
**代码行数**: 67 lines → ~25 lines (减少60%)
