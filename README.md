# JiMeng Web MCP Server

<div align="center">

[![npm version](https://img.shields.io/npm/v/jimeng-web-mcp.svg)](https://www.npmjs.com/package/jimeng-web-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![MCP Protocol](https://img.shields.io/badge/MCP-1.10-green.svg)](https://modelcontextprotocol.io/)

基于TypeScript的Model Context Protocol (MCP) 服务器，直接访问即梦AI Web端

**🚀 直接访问Web端 | 每日免费积分 | 最新功能支持 | 组合模式架构 | 100%类型安全**

[English](./README.en.md) | 中文

</div>

---

## ⚠️ 免责声明

**本项目仅供学习和研究使用，请勿用于商业或其他用途。**

- 本项目通过技术手段访问即梦AI Web端接口
- 使用本项目需遵守即梦AI的服务条款
- 因使用本项目产生的任何问题，开发者不承担责任
- 建议仅在学习研究场景下使用，不要滥用API接口

---

## ✨ 核心特性

### 🎨 图像生成
- **智能继续生成** - prompt自动识别数量（如"生成9张图片"），一次返回全部结果
- **系列图生成** - 专用于高相关性场景：房间系列、故事分镜、产品多角度
- **多参考图混合** - 支持最多4张参考图，可控制每张强度
- **同步/异步模式** - 灵活选择即时返回或后台生成

### 🎬 视频生成
- **纯文本生成** - 从prompt直接创建视频
- **首尾帧控制** - 精确控制视频起止画面
- **多帧动画** - 2-10个关键帧，系统自动补间平滑过渡
- **主体融合** - 将多张图片的主体组合到一个场景（使用`[图0]`语法）

### 💰 免费积分优势
- **每日免费积分** - 每天可获得60-80免费积分，无需付费
- **最新功能支持** - 直接访问Web端，第一时间体验新功能
- **无需API密钥** - 只需登录账号获取sessionid即可使用

### 🏗️ 现代化架构
- **组合模式设计** - 74.6%代码减少（5,268行 → 1,335行）
- **零安装部署** - npx自动安装，无需手动配置
- **TypeScript + Zod** - 完整类型定义和运行时验证
- **100%向后兼容** - 无缝升级，现有代码无需修改

---

## 🚀 快速开始

### 1. 获取API Token

1. 访问 [即梦AI官网](https://jimeng.jianying.com) 并登录
2. 按 `F12` 打开开发者工具
3. 进入 `Application` > `Cookies`
4. 复制 `sessionid` 的值

### 2. 配置Claude Desktop

编辑Claude Desktop配置文件：
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

添加以下配置：

```json
{
  "mcpServers": {
    "jimeng-web-mcp": {
      "command": "npx",
      "args": ["-y", "jimeng-web-mcp"],
      "env": {
        "JIMENG_API_TOKEN": "你的sessionid"
      }
    }
  }
}
```

### 3. 重启Claude Desktop

配置完成！现在可以在Claude中使用即梦AI生成功能。

---

## 🛠️ MCP工具列表

### 图像生成 (2个工具)

| 工具 | 默认模式 | 适用场景 | 说明 |
|------|---------|---------|------|
| `image` | 同步 | 单图/智能多图生成 | prompt自动识别数量，如"生成9张图片" |
| `image_batch` | 异步 | 高相关性系列图 | 房间系列、故事分镜、产品多角度 |

### 视频生成 (4个工具)

| 工具 | 默认模式 | 适用场景 | 说明 |
|------|---------|---------|------|
| `video` | 异步 | 纯文本生成视频 | 从prompt直接创建 |
| `video_frame` | 异步 | 首尾帧控制 | 支持首帧、尾帧或两者 |
| `video_multi` | 异步 | 多帧动画 | 2-10个关键帧，系统补间 |
| `video_mix` | 异步 | 主体融合 | 用`[图0]`语法引用多张图 |

### 积分管理 (1个工具)

| 工具 | 说明 |
|------|------|
| `credit` | 查询当前积分余额并领取每日免费积分 |

### 查询与工具 (2个工具)

| 工具 | 说明 |
|------|------|
| `query` | 查询单个任务状态和结果 |
| `ping` | 测试服务器连接 |

---

## 📸 图像生成详解

### `image` - 单图/智能多图生成

#### 核心特性
- ✅ **智能数量识别** - prompt中的"生成N张图片"会被自动识别
- ✅ **继续生成自动触发** - 当N>4时，完成前4张后自动确认继续
- ✅ **一次性返回** - 等待所有图片完成，统一返回结果
- ✅ **多参考图支持** - 最多4张参考图，可单独控制强度

#### 参数说明

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `prompt` | string | ✅ | - | 图片描述，可包含数量（如"生成9张图片"） |
| `filePath` | string[] | ❌ | - | 参考图路径数组（最多4张） |
| `model` | string | ❌ | jimeng-4.0 | 模型名称 |
| `aspectRatio` | string | ❌ | auto | 宽高比：auto/1:1/16:9/9:16/3:4/4:3/3:2/2:3/21:9 |
| `sample_strength` | number | ❌ | 0.5 | 参考图影响强度 (0-1) |
| `reference_strength` | number[] | ❌ | - | 每张参考图独立强度 |
| `negative_prompt` | string | ❌ | - | 负面提示词 |
| `async` | boolean | ❌ | false | 是否异步模式 |

#### 使用示例

**示例1: 智能继续生成**
```typescript
// Claude中直接说：
"请用image工具生成9张不同角度的可爱橘猫图片"

// 工具调用：
{
  "prompt": "帮我生成9张图片，可爱的橘猫，分别是：正面、侧面、背面、俯视、仰视、左卧、右玩、奔跑、睡觉",
  "model": "jimeng-4.0",
  "async": false
}

// 结果：一次性返回9张图片URL ✅
```

**示例2: 多参考图混合**
```typescript
{
  "prompt": "梵高星空风格的城市夜景",
  "filePath": [
    "/path/to/starry-night.jpg",
    "/path/to/city.jpg"
  ],
  "reference_strength": [0.7, 0.3],
  "async": false
}
```

#### 继续生成机制说明

**工作原理**：
1. API根据prompt识别总数量（如"生成9张" → totalCount=9）
2. 先生成前4张图片
3. 完成第4张时暂停，等待确认
4. 系统自动发送`action=2`确认
5. API继续生成剩余5张图片
6. 返回全部9张结果

**重要特性**：
- ✅ **单次确认**：只发送一次继续请求，不是循环生成
- ✅ **智能识别**：从prompt自动解析数量，无需count参数
- ✅ **完整等待**：同步模式会等待所有图片完成

---

### `image_batch` - 系列图生成

#### 适用场景

**✅ 推荐使用场景**：
- 同一房子的不同空间（客厅、卧室、厨房、书房）
- 故事连续分镜（场景1、场景2、场景3）
- 绘本不同页面（第1页、第2页、第3页）
- 产品多角度展示（正面、侧面、背面、细节）

**❌ 不适用场景**：
- 完全无关的独立图片
- 单张图片生成（请用`image`）

#### 参数说明

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `prompts` | string[] | ✅ | - | 每张图的差异描述（1-15个） |
| `basePrompt` | string | ❌ | - | 整体通用描述，添加在最前面 |
| `filePath` | string[] | ❌ | - | 可选参考图（影响整体风格） |
| `model` | string | ❌ | jimeng-4.0 | 模型名称 |
| `aspectRatio` | string | ❌ | auto | 宽高比 |
| `sample_strength` | number | ❌ | 0.5 | 参考图强度 |
| `async` | boolean | ❌ | true | 是否异步模式 |

#### 使用示例

**示例1: 房间系列**
```typescript
{
  "basePrompt": "三室两厅现代简约风格，木地板，暖色调照明，简约家具",
  "prompts": [
    "客厅，灰色布艺沙发靠窗，落地窗洒入阳光，茶几上放着杂志和遥控器",
    "主卧室，米色床品整齐铺展，木质床头柜上有台灯，墙面淡蓝色乳胶漆",
    "开放式厨房，白色橱柜整齐排列，大理石台面，中岛台上摆放水果篮",
    "书房，木质书架靠墙摆放，书桌上有笔记本电脑，窗外绿植清晰可见",
    "儿童房，彩色玩具收纳柜，小床上铺着卡通床品，墙上贴着儿童画"
  ],
  "async": true
}

// 最终prompt格式：
// "三室两厅现代简约风格，木地板，暖色调照明，简约家具 第1张：客厅... 第2张：主卧室... 一共5张图"
```

**示例2: 产品多角度**
```typescript
{
  "basePrompt": "苹果AirPods Pro 2代，白色陶瓷材质，磨砂质感，苹果logo清晰",
  "prompts": [
    "正面特写，充电盒开盖状态，耳机在盒内，LED指示灯可见",
    "侧面45度角，展示充电盒厚度和圆润边缘，耳机柄部分露出",
    "背面视角，充电口特写，序列号区域清晰，磁吸接触点可见"
  ],
  "async": false
}
```

**⚠️ 错误示例**：
```typescript
// ❌ prompts过于简短，缺少差异描述
{
  "prompts": ["客厅", "卧室", "厨房"]  // 太简单！
}

// ✅ 正确做法：每个prompt应该是一小段话
{
  "prompts": [
    "客厅，灰色沙发靠窗，阳光洒入...",
    "卧室，米色床品，木质床头柜...",
    "厨房，白色橱柜，大理石台面..."
  ]
}
```

---

## 🎬 视频生成详解

### `video` - 纯文本生成视频

#### 参数说明

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `prompt` | string | ✅ | - | 视频描述 |
| `model` | string | ❌ | jimeng-video-3.0 | 视频模型 |
| `resolution` | string | ❌ | 720p | 分辨率：720p/1080p |
| `fps` | number | ❌ | 24 | 帧率 (12-30) |
| `duration` | number | ❌ | 5000 | 时长（毫秒，3000-15000） |
| `videoAspectRatio` | string | ❌ | 16:9 | 宽高比 |
| `async` | boolean | ❌ | true | 是否异步 |

#### 使用示例

```typescript
{
  "prompt": "一只小狗在草地上奔跑，阳光明媚，镜头跟随，高清画质",
  "resolution": "1080p",
  "fps": 30,
  "duration": 5000,
  "async": true
}
```

---

### `video_frame` - 首尾帧控制

#### 参数说明

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `prompt` | string | ✅ | - | 视频描述 |
| `firstFrameImage` | string | ❌ | - | 首帧图片路径 |
| `lastFrameImage` | string | ❌ | - | 尾帧图片路径 |
| 其他参数 | - | - | - | 同`video` |

#### 使用示例

```typescript
{
  "prompt": "从白天到夜晚的城市延时摄影",
  "firstFrameImage": "/path/to/day.jpg",
  "lastFrameImage": "/path/to/night.jpg",
  "resolution": "1080p",
  "async": true
}
```

---

### `video_multi` - 多帧动画

#### 核心概念

**关键帧过渡动画**：提供2-10个关键帧图片，系统在帧间生成平滑过渡。

**⚠️ 重要**：每帧的`prompt`描述的是"从当前帧到下一帧的过渡过程"，包括：
1. **镜头移动**：推进、拉远、摇移、跟随
2. **画面变化**：主体动作、场景变化、光影变化
3. **转场效果**：淡入淡出、切换方式

**最后一帧的prompt不生效**（因为没有下一帧），可以留空或随意填写。

#### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `frames` | Frame[] | ✅ | 关键帧数组（2-10个） |
| `frames[].idx` | number | ✅ | 帧序号（从0开始） |
| `frames[].imagePath` | string | ✅ | 帧图片绝对路径 |
| `frames[].duration_ms` | number | ✅ | 过渡时长（1000-6000毫秒） |
| `frames[].prompt` | string | ✅ | 过渡过程描述 |
| 其他参数 | - | - | 同`video` |

#### 使用示例

```typescript
{
  "frames": [
    {
      "idx": 0,
      "imagePath": "/path/frame0.jpg",
      "duration_ms": 2000,
      "prompt": "镜头从正面缓慢推进，猫从坐姿站起，光线从左侧照入"
    },
    {
      "idx": 1,
      "imagePath": "/path/frame1.jpg",
      "duration_ms": 2000,
      "prompt": "猫向前迈步行走，尾巴自然摇摆，背景虚化效果增强"
    },
    {
      "idx": 2,
      "imagePath": "/path/frame2.jpg",
      "duration_ms": 1000,
      "prompt": "（最后一帧，此prompt不生效）"
    }
  ],
  "fps": 24,
  "resolution": "720p",
  "async": true
}

// 生成效果（总时长5秒）：
// 0-2秒：显示frame0 + 执行"站起来"动画 → 渐变到frame1
// 2-4秒：显示frame1 + 执行"行走"动画 → 渐变到frame2
// 4-5秒：显示frame2作为结尾画面
```

---

### `video_mix` - 主体融合

#### 核心特性

将多张图片的主体组合到一个场景中，使用`[图0]`、`[图1]`语法引用。

#### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `referenceImages` | string[] | ✅ | 参考图路径数组（2-4张） |
| `prompt` | string | ✅ | 必须包含`[图N]`引用 |
| 其他参数 | - | - | 同`video` |

#### 使用示例

**示例1: 角色换场景**
```typescript
{
  "referenceImages": [
    "/path/cat.jpg",
    "/path/floor.jpg"
  ],
  "prompt": "[图0]中的猫在[图1]的地板上奔跑",
  "async": true
}
```

**示例2: 多元素组合**
```typescript
{
  "referenceImages": [
    "/path/person.jpg",
    "/path/car.jpg",
    "/path/beach.jpg"
  ],
  "prompt": "[图0]中的人坐在[图1]的车里，背景是[图2]的海滩日落景色",
  "resolution": "1080p",
  "async": true
}
```

---

## 💰 积分管理

### `credit` - 查询积分余额并领取每日免费积分

调用后自动领取每日免费积分，并返回当前积分余额的详细分类。

#### 使用示例

```typescript
// 无需参数，直接调用
{}

// 返回示例：
// 💰 积分信息
//
// 📊 当前总积分: 180
//   🎁 赠送积分: 120
//   💳 购买积分: 0
//   👑 VIP积分: 60
//
// 🎉 每日积分: 首次领取 60 积分
```

#### 编程接口（API）

除了 MCP 工具外，`NewJimengClient` 还暴露以下积分相关 API，可在代码中直接调用：

```typescript
const client = getApiClient();

// 1. 领取每日积分并获取总积分
const receiveResult = await client.receiveCredit();
// → { curTotalCredits: 180, receiveQuota: 60, isFirstReceive: true }

// 2. 查询积分余额详情（不领取）
const credit = await client.getCredit();
// → { giftCredit: 120, purchaseCredit: 0, vipCredit: 60, totalCredit: 180 }

// 3. 查询积分消费历史（分页）
const history = await client.getCreditHistory('0', 20);
// → { records: [{ amount: 90, title: '视频生成', historyType: 2, ... }], hasMore: true, nextCursor: '...' }

// 4. 查询VIP订阅信息
const vipInfo = await client.getSubscriptionInfo();
// → { isVip: true, vipLevel: 'standard', endTime: 1773000000, isAutoRenew: true, ... }
```

| API 方法 | 端点 | 说明 |
|---------|------|------|
| `receiveCredit()` | `/commerce/v1/benefits/credit_receive` | 领取每日积分 + 查询总积分 |
| `getCredit()` | `/commerce/v1/benefits/user_credit` | 查询积分余额详细分类 |
| `getCreditHistory()` | `/commerce/v1/benefits/user_credit_history` | 积分消费/领取记录（分页） |
| `getSubscriptionInfo()` | `/commerce/v1/subscription/user_info` | VIP订阅状态 |

---

## 🔍 查询工具

### `query` - 查询单个任务

```typescript
{
  "historyId": "4761818115596"
}

// 返回：
{
  "status": "completed",
  "progress": 100,
  "imageUrls": ["https://...", "https://...", ...]
}
```

---

## 💻 本地开发

### 安装依赖

```bash
# 使用npm
npm install

# 或使用yarn
yarn install
```

### 开发命令

```bash
# 开发模式（热重载）
npm run dev

# 类型检查
npm run type-check

# 构建项目
npm run build

# 运行测试
npm test

# 测试覆盖率
npm run test:coverage

# 测试MCP服务器
npm run test:mcp
```

### 启动服务器

```bash
# MCP stdio模式
npm start

# HTTP API服务模式
npm run start:api
```

---

## 🚀 Seedance 2.0 使用指南

即梦 Web 端已上线 Seedance 2.0 视频生成模型，支持图文引用、视频引用和多种生成模式。以下说明如何使用本项目的 MCP 工具实现 Seedance 2.0 的各种场景。

### 场景对照表

| Seedance 2.0 场景 | 对应 MCP 工具 | 支持状态 | 说明 |
|-------------------|-------------|---------|------|
| 纯文字生成视频 | `video` | ✅ 已支持 | 直接描述即可生成 |
| 图生视频（首帧驱动） | `video_frame` | ✅ 已支持 | 提供首帧图片 + 描述 |
| 尾帧控制 | `video_frame` | ✅ 已支持 | 提供尾帧图片 + 描述 |
| 首尾帧控制 | `video_frame` | ✅ 已支持 | 同时提供首尾帧 |
| 多关键帧动画 | `video_multi` | ✅ 已支持 | 2-10个关键帧精确控制 |
| 多图主体融合 | `video_mix` | ✅ 已支持 | [图0][图1]语法组合主体 |
| 视频引用生成 | — | ❌ 未适配 | Seedance 2.0 新增能力 |
| 图片+视频混合引用 | — | ❌ 未适配 | Seedance 2.0 新增能力 |

### 场景1：纯文字生成视频

**Web 端操作**：在 Seedance 2.0 页面直接输入文字描述

**MCP 调用**：使用 `video` 工具
```json
{
  "prompt": "一位女孩站在樱花树下，花瓣飘落，微风吹动头发，柔和的自然光，电影感画面",
  "resolution": "1080p",
  "duration": 5000,
  "videoAspectRatio": "16:9",
  "async": true
}
```

### 场景2：图生视频（图片动起来）

**Web 端操作**：上传一张图片作为首帧，Seedance 2.0 让图片"动起来"

**MCP 调用**：使用 `video_frame` 工具，仅提供 `firstFrameImage`
```json
{
  "prompt": "女孩缓缓转头微笑，樱花花瓣从画面左侧飘过，镜头轻微推进",
  "firstFrameImage": "/path/to/girl-under-sakura.jpg",
  "resolution": "1080p",
  "duration": 5000,
  "async": true
}
```

### 场景3：首尾帧精确控制

**Web 端操作**：同时上传首帧和尾帧图片，Seedance 2.0 生成中间过渡

**MCP 调用**：使用 `video_frame` 工具，同时提供两张图片
```json
{
  "prompt": "从白天到夜晚的城市延时摄影，天空逐渐变暗，建筑灯光亮起，车流形成光轨",
  "firstFrameImage": "/path/to/city-day.jpg",
  "lastFrameImage": "/path/to/city-night.jpg",
  "resolution": "1080p",
  "duration": 8000,
  "async": true
}
```

### 场景4：多关键帧动画

**Web 端操作**：上传多个画面作为关键帧，Seedance 2.0 在帧间生成平滑过渡

**MCP 调用**：使用 `video_multi` 工具
```json
{
  "frames": [
    {
      "idx": 0,
      "imagePath": "/path/to/frame0-cat-sit.jpg",
      "duration_ms": 2000,
      "prompt": "镜头从正面缓慢推进，猫从坐姿站起，耳朵竖起，尾巴轻摆"
    },
    {
      "idx": 1,
      "imagePath": "/path/to/frame1-cat-walk.jpg",
      "duration_ms": 2000,
      "prompt": "猫向前迈步行走，步伐轻盈，背景虚化效果增强"
    },
    {
      "idx": 2,
      "imagePath": "/path/to/frame2-cat-jump.jpg",
      "duration_ms": 1000,
      "prompt": "结束帧，此prompt不生效"
    }
  ],
  "resolution": "720p",
  "fps": 24,
  "async": true
}
```

> **提示**：每帧的 `prompt` 描述的是从当前帧到下一帧的过渡过程（镜头运动、主体动作）。最后一帧的 prompt 不会生效。

### 场景5：多图主体融合

**Web 端操作**：上传多张图片，Seedance 2.0 将不同图片的主体组合到一个场景

**MCP 调用**：使用 `video_mix` 工具
```json
{
  "referenceImages": [
    "/path/to/golden-retriever.jpg",
    "/path/to/beach-sunset.jpg",
    "/path/to/frisbee.jpg"
  ],
  "prompt": "[图0]的金毛犬在[图1]的海滩上奔跑，嘴里叼着[图2]的飞盘，夕阳余晖洒在海面上",
  "resolution": "1080p",
  "duration": 5000,
  "async": true
}
```

> **语法说明**：`[图0]`、`[图1]`、`[图2]` 按 referenceImages 数组顺序引用。索引从0开始，最多4张。

### 场景6：异步任务查询

所有视频工具默认异步模式，提交后需要用 `query` 工具轮询结果：

```json
// 第一步：提交生成任务，获得任务ID
// → "任务ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

// 第二步：查询任务状态
{ "historyId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }

// → 生成中：{ status: "processing", progress: 45 }
// → 生成完成：{ status: "completed", videoUrl: "https://..." }
```

### Seedance 2.0 未适配功能（路线图）

以下是 Web 端 Seedance 2.0 已支持但本项目尚未实现的新能力：

| 功能 | 说明 | 状态 |
|------|------|------|
| **视频引用生成** | 上传视频作为参考，生成相似风格/运镜的新视频 | 🔜 规划中 |
| **图片+视频混合引用** | 在同一请求中同时引用图片和视频素材 | 🔜 规划中 |
| **视频文件上传** | 独立的视频上传流程（不同于图片上传） | 🔜 规划中 |
| **队列进度预估** | 返回排队位置和预估等待时间 | 🔜 规划中 |

**技术细节**（开发者参考）：

Seedance 2.0 使用了全新的 `unified_edit_input` 请求格式和 `seedance-2-0` 模型标识，与当前项目使用的 `jimeng-video-3.0` 请求格式不同。主要差异：

- **请求结构**：`unified_edit_input.common_input.model_name = "seedance-2-0"` 替代旧的 `video_mode` 字段
- **引用方式**：`visual_prompt.visual_list` 支持混合 `media_type: "image"` 和 `media_type: "video"` 引用
- **视频上传**：使用独立的 `/mweb/v1/video/get_upload_token` + `/mweb/v1/video/commit_upload` 流程
- **状态轮询**：返回 `queue_info.queue_position` 和 `estimated_wait_seconds` 等增强字段

> 欢迎社区贡献 PR 来完善 Seedance 2.0 适配。

---

## 🤔 常见问题

### 1. 图像生成失败

**检查清单**：
- ✅ `JIMENG_API_TOKEN`是否正确配置
- ✅ 即梦账号积分是否充足（[登录查看](https://jimeng.jianying.com)）
- ✅ 提示词是否包含敏感内容
- ✅ 参考图路径是否有效（网络图需可公开访问）

### 2. 继续生成未触发

**排查步骤**：
- ✅ prompt中是否明确指定数量（如"生成9张图片"）
- ✅ 查看API返回的`totalCount`是否正确识别
- ✅ 检查是否在同步模式下（async: false）
- ✅ 查看日志中的`[智能继续生成检测]`信息

### 3. 服务器无法启动

**解决方法**：
- ✅ 确保Node.js版本 ≥ 16.0
- ✅ 重新安装依赖：`rm -rf node_modules && npm install`
- ✅ 检查环境变量是否正确设置

### 4. 视频生成超时

**调整建议**：
- ✅ 使用异步模式（async: true）
- ✅ 降低分辨率（720p代替1080p）
- ✅ 减少视频时长（推荐5秒）
- ✅ 简化prompt描述

---

## 🎯 支持的模型

### 图片模型

| 模型名称 | 说明 | 推荐场景 |
|---------|------|---------|
| `jimeng-4.5` | 最新 4.5 模型（默认） | 全场景推荐，画质最佳 |
| `jimeng-4.1` | 4.1 版本 | 均衡画质与速度 |
| `jimeng-4.0` | 第四代模型 | 全场景推荐 |
| `jimeng-3.1` | 3.1 艺术版 | 艺术风格化 |
| `jimeng-3.0` | 第三代模型 | 风格化创作，画面鲜明 |
| `jimeng-2.1` | 稳定版本 | 常规生成 |
| `jimeng-2.0-pro` | Pro版本 | 高质量需求 |

### 视频模型

| 模型名称 | 说明 | 推荐场景 |
|---------|------|---------|
| `jimeng-video-3.0` | 主力模型（默认） | 全场景推荐 |
| `jimeng-video-3.0-pro` | Pro高质量版本 | 专业级作品 |
| `jimeng-video-2.0-pro` | 兼容性好 | 多场景适配 |
| `jimeng-video-2.0` | 基础版本 | 快速生成 |

> **Seedance 2.0 模型**：即梦 Web 端已上线 Seedance 2.0 视频模型，目前本项目视频工具使用 `jimeng-video-3.0` 系列调用。Seedance 2.0 采用了全新的 `unified_edit_input` 请求格式和混合图片/视频引用机制，相关接口适配正在规划中。

---

## 📊 架构亮点

### 组合模式设计

```typescript
class NewJimengClient {
  private httpClient: HttpClient              // HTTP请求和认证
  private imageUploader: ImageUploader        // 图片上传
  private creditService: NewCreditService     // 积分管理
  private videoService: VideoService          // 视频生成

  constructor(token?: string) {
    this.httpClient = new HttpClient(token);
    this.imageUploader = new ImageUploader(this.httpClient);
    this.creditService = new NewCreditService(this.httpClient);
    this.videoService = new VideoService(this.httpClient, this.imageUploader);
  }
}
```

### 代码减少对比

| 指标 | 重构前 | 重构后 | 改进 |
|------|-------|-------|------|
| 总代码行数 | 5,268行 | 1,335行 | **-74.6%** |
| 核心类数量 | 9个 | 5个 | **-44.4%** |
| 继承层级 | 3层 | 0层 | **扁平化** |
| 类型安全 | 部分 | 完整 | **100%** |

---

## 📦 手动安装（可选）

如果不使用npx方式，可以手动安装：

```bash
# 全局安装
npm install -g jimeng-web-mcp

# 或项目内安装
npm install jimeng-web-mcp
```

**Claude Desktop配置**：
```json
{
  "mcpServers": {
    "jimeng-web-mcp": {
      "command": "node",
      "args": ["/path/to/jimeng-web-mcp/lib/index.js"],
      "env": {
        "JIMENG_API_TOKEN": "你的sessionid"
      }
    }
  }
}
```

---

## 🤝 贡献

欢迎提交Issue和Pull Request！

---

## 📄 许可证

[MIT License](./LICENSE)

---

## 🔗 相关链接

- **GitHub仓库**: [LupinLin1/jimeng-web-mcp](https://github.com/LupinLin1/jimeng-web-mcp)
- **npm包**: [jimeng-web-mcp](https://www.npmjs.com/package/jimeng-web-mcp)
- **即梦AI官网**: [jimeng.jianying.com](https://jimeng.jianying.com)
- **MCP协议**: [modelcontextprotocol.io](https://modelcontextprotocol.io)

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给个Star支持一下！**

Made with ❤️ by [LupinLin1](https://github.com/LupinLin1)

</div>
