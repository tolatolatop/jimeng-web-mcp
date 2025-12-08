# 图像生成功能验证测试 - 使用说明

**创建日期**: 2025-01-03
**项目**: jimeng-web-mcp v2.0.2
**目标**: 全面验证所有图像生成功能

---

## 📁 文件结构

```
specs/20250103-image-validation/
├── README.md                    # 本文件 - 使用说明
├── test-cases.md                # 测试用例清单（62个用例）
├── test-results.md              # 测试结果模板
├── results.json                 # 自动生成的测试结果（JSON格式）
├── screenshots/                 # 测试截图目录（手动创建）
├── samples/                     # 生成的图片样本（手动保存）
└── logs/                        # 测试日志目录（手动创建）

tests/manual/
└── image-generation-validation.test.ts  # 验证测试代码

scripts/
└── validate-image-generation.sh         # 执行脚本
```

---

## 🚀 快速开始

### 1. 准备工作

#### 1.1 获取API Token
1. 访问 [即梦AI官网](https://jimeng.jianying.com)
2. 登录账号
3. 打开浏览器开发者工具（F12）
4. 进入 Application > Cookies
5. 复制 `sessionid` 的值

#### 1.2 设置环境变量
```bash
# macOS/Linux
export JIMENG_API_TOKEN=your_session_id_here

# Windows (PowerShell)
$env:JIMENG_API_TOKEN="your_session_id_here"

# Windows (CMD)
set JIMENG_API_TOKEN=your_session_id_here
```

#### 1.3 安装依赖
```bash
cd /Users/lupin/mcp-services/jimeng-mcp
npm install
```

### 2. 执行测试

#### 方式1: 使用执行脚本（推荐）

```bash
# 运行所有测试
./scripts/validate-image-generation.sh

# 只运行基础功能测试
./scripts/validate-image-generation.sh --basic

# 只运行边界条件测试
./scripts/validate-image-generation.sh --edge

# 指定API token
./scripts/validate-image-generation.sh --token your_token_here

# 查看帮助
./scripts/validate-image-generation.sh --help
```

#### 方式2: 直接使用Jest

```bash
# 运行所有验证测试
npm test tests/manual/image-generation-validation.test.ts

# 只运行基础测试
npm test tests/manual/image-generation-validation.test.ts -t "阶段1"

# 只运行边界测试
npm test tests/manual/image-generation-validation.test.ts -t "阶段2"

# 详细输出
npm test tests/manual/image-generation-validation.test.ts -- --verbose
```

### 3. 查看结果

测试完成后，查看以下文件：

1. **实时控制台输出**: 测试过程中的日志
2. **results.json**: 自动生成的详细测试数据
3. **test-results.md**: 手动更新测试报告模板

---

## 📊 测试用例概览

### 阶段1: 功能验证测试 (34个用例)

| 子类别 | 用例数 | 说明 |
|--------|--------|------|
| 1.1 基础生成 | 6 | 单图、批量、继续生成 |
| 1.2 参考图 | 6 | 单图、多图、强度控制 |
| 1.3 模型和宽高比 | 15 | 所有模型和宽高比组合 |
| 1.4 场景描述 | 4 | frames、image_batch工具 |
| 1.5 查询功能 | 3 | 单查询、批量查询 |

### 阶段2: 边界条件和异常测试 (16个用例)

| 子类别 | 用例数 | 说明 |
|--------|--------|------|
| 2.1 参数边界 | 7 | count、strength、prompt边界 |
| 2.2 异常处理 | 5 | 无效参数、网络错误 |
| 2.3 继续生成 | 4 | 继续生成特殊场景 |

### 阶段3: 性能和压力测试 (6个用例)

| 子类别 | 用例数 | 说明 |
|--------|--------|------|
| 3.1 并发测试 | 3 | 5个、10个、20个并发任务 |
| 3.2 资源测试 | 3 | 大文件、长prompt、内存泄漏 |

### 阶段4: 集成测试 (6个用例)

| 子类别 | 用例数 | 说明 |
|--------|--------|------|
| 4.1 完整工作流 | 4 | 同步、异步、批量、系列图 |
| 4.2 MCP工具工作流 | 3 | image、image_batch、query |

**总计**: 62个测试用例

---

## 📝 如何记录测试结果

### 自动记录

测试执行时会自动生成 `results.json`，包含：
- 测试用例ID
- 执行时间
- 输入参数
- 输出结果
- 执行时长
- 通过/失败状态
- 错误信息（如果失败）

### 手动更新报告

1. 打开 `test-results.md`
2. 根据 `results.json` 的数据更新：
   - 测试统计表格
   - 通过的测试用例详情
   - 失败的测试用例详情
   - Bug清单
   - 性能数据
3. 添加测试结论和建议

### 保存证据

为重要用例保存证据：
1. **截图**: 保存到 `screenshots/` 目录
2. **生成图片**: 保存到 `samples/` 目录
3. **错误日志**: 保存到 `logs/` 目录

命名规范: `TC-XXX-XXX-描述.png/jpg/log`

---

## ⚠️ 注意事项

### API积分消耗

每个测试用例会消耗真实的API积分：
- 单图生成: 约1-2积分
- 批量生成: 按数量倍增
- 建议分批执行，避免一次性消耗过多

### 测试时间

预估执行时间：
- **基础测试** (阶段1): 30-60分钟
- **边界测试** (阶段2): 10-20分钟
- **性能测试** (阶段3): 30-60分钟
- **集成测试** (阶段4): 20-30分钟
- **全部测试**: 2-3小时

### 跳过某些测试

某些耗时或消耗积分较多的测试默认跳过：
- TC-BG-006: 生成15张图片
- 性能和压力测试

如需执行，手动取消 `.skip` 标记。

### 网络要求

- 稳定的网络连接
- 可访问即梦AI服务器
- 建议在网络状况良好时执行

---

## 🔍 问题排查

### 问题1: API Token无效

**症状**: 测试失败，提示认证错误

**解决方案**:
1. 确认token正确复制
2. 检查token是否过期
3. 重新登录获取新token
4. 确认环境变量已正确设置

### 问题2: 测试超时

**症状**: 测试在等待结果时超时

**解决方案**:
1. 检查网络连接
2. 延长超时时间（修改 `TEST_CONFIG.timeout`）
3. 使用异步模式，避免长时间等待

### 问题3: 生成失败

**症状**: API返回错误或空结果

**解决方案**:
1. 检查prompt是否符合规范
2. 确认参数在有效范围内
3. 查看API响应的详细错误信息
4. 检查积分是否充足

### 问题4: 结果不符合预期

**症状**: 生成的图片与预期不符

**解决方案**:
1. 调整prompt描述
2. 修改参考图强度
3. 尝试不同的模型
4. 检查是否触发内容过滤

---

## 📈 测试报告生成

### 统计测试结果

```bash
# 使用jq统计results.json
cd specs/20250103-image-validation

# 总用例数
jq 'length' results.json

# 通过数
jq '[.[] | select(.status == "pass")] | length' results.json

# 失败数
jq '[.[] | select(.status == "fail")] | length' results.json

# 平均执行时间
jq '[.[].duration] | add / length' results.json
```

### 导出测试报告

```bash
# 转换为CSV
jq -r '.[] | [.testId, .status, .duration, .error // ""] | @csv' results.json > report.csv

# 生成Markdown表格
jq -r '.[] | "| \(.testId) | \(.status) | \(.duration)ms |"' results.json
```

---

## 🎯 验证标准

### 通过标准

测试通过需满足：
- ✅ P0（关键）用例: 100%通过
- ✅ P1（重要）用例: ≥95%通过
- ✅ P2（一般）用例: ≥90%通过
- ✅ 无Critical/High级别Bug
- ✅ 性能指标达标

### 性能指标

| 操作 | 目标响应时间 |
|------|-------------|
| 单图同步生成 | <30秒 |
| 单图异步提交 | <5秒 |
| 批量生成(4张) | <60秒 |
| 继续生成(8张) | <120秒 |
| 任务查询 | <2秒 |
| 批量查询(10个) | <5秒 |

### 发布条件

满足以下条件可发布：
- ✅ 所有P0用例通过
- ✅ 无Critical/High Bug
- ✅ 性能测试通过
- ✅ 文档与实现一致
- ✅ 通过code review

---

## 📚 参考文档

- [项目README](../../CLAUDE.md)
- [API文档](../../src/types/api.types.ts)
- [现有测试](../../tests/)
- [即梦AI官网](https://jimeng.jianying.com)

---

## 👥 联系方式

- **技术支持**: 项目维护者
- **Bug反馈**: GitHub Issues
- **测试问题**: 查看本文档问题排查章节

---

## 📅 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2025-01-03 | 初始版本，62个测试用例 |

---

**最后更新**: 2025-01-03
**文档维护**: 项目团队
