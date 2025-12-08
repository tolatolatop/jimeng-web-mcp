# Implementation Plan: 代码质量优化 - 简化过度工程

**Branch**: `008-code-quality-optimization` | **Date**: 2025-01-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/lupin/mcp-services/jimeng-mcp/specs/008-code-quality-optimization/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✅ Loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → ✅ No NEEDS CLARIFICATION - all optimization points clearly defined
   → Detected Project Type: single (TypeScript MCP server)
3. Fill the Constitution Check section
   → ✅ Completed - EXCEPTION VI applies (Technical Debt Remediation)
4. Evaluate Constitution Check section
   → ⚠️ Violations documented with justification (Tech Debt Exception)
   → Updated Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → ✅ Generated research.md
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → ✅ Generated design artifacts
7. Re-evaluate Constitution Check section
   → ✅ No new violations introduced
   → Updated Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach
   → ✅ Documented in Phase 2 section
9. STOP - Ready for /tasks command
```

## Summary

基于 code-quality-pragmatist agent 的代码审查报告，本次优化针对3个高优先级的过度工程问题：

1. **继续生成逻辑简化** (FR-001): 移除重复的完成检查和 `isPartial` 标志，代码量减少60%（67行→25行），使用单一条件 `finishedCount >= targetCount && imageUrls.length > 0` 判断完成状态。

2. **PromptValidator 集成** (FR-002): 修复未使用的 PromptValidator 类，检测 prompt 中已有的 "一共N张图" 声明，避免重复追加。选择方案B（内联逻辑）以减少抽象层。

3. **生产环境调试信息清理** (FR-003): 从 API 响应中移除 `_debug`、`totalCount`、`itemCount` 等调试字段，减少 `CacheManager.get()` 调用次数（3次→1次），调试信息仅在开发环境日志输出。

**技术方法**: 直接修改现有代码（符合宪法 Exception VI: Technical Debt Remediation），保持100%向后兼容，所有现有测试必须通过。

## Technical Context

**Language/Version**: TypeScript 5.8.3, Node.js (ES modules)
**Primary Dependencies**:
- @modelcontextprotocol/sdk (MCP 协议)
- axios (HTTP 客户端)
- zod (Schema 验证)
- image-size (图片尺寸检测)

**Storage**:
- CacheManager (内存缓存，用于继续生成)
- 无持久化存储需求

**Testing**:
- Jest 29.7.0 (ES modules 模式)
- 测试分类: unit/, integration/, e2e/
- 覆盖率: 排除 types 和 test 文件

**Target Platform**: Node.js server, 支持 npx 零安装部署
**Project Type**: single (MCP 服务器，单一代码库)

**Performance Goals**:
- 继续生成代码减少 60% (67行→25行)
- API 响应 payload 减少（移除调试字段）
- 查询操作缓存访问减少 67% (3次→1次)

**Constraints**:
- 必须保持 100% 向后兼容
- 所有现有测试必须通过
- 不得修改 API 接口签名
- 代码总行数减少 20-30%

**Scale/Scope**:
- 3个优化点（FR-001, FR-002, FR-003）
- 涉及文件: src/api/NewJimengClient.ts, src/utils/prompt-validator.ts
- 预估影响范围: ~150行代码修改/删除

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with constitutional principles from `.specify/memory/constitution.md`:

- [x] **Minimal Code Change**: ⚠️ **VIOLATION** - 需要修改现有代码（NewJimengClient.ts）
- [x] **Modular Extension**: ✅ COMPLIANT - 不涉及新模块创建，优化现有模块
- [x] **Backward Compatibility**: ✅ COMPLIANT - 保持 100% 向后兼容，所有测试通过
- [x] **Test-Driven Development**: ⚠️ **VIOLATION** - 现有测试验证，非新增功能
- [x] **API Contract Stability**: ✅ COMPLIANT - 不修改公共 API 签名

**Violations**:

1. **Minimal Code Change (Principle I)**: 需要修改现有核心文件 `src/api/NewJimengClient.ts`（继续生成逻辑、prompt 构建、查询解析）
2. **Test-Driven Development (Principle IV)**: 这是代码质量优化而非新功能开发，使用现有测试验证而非先写新测试

**Justification - Constitution Exception VI Applies**:

本次优化符合 **Technical Debt Remediation Exception** 的所有条件：

**Qualifying Conditions** (ALL met):
1. ✅ **Demonstrable Impact**: code-quality-pragmatist agent 审查报告明确指出：
   - 继续生成逻辑过度防御，重复检查导致代码冗长（67行→25行，60%冗余）
   - PromptValidator 未使用，71行死代码
   - 调试信息泄露到生产响应，每次查询3次缓存访问
   - 总体可减少代码 20-30%，提升可维护性

2. ✅ **Impossibility of Modular Fix**:
   - 继续生成逻辑是核心流程，无法通过新模块或适配器简化
   - PromptValidator 内联到 buildPromptWithFrames 比保持抽象更简洁
   - 调试信息移除需修改 parseQueryResult 返回值

3. ✅ **Documented Analysis**: code-quality-pragmatist agent 提供详细报告，识别5个具体问题，本次处理3个高优先级

4. ✅ **Backward Compatibility Guarantee**:
   - 所有公共 API 签名不变
   - 现有测试 100% 通过
   - 继续生成功能行为不变（只是实现简化）

5. ✅ **Risk Mitigation Plan**:
   - 分3个独立优化点执行（FR-001, FR-002, FR-003）
   - 每个优化点独立验证
   - 可单独回滚

**Required Safeguards**:
- ✅ **Phase Gating**: 3个优化点分阶段执行，低风险优先（FR-003 → FR-002 → FR-001）
- ✅ **Test Coverage**: 每个阶段完成后运行完整测试套件
- ✅ **Performance Baseline**: 验证继续生成测试（7张图片）通过
- ✅ **Rollback Plan**: 每个优化点可独立 git revert
- ✅ **Documentation**: 更新 CHANGELOG.md，标注优化内容

**Mitigation**:
- 使用现有完整测试套件验证（unit + integration + e2e）
- 每个优化点独立提交，可单独回滚
- 保留调试信息在日志中（process.env.DEBUG），不影响功能
- 代码审查确认简化不引入新 bug

## Project Structure

### Documentation (this feature)
```
specs/008-code-quality-optimization/
├── spec.md              # Feature specification
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── continuation-generation.md
│   ├── prompt-building.md
│   └── query-response.md
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
src/
├── api/
│   ├── NewJimengClient.ts      # 主要修改文件（3个优化点）
│   ├── HttpClient.ts            # 不修改
│   ├── ImageUploader.ts         # 不修改
│   ├── NewCreditService.ts      # 不修改
│   └── VideoService.ts          # 不修改
├── types/
│   ├── api.types.ts             # 可能移除调试字段类型
│   ├── cache.types.ts           # 不修改
│   └── constants.ts             # 不修改
├── utils/
│   ├── prompt-validator.ts      # FR-002: 删除或内联
│   ├── logger.ts                # FR-003: 可能增强调试日志
│   └── retry.ts                 # 不修改
└── server.ts                    # 不修改（MCP 工具定义）

tests/
├── unit/
│   ├── new-credit-service.test.ts
│   ├── new-httpclient.test.ts
│   └── zod-schema-validation.test.ts
├── integration/
│   ├── backward-compatibility.test.ts
│   ├── continue-generation.test.ts     # FR-001 验证
│   ├── mcp-image-tools.test.ts
│   └── main-reference-video.test.ts
└── e2e/
    └── image-generation-workflow.test.ts
```

**Structure Decision**: Single project structure（TypeScript MCP 服务器）。主要修改集中在 `src/api/NewJimengClient.ts`（~150行修改），删除 `src/utils/prompt-validator.ts`（71行），所有现有测试验证向后兼容性。

## Phase 0: Outline & Research

**Research Tasks**:

1. **继续生成逻辑当前实现分析**
   - 任务: 分析 NewJimengClient.ts:147-214 的继续生成逻辑
   - 目标: 识别重复检查和 `isPartial` 标志的使用位置
   - 输出: 当前实现的复杂度分析

2. **PromptValidator 使用情况审计**
   - 任务: 搜索 PromptValidator 的所有引用
   - 目标: 确认是否真的未被使用
   - 输出: 使用位置清单或确认死代码

3. **调试信息字段使用分析**
   - 任务: 分析 parseQueryResult 返回的调试字段
   - 目标: 确认哪些字段是调试专用，哪些是必需字段
   - 输出: 调试字段清单和移除影响评估

4. **测试覆盖率评估**
   - 任务: 检查现有测试对继续生成、prompt 构建、查询响应的覆盖
   - 目标: 确认测试足以验证优化后的行为
   - 输出: 测试覆盖清单

**Output**: research.md with findings

## Phase 1: Design & Contracts

*Prerequisites: research.md complete*

### Data Model

**Entities to Optimize**:

1. **ContinuationState** (继续生成状态)
   - 优化前: `isPartial` flag + dual completion checks
   - 优化后: Single condition `finishedCount >= targetCount && imageUrls.length > 0`
   - 影响: generateImage 方法

2. **PromptBuilder** (Prompt 构建)
   - 优化前: PromptValidator 类（71行）未使用
   - 优化后: 内联检测逻辑到 buildPromptWithFrames
   - 影响: buildPromptWithFrames 方法

3. **QueryResponse** (查询响应)
   - 优化前: 包含 `_debug`, `totalCount`, `itemCount`
   - 优化后: 仅必要字段，调试信息移至日志
   - 影响: parseQueryResult 方法

### API Contracts

**Contract 1: 继续生成行为** (contracts/continuation-generation.md)
- Input: historyId (string), targetCount (number)
- Output: imageUrls (string[])
- Behavior: 单次 action=2 请求完成所有剩余图片
- Validation: 返回数量 === targetCount

**Contract 2: Prompt 构建** (contracts/prompt-building.md)
- Input: basePrompt (string), frames (string[])
- Output: finalPrompt (string)
- Behavior: 检测已有 "一共N张图"，避免重复
- Validation: 正则匹配不重复

**Contract 3: 查询响应** (contracts/query-response.md)
- Input: historyId (string)
- Output: { status, progress, imageUrls?, videoUrl?, error? }
- Behavior: 生产环境不返回调试字段
- Validation: _debug 不存在 when process.env.DEBUG !== 'true'

### Contract Tests

生成3个合同测试文件验证优化后的行为：
- tests/contract/continuation-generation.contract.test.ts
- tests/contract/prompt-building.contract.test.ts
- tests/contract/query-response.contract.test.ts

### Integration Test Scenarios

从 spec.md 提取的测试场景：

1. **场景1: 继续生成逻辑简化**
   - Given: 用户请求生成7张图片
   - When: 系统触发继续生成
   - Then: 返回全部7张图片，使用简化逻辑

2. **场景2: PromptValidator 集成**
   - Given: prompt 包含 "一共9张图"
   - When: 构建最终 prompt
   - Then: 不追加重复声明

3. **场景3: 调试信息清理**
   - Given: 查询任务状态
   - When: 返回结果
   - Then: 生产环境无调试字段

### Agent Context Update

执行 `.specify/scripts/bash/update-agent-context.sh claude` 更新 CLAUDE.md：
- 添加优化相关的技术上下文
- 记录3个优化点的实现位置
- 保留手动添加的内容
- 保持文件简洁（<150行）

**Output**: data-model.md, /contracts/*, failing contract tests, quickstart.md, CLAUDE.md

## Phase 2: Task Planning Approach

*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:

1. **从合同测试生成任务**:
   - Task 1: 编写 continuation-generation.contract.test.ts [P]
   - Task 2: 编写 prompt-building.contract.test.ts [P]
   - Task 3: 编写 query-response.contract.test.ts [P]

2. **按优化点分组**:
   - **FR-003 组** (低风险优先):
     - Task 4: 移除 parseQueryResult 中的调试字段
     - Task 5: 减少 CacheManager.get() 调用次数
     - Task 6: 添加 DEBUG 环境变量检测
     - Task 7: 运行测试验证 FR-003

   - **FR-002 组** (中风险):
     - Task 8: 删除 PromptValidator 类
     - Task 9: 内联检测逻辑到 buildPromptWithFrames
     - Task 10: 运行测试验证 FR-002

   - **FR-001 组** (高风险，涉及核心逻辑):
     - Task 11: 移除 isPartial 标志
     - Task 12: 简化继续生成完成检查（单一条件）
     - Task 13: 简化轮询逻辑（67行→25行）
     - Task 14: 运行测试验证 FR-001

3. **集成验证任务**:
   - Task 15: 运行完整测试套件（unit + integration + e2e）
   - Task 16: 验证继续生成测试（7张图片）
   - Task 17: 验证 prompt 构建测试
   - Task 18: 验证查询响应格式

**Ordering Strategy**:
- TDD 顺序: Contract tests → Implementation → Validation
- 风险顺序: 低风险优先 (FR-003 → FR-002 → FR-001)
- 依赖顺序: 独立优化点可并行
- 标记 [P] 用于可并行的任务（Task 1-3）

**Estimated Output**: 18个有序任务，3个可并行合同测试

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Minimal Code Change (I) | 技术债务累积：继续生成逻辑67行中60%冗余，PromptValidator 71行未使用，调试信息泄露 | 新模块无法解决核心流程冗余；保持现状会继续降低可维护性；符合宪法 Exception VI 条件 |
| Test-Driven Development (IV) | 代码质量优化使用现有测试验证，非新功能开发 | 先写新测试无意义，现有测试已覆盖所有行为；TDD 不适用于重构场景 |

## Progress Tracking

*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS (Exception VI applies)
- [x] Post-Design Constitution Check: PASS (no new violations)
- [x] All NEEDS CLARIFICATION resolved (none existed)
- [x] Complexity deviations documented (2 violations justified)

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
