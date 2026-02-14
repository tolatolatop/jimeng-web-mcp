/**
 * VideoService - 统一视频生成服务
 * 合并4个独立生成器的功能（TextToVideo, MultiFrame, MainReference, Seedance）
 * 内联轮询逻辑（≤30行），移除timeout.ts依赖
 * 使用组合模式，依赖HttpClient、ImageUploader和VideoUploader
 */

import { HttpClient } from './HttpClient.js';
import { ImageUploader } from './ImageUploader.js';
import { VideoUploader } from './VideoUploader.js';
import { getModel } from '../types/models.js';
import { logger } from '../utils/logger.js';

// ==================== 类型定义 ====================

export interface VideoResult {
  videoUrl?: string;
  taskId?: string;
  metadata: {
    model: string;
    resolution: string;
    duration: number;
    fps: number;
  };
}

export interface TextToVideoParams {
  prompt: string;
  model?: string;
  resolution?: '720p' | '1080p';
  fps?: number;
  duration?: number;
  async?: boolean;
  firstFrameImage?: string;
  lastFrameImage?: string;
  videoAspectRatio?: string;
}

export interface FrameConfig {
  idx: number;
  imagePath: string;
  duration_ms: number;
  prompt: string;
}

export interface MultiFrameParams {
  frames: FrameConfig[];
  model?: string;
  resolution?: '720p' | '1080p';
  fps?: number;
  async?: boolean;
  videoAspectRatio?: string;
}

export interface MainReferenceParams {
  referenceImages: string[];
  prompt: string;
  model?: string;
  resolution?: '720p' | '1080p';
  fps?: number;
  duration?: number;
  async?: boolean;
  videoAspectRatio?: string;
}

/**
 * Seedance 2.0 参考素材定义
 */
export interface SeedanceMaterial {
  type: 'image' | 'video';
  filePath: string;  // 本地文件路径或URL
}

/**
 * Seedance 2.0 视频生成参数
 * 支持图片+视频混合参考
 */
export interface SeedanceParams {
  prompt: string;
  materials: SeedanceMaterial[];  // 参考素材列表（图片和/或视频）
  model?: string;                 // 默认 seedance-2.0
  resolution?: '720p' | '1080p';
  fps?: number;
  duration?: number;
  async?: boolean;
  videoAspectRatio?: string;
}

/**
 * VideoService类
 * 整合所有视频生成功能
 */
export class VideoService {
  private videoUploader: VideoUploader;

  constructor(
    private httpClient: HttpClient,
    private imageUploader: ImageUploader
  ) {
    this.videoUploader = new VideoUploader(httpClient);
  }

  // ==================== 公共方法：三种视频生成模式 ====================

  /**
   * 文本生成视频（支持首尾帧）
   */
  async generateTextToVideo(params: TextToVideoParams): Promise<VideoResult> {
    const {
      prompt,
      firstFrameImage,
      lastFrameImage,
      async: asyncMode = false,
      resolution = '720p',
      videoAspectRatio = '16:9',
      fps = 24,
      duration = 5000,
      model = 'jimeng-video-3.0'
    } = params;

    // 验证参数
    if (duration < 3000 || duration > 15000) {
      throw new Error('duration必须在3000-15000毫秒之间');
    }

    const actualModel = getModel(model);

    // 上传首尾帧图片
    let first_frame_image = undefined;
    let end_frame_image = undefined;

    if (firstFrameImage || lastFrameImage) {
      const uploadResults: any[] = [];

      if (firstFrameImage) {
        const result = await this.imageUploader.upload(firstFrameImage);
        uploadResults.push(result);
      }

      if (lastFrameImage) {
        const result = await this.imageUploader.upload(lastFrameImage);
        if (!firstFrameImage) uploadResults.unshift(null as any);
        uploadResults.push(result);
      }

      if (uploadResults[0]) {
        first_frame_image = {
          format: uploadResults[0].format,
          height: uploadResults[0].height,
          id: this.generateUuid(),
          image_uri: uploadResults[0].uri,
          name: "",
          platform_type: 1,
          source_from: "upload",
          type: "image",
          uri: uploadResults[0].uri,
          width: uploadResults[0].width,
        };
      }

      if (uploadResults[1]) {
        end_frame_image = {
          format: uploadResults[1].format,
          height: uploadResults[1].height,
          id: this.generateUuid(),
          image_uri: uploadResults[1].uri,
          name: "",
          platform_type: 1,
          source_from: "upload",
          type: "image",
          uri: uploadResults[1].uri,
          width: uploadResults[1].width,
        };
      }
    }

    // 构建draft_content请求体（与旧代码完全一致）
    const componentId = this.generateUuid();
    const submitId = this.generateUuid();
    const metricsExtra = JSON.stringify({
      "enterFrom": "click",
      "isDefaultSeed": 1,
      "promptSource": "custom",
      "isRegenerate": false,
      "originSubmitId": this.generateUuid(),
    });

    const requestBody = {
      "extend": {
        "root_model": end_frame_image ? 'dreamina_ic_generate_video_model_vgfm_3.0' : actualModel,
        "m_video_commerce_info": {
          benefit_type: "basic_video_operation_vgfm_v_three",
          resource_id: "generate_video",
          resource_id_type: "str",
          resource_sub_type: "aigc"
        },
        "m_video_commerce_info_list": [{
          benefit_type: "basic_video_operation_vgfm_v_three",
          resource_id: "generate_video",
          resource_id_type: "str",
          resource_sub_type: "aigc"
        }]
      },
      "submit_id": submitId,
      "metrics_extra": metricsExtra,
      "draft_content": JSON.stringify({
        "type": "draft",
        "id": this.generateUuid(),
        "min_version": "3.0.5",
        "is_from_tsn": true,
        "version": "3.3.2",
        "main_component_id": componentId,
        "component_list": [{
          "type": "video_base_component",
          "id": componentId,
          "min_version": "1.0.0",
          "metadata": {
            "type": "",
            "id": this.generateUuid(),
            "created_platform": 3,
            "created_platform_version": "",
            "created_time_in_ms": Date.now(),
            "created_did": ""
          },
          "generate_type": "gen_video",
          "aigc_mode": "workbench",
          "abilities": {
            "type": "",
            "id": this.generateUuid(),
            "gen_video": {
              "id": this.generateUuid(),
              "type": "",
              "text_to_video_params": {
                "type": "",
                "id": this.generateUuid(),
                "model_req_key": actualModel,
                "priority": 0,
                "seed": Math.floor(Math.random() * 100000000) + 2500000000,
                "video_aspect_ratio": videoAspectRatio,
                "video_gen_inputs": [{
                  duration_ms: duration,
                  first_frame_image: first_frame_image,
                  end_frame_image: end_frame_image,
                  fps: fps,
                  id: this.generateUuid(),
                  min_version: "3.0.5",
                  prompt: prompt,
                  resolution: resolution,
                  type: "",
                  video_mode: 2
                }]
              },
              "video_task_extra": metricsExtra,
            }
          }
        }],
      }),
    };

    // 提交任务
    const taskId = await this.submitTaskWithDraft(requestBody);

    if (asyncMode) {
      return {
        taskId,
        metadata: { model, resolution, duration, fps }
      };
    }

    // 同步模式：轮询
    const videoUrl = await this.pollUntilComplete(taskId);
    return {
      videoUrl,
      metadata: { model, resolution, duration, fps }
    };
  }

  /**
   * 生成UUID（本地方法）
   */
  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * 多帧视频生成（2-10帧）
   */
  async generateMultiFrame(params: MultiFrameParams): Promise<VideoResult> {
    const {
      frames,
      async: asyncMode = false,
      resolution = '720p',
      fps = 24,
      model = 'jimeng-video-3.0',
      videoAspectRatio = '16:9'
    } = params;

    // 验证参数
    if (frames.length < 2 || frames.length > 10) {
      throw new Error('帧数量必须在2-10之间');
    }

    // 按索引排序
    const sortedFrames = [...frames].sort((a, b) => a.idx - b.idx);

    // 计算总时长
    const totalDuration = sortedFrames.reduce((sum, f) => sum + f.duration_ms, 0);

    // 上传所有帧图片
    const uploadedFrames = await this.uploadFrames(sortedFrames.map(f => f.imagePath));

    // 构建完整的multiFrames数组（包含media_info结构）
    const multiFrames = sortedFrames.map((frame, index) => ({
      type: "",
      id: this.generateUuid(),
      idx: frame.idx,
      duration_ms: frame.duration_ms,
      prompt: frame.prompt,
      media_info: {
        type: "",
        id: this.generateUuid(),
        media_type: 1,
        image_info: {
          type: "image",
          id: this.generateUuid(),
          source_from: "upload",
          platform_type: 1,
          name: "",
          image_uri: uploadedFrames[index].uri,
          width: uploadedFrames[index].width,
          height: uploadedFrames[index].height,
          format: uploadedFrames[index].format,
          uri: uploadedFrames[index].uri
        }
      }
    }));

    // 获取模型标识
    const actualModel = getModel(model);
    const componentId = this.generateUuid();
    const submitId = this.generateUuid();

    // 构建metrics_extra
    const metricsExtra = {
      isDefaultSeed: 1,
      originSubmitId: submitId,
      isRegenerate: false,
      enterFrom: "result_click_reference",
      functionMode: "multi_frame"
    };

    // 构建draft_content（完整结构）
    const draftContent = {
      type: "draft",
      id: this.generateUuid(),
      min_version: "3.0.5",
      min_features: ["AIGC_GenerateType_VideoMultiFrame"],
      is_from_tsn: true,
      version: "3.3.3",
      main_component_id: componentId,
      component_list: [{
        type: "video_base_component",
        id: componentId,
        min_version: "1.0.0",
        aigc_mode: "workbench",
        metadata: {
          type: "",
          id: this.generateUuid(),
          created_platform: 3,
          created_platform_version: "",
          created_time_in_ms: Date.now().toString(),
          created_did: ""
        },
        generate_type: "gen_video",
        abilities: {
          type: "",
          id: this.generateUuid(),
          gen_video: {
            type: "",
            id: this.generateUuid(),
            text_to_video_params: {
              type: "",
              id: this.generateUuid(),
              video_gen_inputs: [{
                type: "",
                id: this.generateUuid(),
                min_version: "3.0.5",
                prompt: "",
                video_mode: 1,
                fps: fps,
                duration_ms: totalDuration,
                resolution: resolution,
                multi_frames: multiFrames
              }],
              video_aspect_ratio: videoAspectRatio,
              seed: Math.floor(Math.random() * 100000000) + 2500000000,
              model_req_key: actualModel,
              priority: 0
            },
            video_task_extra: JSON.stringify(metricsExtra)
          }
        },
        process_type: 1
      }]
    };

    // 构建完整请求体
    const requestBody = {
      extend: {
        root_model: actualModel,
        m_video_commerce_info: {
          benefit_type: "basic_video_operation_vgfm_v_three",
          resource_id: "generate_video",
          resource_id_type: "str",
          resource_sub_type: "aigc"
        },
        m_video_commerce_info_list: [{
          benefit_type: "basic_video_operation_vgfm_v_three",
          resource_id: "generate_video",
          resource_id_type: "str",
          resource_sub_type: "aigc"
        }]
      },
      submit_id: submitId,
      metrics_extra: JSON.stringify(metricsExtra),
      draft_content: JSON.stringify(draftContent),
      http_common_info: { aid: 513695 }
    };

    // 提交任务
    const taskId = await this.submitTaskWithDraft(requestBody);

    if (asyncMode) {
      return {
        taskId,
        metadata: { model, resolution, duration: totalDuration, fps }
      };
    }

    // 同步模式：轮询
    const videoUrl = await this.pollUntilComplete(taskId);
    return {
      videoUrl,
      metadata: { model, resolution, duration: totalDuration, fps }
    };
  }

  /**
   * 主参考视频生成（2-4张参考图）
   */
  async generateMainReference(params: MainReferenceParams): Promise<VideoResult> {
    const {
      referenceImages,
      prompt,
      async: asyncMode = false,
      resolution = '720p',
      fps = 24,
      duration = 5000,
      model = 'jimeng-video-3.0',
      videoAspectRatio = '16:9'
    } = params;

    // 验证参数
    if (referenceImages.length < 2 || referenceImages.length > 4) {
      throw new Error('参考图片数量必须在2-4之间');
    }

    if (!prompt.includes('[图')) {
      throw new Error('必须包含至少一个图片引用（如[图0]）');
    }

    const actualModel = getModel(model);

    // 上传参考图片
    const uploadedImages = await this.uploadFrames(referenceImages);

    // 解析提示词，提取[图N]引用
    const { textSegments, imageRefs } = this.parseMainReferencePrompt(prompt, referenceImages.length);

    // 构建idip_meta_list
    const idip_meta_list = this.buildIdipMetaList(textSegments, imageRefs);

    // 构建idip_frames（完整图片对象）
    const idip_frames = uploadedImages.map(img => ({
      format: img.format,
      height: img.height,
      id: this.generateUuid(),
      image_uri: img.uri,
      name: "",
      platform_type: 1,
      source_from: "upload",
      type: "image",
      uri: img.uri,
      width: img.width,
    }));

    // 构建draft_content请求体
    const componentId = this.generateUuid();
    const submitId = this.generateUuid();
    const metricsExtra = {
      "isDefaultSeed": 1,
      "originSubmitId": submitId,
      "isRegenerate": false,
      "enterFrom": "click",
      "functionMode": "main_reference"
    };

    const draftContent = {
        "type": "draft",
        "id": this.generateUuid(),
        "min_version": "3.0.5",
        "min_features": ["AIGC_GenerateType_VideoIdipFrame"],
        "is_from_tsn": true,
        "version": "3.3.3",
        "main_component_id": componentId,
        "component_list": [{
          "type": "video_base_component",
          "id": componentId,
          "min_version": "1.0.0",
          "aigc_mode": "workbench",
          "metadata": {
            "type": "",
            "id": this.generateUuid(),
            "created_platform": 3,
            "created_platform_version": "",
            "created_time_in_ms": Date.now().toString(),
            "created_did": ""
          },
          "generate_type": "gen_video",
          "abilities": {
            "type": "",
            "id": this.generateUuid(),
            "gen_video": {
              "type": "",
              "id": this.generateUuid(),
              "text_to_video_params": {
                "type": "",
                "id": this.generateUuid(),
                "video_gen_inputs": [{
                  "type": "",
                  "id": this.generateUuid(),
                  "min_version": "3.0.5",
                  "prompt": "",
                  "video_mode": 2,
                  "fps": fps,
                  "duration_ms": duration,
                  "resolution": resolution,
                  "idip_frames": idip_frames,
                  "idip_meta_list": idip_meta_list
                }],
                "video_aspect_ratio": videoAspectRatio,
                "seed": Math.floor(Math.random() * 100000000) + 2500000000,
                "model_req_key": actualModel,
                "priority": 0
              },
              "video_task_extra": JSON.stringify(metricsExtra)
            }
          },
          "process_type": 1
        }]
    };

    const requestBody = {
      "extend": {
        "root_model": actualModel,
        "m_video_commerce_info": {
          "benefit_type": "basic_video_operation_vgfm_v_three",
          "resource_id": "generate_video",
          "resource_id_type": "str",
          "resource_sub_type": "aigc"
        },
        "m_video_commerce_info_list": [{
          "benefit_type": "basic_video_operation_vgfm_v_three",
          "resource_id": "generate_video",
          "resource_id_type": "str",
          "resource_sub_type": "aigc"
        }]
      },
      "submit_id": submitId,
      "metrics_extra": JSON.stringify(metricsExtra),
      "draft_content": JSON.stringify(draftContent),
      "http_common_info": { "aid": 513695 }
    };

    // 调试：打印请求体
    // console.log('🔍 [主体参考] 请求体:', JSON.stringify(requestBody, null, 2));

    // 提交任务
    const taskId = await this.submitTaskWithDraft(requestBody);

    if (asyncMode) {
      return {
        taskId,
        metadata: { model, resolution, duration, fps }
      };
    }

    // 同步模式：轮询
    const videoUrl = await this.pollUntilComplete(taskId);
    return {
      videoUrl,
      metadata: { model, resolution, duration, fps }
    };
  }

  /**
   * Seedance 2.0 视频生成（图+视频混合参考）
   * 使用 unified_edit_input 格式，支持 image + video 混合 material_list
   */
  async generateSeedance(params: SeedanceParams): Promise<VideoResult> {
    const {
      prompt,
      materials,
      async: asyncMode = true,
      resolution = '720p',
      fps = 24,
      duration = 5000,
      model = 'seedance-2.0',
      videoAspectRatio = '16:9'
    } = params;

    // 参数验证
    if (!materials || materials.length === 0) {
      throw new Error('至少需要提供1个参考素材（图片或视频）');
    }
    if (materials.length > 4) {
      throw new Error('最多支持4个参考素材');
    }
    if (duration < 3000 || duration > 15000) {
      throw new Error('duration必须在3000-15000毫秒之间');
    }

    const actualModel = getModel(model);

    // 上传所有素材（图片和视频分别处理）
    const materialList: any[] = [];
    for (const mat of materials) {
      if (mat.type === 'image') {
        const uploadResult = await this.imageUploader.upload(mat.filePath);
        materialList.push({
          type: "",
          id: this.generateUuid(),
          material_type: "image",
          image_info: {
            type: "image",
            id: this.generateUuid(),
            source_from: "upload",
            platform_type: 1,
            name: "",
            image_uri: uploadResult.uri,
            aigc_image: {
              type: "",
              id: this.generateUuid(),
            },
            width: uploadResult.width,
            height: uploadResult.height,
            format: uploadResult.format || "",
            uri: uploadResult.uri,
          }
        });
      } else if (mat.type === 'video') {
        const uploadResult = await this.videoUploader.upload(mat.filePath);
        materialList.push({
          type: "",
          id: this.generateUuid(),
          material_type: "video",
          video_info: {
            type: "video",
            id: this.generateUuid(),
            source_from: "upload",
            name: "",
            vid: uploadResult.vid,
            fps: 0,
            width: uploadResult.width,
            height: uploadResult.height,
            duration: uploadResult.duration,
          }
        });
      } else {
        throw new Error(`不支持的素材类型: ${mat.type}，仅支持 image 和 video`);
      }
    }

    // 构建 meta_list（文本提示词）
    const metaList: any[] = [];
    if (prompt.trim()) {
      metaList.push({
        meta_type: "text",
        text: prompt.trim()
      });
    }

    // 构建 draft_content
    const componentId = this.generateUuid();
    const submitId = this.generateUuid();

    // 确定 benefit_type
    const hasVideo = materials.some(m => m.type === 'video');
    const benefitType = hasVideo
      ? 'dreamina_seedance_20_fast_with_video'
      : 'dreamina_seedance_20_fast';

    const metricsExtra = {
      isDefaultSeed: 1,
      originSubmitId: submitId,
      isRegenerate: false,
      enterFrom: "reprompt",
      position: "page_bottom_box",
      functionMode: "omni_reference",
      sceneOptions: JSON.stringify([{
        type: "video",
        scene: "BasicVideoGenerateButton",
        modelReqKey: actualModel,
        videoDuration: Math.round(duration / 1000),
        reportParams: {
          enterSource: "generate",
          vipSource: "generate",
          extraVipFunctionKey: actualModel,
          useVipFunctionDetailsReporterHoc: true
        },
        materialTypes: this.getMaterialTypeFlags(materials),
      }])
    };

    const draftContent = {
      type: "draft",
      id: this.generateUuid(),
      min_version: "3.3.9",
      min_features: ["AIGC_Video_UnifiedEdit"],
      is_from_tsn: true,
      version: "3.3.9",
      main_component_id: componentId,
      component_list: [{
        type: "video_base_component",
        id: componentId,
        min_version: "1.0.0",
        aigc_mode: "workbench",
        metadata: {
          type: "",
          id: this.generateUuid(),
          created_platform: 3,
          created_platform_version: "",
          created_time_in_ms: Date.now().toString(),
          created_did: ""
        },
        generate_type: "gen_video",
        abilities: {
          type: "",
          id: this.generateUuid(),
          gen_video: {
            type: "",
            id: this.generateUuid(),
            text_to_video_params: {
              type: "",
              id: this.generateUuid(),
              video_gen_inputs: [{
                type: "",
                id: this.generateUuid(),
                min_version: "3.3.9",
                prompt: "",  // prompt 放在 meta_list 中
                video_mode: 2,
                fps: fps,
                duration_ms: duration,
                idip_meta_list: [],  // Seedance 2.0 不使用 idip_meta_list
                unified_edit_input: {
                  type: "",
                  id: this.generateUuid(),
                  material_list: materialList,
                  meta_list: metaList,
                }
              }],
              video_aspect_ratio: videoAspectRatio,
              seed: Math.floor(Math.random() * 100000000) + 2500000000,
              model_req_key: actualModel,
              priority: 0,
            },
            video_task_extra: JSON.stringify(metricsExtra),
          }
        },
        process_type: 1
      }]
    };

    const requestBody = {
      extend: {
        root_model: actualModel,
        m_video_commerce_info: {
          benefit_type: benefitType,
          resource_id: "generate_video",
          resource_id_type: "str",
          resource_sub_type: "aigc"
        },
        m_video_commerce_info_list: [{
          benefit_type: benefitType,
          resource_id: "generate_video",
          resource_id_type: "str",
          resource_sub_type: "aigc"
        }]
      },
      submit_id: submitId,
      metrics_extra: JSON.stringify(metricsExtra),
      draft_content: JSON.stringify(draftContent),
      http_common_info: { aid: 513695 }
    };

    // 提交任务
    const taskId = await this.submitTaskWithDraft(requestBody);

    if (asyncMode) {
      return {
        taskId,
        metadata: { model, resolution, duration, fps }
      };
    }

    // 同步模式：轮询
    const videoUrl = await this.pollUntilComplete(taskId);
    return {
      videoUrl,
      metadata: { model, resolution, duration, fps }
    };
  }

  /**
   * 获取素材类型标识数组（用于 sceneOptions.materialTypes）
   * 1=image, 2=video
   */
  private getMaterialTypeFlags(materials: SeedanceMaterial[]): number[] {
    const flags = new Set<number>();
    for (const m of materials) {
      if (m.type === 'image') flags.add(1);
      if (m.type === 'video') flags.add(2);
    }
    return Array.from(flags).sort();
  }

  // ==================== 私有方法：共享逻辑 ====================

  /**
   * 上传多个帧图片
   */
  private async uploadFrames(imagePaths: string[]): Promise<any[]> {
    return this.imageUploader.uploadBatch(imagePaths);
  }

  /**
   * 提交draft格式的视频生成任务
   */
  private async submitTaskWithDraft(requestBody: any): Promise<string> {
    const requestParams = this.httpClient.generateRequestParams();

    const response = await this.httpClient.request({
      method: 'POST',
      url: '/mweb/v1/aigc_draft/generate',
      params: requestParams,
      data: requestBody
    });

    // 视频生成需要使用submit_id进行轮询（与图片不同！）
    const submitId = response?.data?.aigc_data?.task?.submit_id ||
                     response?.data?.aigc_data?.submit_id ||
                     response?.data?.submit_id ||
                     response?.submit_id;

    if (!submitId) {
      throw new Error(response.errmsg || '提交视频任务失败：未返回submit_id');
    }

    return submitId;
  }

  /**
   * 轮询直到任务完成（内联实现，≤30行）
   */
  private async pollUntilComplete(taskId: string): Promise<string> {
    const startTime = Date.now();
    const timeout = 600000; // 600秒
    let pollCount = 0;

    while (Date.now() - startTime < timeout) {
      pollCount++;

      // 第一次等待60秒，后续等待5秒（与旧代码一致）
      const waitTime = pollCount === 1 ? 60000 : 5000;
      // console.log(`🔄 [轮询${pollCount}] 等待 ${waitTime/1000}秒...`);
      await this.sleep(waitTime);

      const status = await this.checkTaskStatus(taskId);

      // 关键修改：参考旧代码逻辑
      // 只要有video_url就返回，不强制要求status='completed'
      // 因为有时候视频已经生成完成，但状态字段还没更新
      if (status.video_url) {
        // console.log(`✅ [轮询${pollCount}] 成功获取到视频URL`);
        return status.video_url;
      }

      // 检查失败状态
      if (status.status === 'failed') {
        throw new Error(status.error || '视频生成失败');
      }

      // 如果status是completed但没有URL，报错
      if (status.status === 'completed' && !status.video_url) {
        logger.debug(`❌ 视频生成完成但未找到URL，完整状态: ${JSON.stringify(status, null, 2)}`);
        throw new Error('视频生成完成但未返回URL');
      }

      // 继续下一轮轮询
      // console.log(`⏳ [轮询${pollCount}] 状态=${status.status}, 继续等待...`);
    }

    throw new Error(`视频生成超时: taskId=${taskId}`);
  }

  /**
   * 检查任务状态
   */
  private async checkTaskStatus(taskId: string): Promise<any> {
    const requestParams = this.httpClient.generateRequestParams();

    const response = await this.httpClient.request({
      method: 'POST',
      url: '/mweb/v1/get_history_by_ids',
      params: requestParams,
      data: { submit_ids: [taskId] }  // 视频轮询使用submit_ids
    });

    // 输出完整响应（不截断）以便调试
    // console.log('🔍 [checkTaskStatus] 完整响应:', JSON.stringify(response, null, 2));

    const record = response?.data?.[taskId];
    if (!record) {
      // console.log('⚠️  [checkTaskStatus] 未找到record，继续等待');
      return { status: 'processing' };
    }

    // console.log('📊 [checkTaskStatus] 完整record:', JSON.stringify(record, null, 2));

    // 解析状态（支持多种状态字段）
    const status = record.common_attr?.status ?? record.status ?? 'unknown';
    const failCode = record.common_attr?.fail_code ?? record.fail_code ?? null;

    // 映射状态
    let mappedStatus: string;
    if (status === 'completed' || status === 'success' || status === 50) {
      mappedStatus = 'completed';
    } else if (status === 'failed' || status === 'error' || status === 30) {
      mappedStatus = 'failed';
    } else if (status === 20 || status === 42 || status === 45) {
      mappedStatus = 'processing';
    } else {
      mappedStatus = 'processing';
    }

    // 提取视频URL（尝试所有可能的路径）
    let videoUrl = null;
    if (record.item_list && record.item_list.length > 0) {
      const item = record.item_list[0];

      // 打印完整item结构以便调试
      // console.log('🎬 [checkTaskStatus] 完整item结构:', JSON.stringify(item, null, 2));

      // 尝试多种可能的路径
      videoUrl =
        // 常见路径
        item?.video?.transcoded_video?.origin?.video_url ||
        item?.video?.video_url ||
        item?.video?.origin?.video_url ||
        item?.video?.transcoded_video?.video_url ||

        // 备选路径
        item?.common_attr?.cover_url ||
        item?.aigc_video_params?.video_url ||
        item?.url ||
        item?.video_url ||

        // 新增可能的路径
        item?.media_info?.video?.video_url ||
        item?.media_info?.video_url ||
        item?.video_info?.video_url ||
        item?.output_video?.video_url ||
        item?.result?.video_url;

      // 如果还是没找到，深度搜索所有包含url的字段
      if (!videoUrl) {
        // console.log('🔍 [checkTaskStatus] 深度搜索URL字段...');
        videoUrl = this.deepSearchUrl(item);
        if (videoUrl) {
          // console.log(`✅ [checkTaskStatus] 深度搜索找到URL:`, videoUrl);
        }
      }

      if (!videoUrl) {
        logger.debug(`❌ [checkTaskStatus] 无法找到视频URL，完整item: ${JSON.stringify(item, null, 2)}`);
      }
    } else {
      // console.log('⚠️ [checkTaskStatus] item_list为空或不存在');
      // console.log('📦 [checkTaskStatus] record完整结构:', JSON.stringify(record, null, 2));
    }

    return {
      status: mappedStatus,
      video_url: videoUrl,
      error: failCode ? `生成失败 (错误码: ${failCode})` : null
    };
  }

  /**
   * 深度搜索对象中的URL字段
   */
  private deepSearchUrl(obj: any, depth: number = 0, maxDepth: number = 5): string | null {
    if (!obj || typeof obj !== 'object' || depth > maxDepth) {
      return null;
    }

    // 检查当前层级的所有键
    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();

      // 如果键名包含url，并且值是字符串且以http开头
      if ((lowerKey.includes('url') || lowerKey.includes('uri')) &&
          typeof obj[key] === 'string' &&
          obj[key].startsWith('http')) {
        // console.log(`🔍 [deepSearchUrl] 在 ${key} 找到URL (深度${depth}):`, obj[key]);
        return obj[key];
      }

      // 递归搜索嵌套对象
      if (typeof obj[key] === 'object') {
        const found = this.deepSearchUrl(obj[key], depth + 1, maxDepth);
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 查询视频生成结果（单个）
   */
  async queryVideo(submitId: string): Promise<any> {
    const status = await this.checkTaskStatus(submitId);
    return status;
  }

  /**
   * 批量查询视频生成结果
   */
  async queryVideoBatch(submitIds: string[]): Promise<Record<string, any>> {
    const requestParams = this.httpClient.generateRequestParams();

    const response = await this.httpClient.request({
      method: 'POST',
      url: '/mweb/v1/get_history_by_ids',
      params: requestParams,
      data: { submit_ids: submitIds }
    });

    const results: Record<string, any> = {};

    for (const submitId of submitIds) {
      const record = response?.data?.[submitId];

      if (!record) {
        results[submitId] = { status: 'not_found', error: '记录不存在' };
        continue;
      }

      // 解析状态
      const statusCode = record.status;
      let mappedStatus: string;

      if (statusCode === 50) {
        mappedStatus = 'completed';
      } else if (statusCode === 30) {
        mappedStatus = 'failed';
      } else if (statusCode === 20 || statusCode === 42 || statusCode === 45) {
        mappedStatus = 'processing';
      } else {
        mappedStatus = 'unknown';
      }

      // 提取视频URL（与checkTaskStatus保持一致）
      let videoUrl = null;
      if (record.item_list && record.item_list.length > 0) {
        const item = record.item_list[0];
        videoUrl = item?.video?.transcoded_video?.origin?.video_url ||
                  item?.video?.video_url ||
                  item?.video?.origin?.video_url;
      }

      results[submitId] = {
        status: mappedStatus,
        video_url: videoUrl,
        error: statusCode === 30 ? (record.fail_code || '生成失败') : null,
        raw_status: statusCode
      };
    }

    return results;
  }

  /**
   * 解析主参考提示词（提取[图N]引用）
   */
  private parseMainReferencePrompt(prompt: string, imageCount: number): {
    textSegments: string[];
    imageRefs: number[];
  } {
    const regex = /\[图(\d+)\]/g;
    const textSegments: string[] = [];
    const imageRefs: number[] = [];

    let lastIndex = 0;
    let match;

    while ((match = regex.exec(prompt)) !== null) {
      // 添加前面的文本段
      if (match.index > lastIndex) {
        textSegments.push(prompt.substring(lastIndex, match.index));
      }

      // 添加图片引用索引
      const imageIndex = parseInt(match[1]);
      if (imageIndex >= imageCount) {
        throw new Error(`图片引用[图${imageIndex}]超出范围（0-${imageCount - 1}）`);
      }
      imageRefs.push(imageIndex);

      lastIndex = regex.lastIndex;
    }

    // 添加最后的文本段
    if (lastIndex < prompt.length) {
      textSegments.push(prompt.substring(lastIndex));
    }

    return { textSegments, imageRefs };
  }

  /**
   * 构建idip_meta_list（主参考模式参数）
   * 正确格式参考: generate_zhuti_request.json
   */
  private buildIdipMetaList(textSegments: string[], imageRefs: number[]): any[] {
    const metaList: any[] = [];

    for (let i = 0; i < Math.max(textSegments.length, imageRefs.length); i++) {
      // 先添加图片引用
      if (i < imageRefs.length) {
        metaList.push({
          type: "",
          id: this.generateUuid(),
          meta_type: "idip_frame",
          text: "",
          frame_info: {
            type: "",
            id: this.generateUuid(),
            image_idx: imageRefs[i]
          }
        });
      }

      // 后添加文本段
      if (i < textSegments.length && textSegments[i].trim()) {
        metaList.push({
          type: "",
          id: this.generateUuid(),
          meta_type: "text",
          text: textSegments[i].trim()
        });
      }
    }

    return metaList;
  }
}
