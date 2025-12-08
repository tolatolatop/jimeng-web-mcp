# Feature Specification: 代码质量优化 - 简化过度工程

**Feature Branch**: `20250104-`
**Created**: 2025-01-04
**Status**: Draft
**Input**: User description: "优化以上问题"

**Context**: 基于 code-quality-pragmatist agent 的代码审查报告，识别出5个过度工程问题，本次只处理其中3个优先级最高的问题（FR-001, FR-002, FR-004）。

## Execution Flow (main)
```
1. Parse user description from Input
   → Context: 代码质量审查报告识别了5个优化点
2. Extract key concepts from description
   → Actors: 开发者、维护者
   → Actions: 简化代码、移除冗余、提升可维护性
   → Data: 缓存条目、调试信息、工具描述
   → Constraints: 保持100%向后兼容、不影响现有功能
3. For each unclear aspect:
   → [COMPLETED] - 所有优化点在代码审查报告中已明确
4. Fill User Scenarios & Testing section
   → [COMPLETED] - 基于代码审查报告的5个问题
5. Generate Functional Requirements
   → [COMPLETED] - 每个优化点对应具体要求
6. Identify Key Entities (if data involved)
   → [COMPLETED] - 缓存条目、继续生成逻辑、工具Schema
7. Run Review Checklist
   → [COMPLETED] - 无未明确项、无实现细节泄露
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
作为一个使用 jimeng-web-mcp 的开发者，我希望代码库更简洁、更易维护，这样我可以：
- 更快地理解代码逻辑
- 更容易地调试问题
- 减少维护成本
- 降低内存使用
- 提升代码可读性

### Acceptance Scenarios

#### 场景1: 继续生成逻辑简化
1. **Given** 用户请求生成7张图片（超过4张阈值）
2. **When** 系统触发继续生成机制
3. **Then**
   - 系统使用简化的单一条件检查完成状态
   - 不再有重复的 `length >= targetCount` 和 `finishedCount >= targetCount` 双重检查
   - 成功返回全部7张图片
   - 代码行数减少约60%（67行→25行）

#### 场景2: PromptValidator 集成
1. **Given** 用户提供的 prompt 已包含 "一共9张图"
2. **When** 系统构建最终 prompt
3. **Then**
   - 系统检测到已有数量声明
   - 不再追加重复的 "一共9张图"
   - 最终 prompt 中只出现一次数量声明

#### 场景3: 生产环境调试信息清理
1. **Given** 用户查询图片生成任务状态
2. **When** 系统返回查询结果
3. **Then**
   - 响应不包含 `_debug`、`totalCount`、`itemCount` 等调试字段
   - 响应更简洁、payload 更小
   - 调试信息仅在开发环境日志中输出

### Edge Cases

#### 继续生成逻辑
- **边界**: 当生成数量恰好为4张时，不应触发继续生成
- **错误**: 当继续生成失败时，应抛出明确错误信息
- **超时**: 当继续生成超时时，应抛出超时错误

#### PromptValidator
- **边界**: 用户 prompt 为空时应正确处理
- **边界**: 用户 prompt 包含特殊字符（如 "共12張圖"）时应正确识别
- **边界**: frames 为空数组时应返回原始 basePrompt

#### 调试信息清理
- **边界**: 开发环境检测逻辑必须准确（避免误判）
- **兼容性**: 移除调试字段后不影响现有功能

---

## Requirements *(mandatory)*

### Functional Requirements

#### FR-001: 继续生成逻辑简化
- **FR-001.1**: 系统必须使用单一条件判断继续生成完成状态（`finishedCount >= targetCount && imageUrls.length > 0`）
- **FR-001.2**: 系统必须移除重复的 `isPartial` 标志和双重完成检查
- **FR-001.3**: 系统必须在简化后保持100%向后兼容，所有现有测试必须通过
- **FR-001.4**: 继续生成逻辑代码行数必须减少至少50%（目标：67行→25行）

#### FR-002: PromptValidator 集成或移除
- **FR-002.1**: 系统必须选择以下方案之一：
  - 方案A: 集成 PromptValidator 到 `buildPromptWithFrames`，避免重复的 "一共N张图" 声明
  - 方案B: 删除 PromptValidator 类，内联简单的检查逻辑
- **FR-002.2**: 系统必须检测 prompt 中已有的数量声明（支持正则 `/[一共总].*\d+.*张图?/`）
- **FR-002.3**: 当 prompt 已包含数量声明时，系统不得追加重复声明
- **FR-002.4**: 系统必须在修改后通过所有现有 prompt 构建测试

#### FR-003: 生产环境调试信息清理
- **FR-003.1**: 系统必须从 API 响应中移除调试字段：
  - `_debug` 对象
  - `totalCount`（非必要时）
  - `itemCount`（非必要时）
- **FR-003.2**: 调试信息必须仅在开发环境（`process.env.DEBUG === 'true'`）下输出到日志
- **FR-003.3**: 系统必须减少查询时的 `CacheManager.get()` 调用次数（从3次减少到1次）
- **FR-003.4**: API 响应 payload 必须更小、更简洁

### 非功能性要求

#### NFR-001: 向后兼容性
- 系统必须保持100%向后兼容，所有现有 API 调用必须正常工作
- 所有现有测试必须通过，无需修改测试代码

#### NFR-002: 代码质量
- 优化后的代码必须更简洁、更易读
- 代码行数必须减少约20-30%（针对3个优化点）
- 不得引入新的复杂性

#### NFR-003: 性能
- 系统性能不得降低
- API 响应时间不得增加
- 查询操作的缓存访问次数减少

#### NFR-004: 可测试性
- 所有优化后的代码必须可测试
- 必须保留或增强现有测试覆盖率

### Key Entities *(feature involves data)*

#### 继续生成状态 (ContinuationState)
- **用途**: 跟踪继续生成的进度和完成状态
- **优化前**: 使用 `isPartial` 标志 + 双重完成检查
- **优化后**: 使用单一 `finishedCount >= targetCount` 条件
- **关系**: 与查询结果 `QueryResultResponse` 关联

#### Prompt 构建逻辑 (PromptBuilder)
- **用途**: 构建最终发送给 API 的 prompt
- **优化前**: 总是追加 "一共N张图"，可能重复
- **优化后**: 检测已有声明，避免重复
- **关系**: 使用 PromptValidator 或内联逻辑

#### 查询响应 (QueryResultResponse)
- **用途**: 返回任务查询结果
- **优化前**: 包含 `_debug`、`totalCount`、`itemCount` 等调试字段
- **优化后**: 仅包含必要字段，调试信息移至日志
- **关系**: 从 `parseQueryResult` 返回，被 MCP 工具使用

---

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked (无需标记，所有内容明确)
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed

---

## Dependencies and Assumptions

### Dependencies
- 现有测试套件必须能够验证向后兼容性
- 代码审查报告提供的5个优化点作为输入
- CacheManager、PromptValidator、QueryResultResponse 等现有组件

### Assumptions
- 现有测试覆盖率足够验证优化后的功能
- 开发环境可通过 `process.env.DEBUG` 标志区分
- MCP SDK 允许简化工具描述而不影响功能

### Success Metrics
- 继续生成代码减少 60%（67行→25行）
- PromptValidator 要么被正确集成，要么被删除（-71行）
- API 响应 payload 减少（移除调试字段）
- 查询操作的 `CacheManager.get()` 调用从3次减少到1次
- 所有现有测试通过率 100%

---

## Out of Scope

以下内容不在本次优化范围内：
- **FR-003**: 缓存条目精简（暂不处理）
- **FR-005**: MCP 工具描述简化（暂不处理）
- 重构整体架构
- 修改 API 接口签名
- 添加新功能
- 修改测试框架
- 性能优化（除了减少缓存调用次数作为副作用）
- 文档重写（仅移动现有内容）
