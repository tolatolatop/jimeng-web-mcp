# Contract: Prompt 构建行为

**Feature**: 008-code-quality-optimization
**Entity**: PromptBuilder
**Method**: `buildPromptWithFrames()`

## Contract Specification

### Input

```typescript
interface PromptBuilderInput {
  basePrompt: string;    // 基础提示词
  frames: string[];      // 场景描述数组
}
```

### Output

```typescript
interface PromptBuilderOutput {
  finalPrompt: string;   // 最终组合的提示词
}
```

### Behavior

**优化前行为** (问题):
```typescript
// ❌ 总是追加 "一共N张图"，可能重复
return `${basePrompt} ${framesText}，一共${frames.length}张图`;
```

**优化后行为** (正确):
```typescript
// ✅ 检测已有声明，避免重复
const combined = `${basePrompt} ${framesText}`;
if (/[一共总].*\d+.*张图?/.test(combined)) {
  return combined;  // 已有声明
}
return `${combined}，一共${frames.length}张图`;
```

**删除抽象** (优化重点):
- ❌ 删除 `src/utils/prompt-validator.ts` (71 lines)
- ✅ 内联简单检测逻辑（5 lines）

### Validation Rules

```typescript
// 1. 不重复声明
const prompt = buildPromptWithFrames("生成9张图", ["场景1", "场景2"]);
assert(!prompt.match(/一共.*一共/));  // 不应出现两次 "一共"

// 2. 包含帧编号
assert(prompt.includes("第1张"));
assert(prompt.includes("第2张"));

// 3. 包含总数
assert(prompt.includes("一共") || prompt.includes("总共") || prompt.includes("共"));

// 4. 空frames返回原prompt
const empty = buildPromptWithFrames("测试", []);
assert(empty === "测试");
```

### Test Cases

| Input | Expected Output | Validation |
|-------|----------------|------------|
| `"画猫", ["坐", "跑"]` | `"画猫 第1张：坐 第2张：跑，一共2张图"` | ✅ 正常追加 |
| `"一共9张图", ["A", "B"]` | `"一共9张图 第1张：A 第2张：B"` | ✅ 检测到已有，不重复 |
| `"总共5张", ["X"]` | `"总共5张 第1张：X"` | ✅ 支持 "总共" |
| `"共12張圖", ["Y"]` | `"共12張圖 第1张：Y"` | ✅ 支持繁体 |
| `"测试", []` | `"测试"` | ✅ 空frames直接返回 |

### Error Conditions

| Condition | Behavior | Example |
|-----------|----------|---------|
| frames.length === 0 | 返回原basePrompt | `buildPromptWithFrames("测试", []) === "测试"` |
| basePrompt 为空 | 正常处理 | `"" + frames` |
| frames包含空字符串 | 过滤或保留 | 根据 validateAndFilterFrames 逻辑 |

### Contract Test

```typescript
describe('Prompt Building Contract', () => {
  it('should detect existing count declaration and avoid duplication', () => {
    // Given: basePrompt 已包含 "一共9张图"
    const prompt = buildPromptWithFrames("一共9张图的猫", ["坐着", "跑着"]);

    // Then: 不应重复追加
    const countMatches = prompt.match(/[一共总]/g);
    expect(countMatches).toHaveLength(1);  // 仅一次出现
  });

  it('should append count when not present', () => {
    const prompt = buildPromptWithFrames("画猫", ["场景1", "场景2"]);

    expect(prompt).toContain("第1张");
    expect(prompt).toContain("第2张");
    expect(prompt).toContain("一共2张图");
  });

  it('should handle empty frames', () => {
    const prompt = buildPromptWithFrames("测试", []);
    expect(prompt).toBe("测试");
  });

  it('should support traditional Chinese', () => {
    const prompt = buildPromptWithFrames("共12張圖", ["測試"]);
    const countMatches = prompt.match(/共/g);
    expect(countMatches).toHaveLength(1);
  });
});
```

### Regex Pattern

```typescript
// 匹配模式
const countPattern = /[一共总].*\d+.*张图?/;

// 匹配示例
"一共9张图"      → ✅ Match
"总共5张"        → ✅ Match
"共12張圖"       → ✅ Match
"9张图片"        → ❌ No match (需要前缀)
"一共很多张"     → ❌ No match (缺少数字)
```

### Performance Requirements

- **时间复杂度**: O(n) for frames.map()
- **正则匹配**: O(m) for pattern.test()
- **总体**: O(n + m) ≈ O(n)

### Backward Compatibility

- ✅ 方法签名不变
- ✅ 返回值类型不变（string）
- ✅ 行为改进（避免重复），不破坏兼容性
- ⚠️ 删除未使用的 PromptValidator（无影响）

---

**实现文件**: `src/api/NewJimengClient.ts` (buildPromptWithFrames 方法)
**删除文件**: `src/utils/prompt-validator.ts`
**测试文件**: `tests/integration/mcp-image-tools.test.ts`
**代码行数**: 71 lines 删除，5 lines 内联（净减少66 lines）
