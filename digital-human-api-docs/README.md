# 创作数字人视频：API 调用流程详解

本文档详细记录了通过调用即梦 AI (jimeng.jianying.com) 的后端 API 来创作一个数字人视频的完整流程。所有分析均基于对前端网络请求的捕获和整理。

**重要提示**: 由于工具限制，所有保存的请求和响应文件中，**Body（请求/响应体）部分未能被捕获**。文件内容主要包含 Headers 信息，Body 部分的描述是基于通用 API 设计的推测。

---

## API 调用总览

整个流程可以分为以下几个核心阶段：

1.  **获取上传凭证**: 客户端向服务器申请上传许可。
2.  **上传文件**: 客户端将图片、视频等素材上传到指定的云存储地址。
3.  **生成音频**: 客户端提交文本，请求 TTS (Text-to-Speech) 服务生成音频。
4.  **预处理**: 对上传的素材和生成的音频进行预处理。
5.  **唇形同步**: 调用核心算法，使人物唇形与音频同步。
6.  **发起生成**: 提交所有处理好的素材和参数，正式请求服务器生成最终视频。
7.  **轮询状态**: 客户端定时查询任务状态，直到任务完成。

---

## 详细步骤

### 第 1 步：获取上传凭证

在上传任何文件之前，客户端必须先获取一个有效的上传令牌。

- **Endpoint**: `/mweb/v1/get_upload_token`
- **Method**: `POST`
- **描述**: 向即梦服务器请求上传许可，服务器返回用于后续上传操作的凭证信息。
- **文件**:
  - [请求: `01-get_upload_token-request.json`](./01-get_upload_token-request.json)
  - [响应: `01-get_upload_token-response.json`](./01-get_upload_token-response.json)

### 第 2 步：上传文件 (图片)

这个过程本身被拆分成了三个子步骤，与字节跳动的 ImageX 服务进行交互。

#### 2a. 申请上传

- **Endpoint**: `https://imagex.bytedanceapi.com/?Action=ApplyImageUpload`
- **Method**: `GET`
- **描述**: 向 ImageX 服务申请一个临时的上传地址。
- **文件**:
  - [请求: `02a-ApplyImageUpload-request.json`](./02a-ApplyImageUpload-request.json)
  - [响应: `02a-ApplyImageUpload-response.json`](./02a-ApplyImageUpload-response.json)

#### 2b. 上传文件本体

- **Endpoint**: `https://tos-d-x-lf.snssdk.com/...`
- **Method**: `POST`
- **描述**: 将文件的二进制数据上传到上一步获取的临时地址。
- **文件**:
  - [请求: `02b-UploadFile-request.json`](./02b-UploadFile-request.json)
  - [响应: `02b-UploadFile-response.json`](./02b-UploadFile-response.json)

#### 2c. 确认上传

- **Endpoint**: `https://imagex.bytedanceapi.com/?Action=CommitImageUpload`
- **Method**: `POST`
- **描述**: 通知 ImageX 服务文件已上传完毕，可以进行后续处理。
- **文件**:
  - [请求: `02c-CommitImageUpload-request.json`](./02c-CommitImageUpload-request.json)
  - [响应: `02c-CommitImageUpload-response.json`](./02c-CommitImageUpload-response.json)

### 第 3 步：生成音频 (TTS)

- **Endpoint**: `/mweb/v1/tts_generate`
- **Method**: `POST`
- **描述**: 发送需要转换的文本和指定的音色，服务器返回生成的音频文件信息。
- **文件**:
  - [请求: `03-tts_generate-request.json`](./03-tts_generate-request.json)
  - [响应: `03-tts_generate-response.json`](./03-tts_generate-response.json)

### 第 4 步：视频生成预处理

- **Endpoint**: `/mweb/v1/video_generate/pre_process`
- **Method**: `POST`
- **描述**: 在正式合成前，对所有素材（图片、音频等）进行预处理和验证。
- **文件**:
  - [请求: `04-video_preprocess-request.json`](./04-video_preprocess-request.json)
  - [响应: `04-video_preprocess-response.json`](./04-video_preprocess-response.json)

### 第 5 步：唇形同步算法代理

- **Endpoint**: `/mweb/v1/algo_proxy`
- **Method**: `POST`
- **描述**: 这是数字人功能的核心步骤之一，调用专门的算法服务来处理音频和人物唇形的同步。
- **文件**:
  - [请求: `05-algo_proxy-request.json`](./05-algo_proxy-request.json)
  - [响应: `05-algo_proxy-response.json`](./05-algo_proxy-response.json)

### 第 6 步：发起最终生成任务

- **Endpoint**: `/mweb/v1/aigc_draft/generate`
- **Method**: `POST`
- **描述**: 这是触发最终视频合成的请求，将之前所有步骤处理好的资源ID和配置参数整合在一起，提交给服务器创建异步生成任务。
- **文件**:
  - [请求: `06-aigc_draft_generate-request.json`](./06-aigc_draft_generate-request.json)
  - [响应: `06-aigc_draft_generate-response.json`](./06-aigc_draft_generate-response.json)

### 第 7 步：轮询任务状态

- **Endpoint**: `/mweb/v1/get_history_queue_info`
- **Method**: `POST`
- **描述**: 在发起生成任务后，客户端会以此接口定时（例如每隔几秒）查询任务的进度，直到获取到“完成”或“失败”的状态。
- **文件**:
  - [请求: `07-get_history_queue_info-request.json`](./07-get_history_queue_info-request.json)
  - [响应: `07-get_history_queue_info-response.json`](./07-get_history_queue_info-response.json)

---
文档整理完毕。
