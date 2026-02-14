/**
 * JiMeng MCP API - 重构后的主入口文件
 * 
 * 📁 此文件已重构为模块化架构，原2800+行代码被拆分为以下模块：
 * - src/types/api.types.ts - API类型定义 (200行)
 * - src/types/models.ts - 模型映射和常量 (80行)
 * - src/api/ApiClient.ts - 基础API客户端 (90行)
 * - src/api/CreditService.ts - 积分服务 (40行)
 * - src/api/JimengClient.ts - 统一客户端 (400行)
 * - src/utils/auth.ts - 认证工具 (200行)
 * - src/utils/dimensions.ts - 尺寸计算工具 (已存在)
 * 
 * ✅ 保持完全向后兼容 - 所有现有代码无需修改即可正常工作
 * 🔄 如遇问题，可使用 api-original-backup.ts 作为备用方案
 */

// ============== 重新导出所有类型 ==============
export * from './types/api.types.js';
export * from './types/models.js';

// ============== 重新导出工具类 ==============
export { ImageDimensionCalculator } from './utils/dimensions.js';
export { generateCookie } from './utils/auth.js';

// ============== API功能导出 ==============
// REFACTOR: Using new composition-based implementation
import { NewJimengClient } from './api/NewJimengClient.js';
import {
  ImageGenerationParams,
  VideoGenerationParams,
  MainReferenceVideoParams,
  FrameInterpolationParams,
  SuperResolutionParams,
  AudioEffectGenerationParams,
  VideoPostProcessUnifiedParams,
  LogoInfo,
  QueryResultResponse,
  GenerationStatus,
  BatchQueryResponse
} from './types/api.types.js';

// Export NewJimengClient as JimengClient for backward compatibility
export { NewJimengClient as JimengClient };

// 创建单例实例以保持向后兼容
let globalApiClient: NewJimengClient | null = null;

const getApiClient = (token?: string): NewJimengClient => {
  if (!globalApiClient || (token && token !== globalApiClient.getRefreshToken())) {
    globalApiClient = new NewJimengClient(token);
  }
  return globalApiClient;
};

// ============== 主要API函数（保持100%兼容） ==============

/**
 * 图像生成 - 统一接口，支持同步和异步模式
 * ✨ 支持所有新特性：单图参考、多图参考、Draft-based响应、creation_agent模式、多帧场景描述
 */
export function generateImage(params: ImageGenerationParams & { async: true }): Promise<string>;
export function generateImage(params: ImageGenerationParams & { async?: false }): Promise<string[]>;
export function generateImage(params: ImageGenerationParams): Promise<string[] | string> {
  // console.log('🔍 [重构后API] generateImage 被调用');
  // console.log('🔍 [参数] 文件数量:', params?.filePath ? params.filePath.length : 0);
  // console.log('🔍 [参数] 模型:', params.model || 'jimeng-4.0 (默认)');

  if (!params.refresh_token) {
    throw new Error('refresh_token is required');
  }

  const client = getApiClient(params.refresh_token);

  return client.generateImage(params as any)
    .catch(error => {
      // ❌ MCP模式禁止console输出，会破坏stdio通信
      // console.error('❌ [重构后API] 图像生成失败:', error.message);
      throw error;
    });
}

/**
 * 视频生成 - 与原API完全兼容
 * ✨ 支持传统模式和智能多帧模式
 */
export const generateVideo = (params: VideoGenerationParams): Promise<string> => {
  // console.log('🔍 [重构后API] generateVideo 被调用');
  // console.log('🔍 [参数] 模式:', params.multiFrames ? '多帧模式' : '传统模式');

  if (!params.refresh_token) {
    throw new Error('refresh_token is required');
  }

  const client = getApiClient(params.refresh_token);

  return client.generateVideo(params)
    .catch(error => {
      // ❌ MCP模式禁止console输出，会破坏stdio通信
      // console.error('❌ [重构后API] 视频生成失败:', error.message);
      throw error;
    });
};

/**
 * 主体参考视频生成 - 组合多图主体到一个场景
 * ✨ 支持2-4张参考图，使用[图N]语法引用
 */
export const generateMainReferenceVideo = (params: MainReferenceVideoParams): Promise<string> => {
  // console.log('🔍 [重构后API] generateMainReferenceVideo 被调用');
  // console.log('🔍 [参数] 参考图数量:', params.referenceImages.length);

  if (!params.refresh_token) {
    throw new Error('refresh_token is required');
  }

  const client = getApiClient(params.refresh_token);

  return client.generateMainReferenceVideo(params)
    .catch(error => {
      // ❌ MCP模式禁止console输出，会破坏stdio通信
      // console.error('❌ [重构后API] 主体参考视频生成失败:', error.message);
      throw error;
    });
};

// ============== 后处理功能 ==============

export async function frameInterpolation(params: FrameInterpolationParams): Promise<string> {
  // console.log('🔍 [重构后API] frameInterpolation 被调用');

  const token = params.refresh_token || process.env.JIMENG_API_TOKEN;
  if (!token) {
    throw new Error('JIMENG_API_TOKEN 环境变量未设置');
  }

  const client = new NewJimengClient(token);
  return await client.frameInterpolation(params);
}

export async function superResolution(params: SuperResolutionParams): Promise<string> {
  // console.log('🔍 [重构后API] superResolution 被调用');

  const token = params.refresh_token || process.env.JIMENG_API_TOKEN;
  if (!token) {
    throw new Error('JIMENG_API_TOKEN 环境变量未设置');
  }

  const client = new NewJimengClient(token);
  return await client.superResolution(params);
}

export async function generateAudioEffect(params: AudioEffectGenerationParams): Promise<string> {
  // console.log('🔍 [重构后API] generateAudioEffect 被调用');

  const token = params.refresh_token || process.env.JIMENG_API_TOKEN;
  if (!token) {
    throw new Error('JIMENG_API_TOKEN 环境变量未设置');
  }

  const client = new NewJimengClient(token);
  return await client.generateAudioEffect(params);
}

export async function videoPostProcess(params: VideoPostProcessUnifiedParams): Promise<string> {
  // console.log('🔍 [重构后API] videoPostProcess 被调用');
  // console.log('🔍 [参数] 操作类型:', params.operation);

  const token = params.refresh_token || process.env.JIMENG_API_TOKEN;
  if (!token) {
    throw new Error('JIMENG_API_TOKEN 环境变量未设置');
  }

  const client = new NewJimengClient(token);
  return await client.videoPostProcess(params);
}

// ============== 异步查询功能 ==============

/**
 * 异步提交图像生成任务（立即返回historyId，不等待完成）
 *
 * @param params - 图像生成参数
 * @returns Promise<string> 返回historyId，用于后续查询生成状态
 * @throws Error 当refresh_token缺失或提交失败时抛出错误
 *
 * @example
 * ```typescript
 * const historyId = await generateImageAsync({
 *   prompt: '美丽的风景画',
 *   refresh_token: 'your_token_here'
 * });
 * console.log('任务ID:', historyId);
 * ```
 */
export const generateImageAsync = async (params: ImageGenerationParams): Promise<string> => {
  // console.log('🔍 [重构后API] generateImageAsync 被调用');

  if (!params.refresh_token) {
    throw new Error('refresh_token is required');
  }

  const client = getApiClient(params.refresh_token);
  return await client.generateImageAsync(params);
};

/**
 * 查询生成任务的当前状态和结果
 *
 * @param historyId - 生成任务的历史记录ID（从generateImageAsync获取）
 * @param refresh_token - API令牌（可选，默认使用JIMENG_API_TOKEN环境变量）
 * @returns Promise<QueryResultResponse> 返回当前状态、进度和结果
 * @throws Error 当historyId无效或查询失败时抛出错误
 *
 * @example
 * ```typescript
 * const result = await getImageResult('h1234567890abcdef');
 * if (result.status === 'completed') {
 *   console.log('图片URLs:', result.imageUrls);
 * } else if (result.status === 'failed') {
 *   console.log('错误:', result.error);
 * } else {
 *   console.log('进度:', result.progress, '%');
 * }
 * ```
 */
export const getImageResult = async (
  historyId: string,
  refresh_token?: string
): Promise<QueryResultResponse> => {
  // console.log('🔍 [重构后API] getImageResult 被调用');

  const token = refresh_token || process.env.JIMENG_API_TOKEN;
  if (!token) {
    throw new Error('JIMENG_API_TOKEN 环境变量未设置');
  }

  const client = getApiClient(token);
  return await client.getImageResult(historyId);
};

/**
 * 批量查询多个生成任务的状态和结果
 * 自动识别ID类型（图片/视频），智能分组查询
 *
 * @param ids - 任务ID数组（支持图片historyId和视频submitId混合）
 * @param refresh_token - API令牌（可选，默认使用JIMENG_API_TOKEN环境变量）
 * @returns Promise<Record<string, QueryResultResponse>> 返回ID到结果的映射
 *
 * @example
 * ```typescript
 * const results = await getBatchResults([
 *   '12345',  // 图片ID
 *   '1e06b3c9-bd41-46dd-8889-70f2c61f66bb'  // 视频ID (UUID)
 * ]);
 * console.log(results['12345'].imageUrls);
 * console.log(results['1e06b3c9-bd41-46dd-8889-70f2c61f66bb'].videoUrl);
 * ```
 */
export const getBatchResults = async (
  ids: string[],
  refresh_token?: string
): Promise<Record<string, QueryResultResponse>> => {
  // console.log('🔍 [重构后API] getBatchResults 被调用，查询', ids.length, '个任务');

  const token = refresh_token || process.env.JIMENG_API_TOKEN;
  if (!token) {
    throw new Error('JIMENG_API_TOKEN 环境变量未设置');
  }

  const client = getApiClient(token);
  return await client.getBatchResults(ids);
};

/**
 * 查询视频生成结果（单个）
 *
 * @param submitId - 视频生成任务的submitId（UUID格式）
 * @param refresh_token - API令牌（可选）
 * @returns Promise<QueryResultResponse> 返回视频状态和URL
 */
export const queryVideoResult = async (
  submitId: string,
  refresh_token?: string
): Promise<QueryResultResponse> => {
  // console.log('🔍 [重构后API] queryVideoResult 被调用');

  const token = refresh_token || process.env.JIMENG_API_TOKEN;
  if (!token) {
    throw new Error('JIMENG_API_TOKEN 环境变量未设置');
  }

  const client = getApiClient(token);
  return await client.queryVideoResult(submitId);
};

/**
 * 批量查询视频生成结果
 *
 * @param submitIds - 视频任务submitId数组
 * @param refresh_token - API令牌（可选）
 * @returns Promise<Record<string, any>> 返回submitId到结果的映射
 */
export const queryVideoResults = async (
  submitIds: string[],
  refresh_token?: string
): Promise<Record<string, any>> => {
  // console.log('🔍 [重构后API] queryVideoResults 被调用，查询', submitIds.length, '个视频');

  const token = refresh_token || process.env.JIMENG_API_TOKEN;
  if (!token) {
    throw new Error('JIMENG_API_TOKEN 环境变量未设置');
  }

  const client = getApiClient(token);
  return await client.queryVideoResults(submitIds);
};

// ============== 类型导出（保持兼容性） ==============
export type {
  ImageGenerationParams,
  VideoGenerationParams,
  MainReferenceVideoParams,
  FrameInterpolationParams,
  SuperResolutionParams,
  AudioEffectGenerationParams,
  VideoPostProcessUnifiedParams,
  LogoInfo,
  QueryResultResponse,
  GenerationStatus,
  BatchQueryResponse
};

// ============== 高级用户API ==============
/**
 * 导出getApiClient函数用于获取单例客户端实例
 */
export { getApiClient };

/**
 * 导出新的服务类供高级用户使用
 */
export { HttpClient } from './api/HttpClient.js';
export { ImageUploader } from './api/ImageUploader.js';
export { VideoService } from './api/VideoService.js';
export { NewCreditService, type CreditReceiveResult } from './api/NewCreditService.js';

// VideoGenerator removed - use VideoService instead from new implementation

// ============== 重构完成 ==============
// 移除了启动时的重构提示信息，避免在生产环境产生不必要的日志输出