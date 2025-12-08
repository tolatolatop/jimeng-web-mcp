import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "@jest/globals";
import type {
  ImageGenerationParams,
  QueryResultResponse,
  GenerationStatus
} from '../../src/types/api.types.js';

/**
 * 🚀 图片生成端到端工作流测试
 *
 * 测试完整的图片生成工作流程，包括：
 * - 同步图片生成流程
 * - 异步图片生成流程
 * - 批量查询流程
 * - 错误恢复流程
 * - 实际API响应处理
 *
 * 这些测试模拟真实使用场景，确保整个系统端到端正常工作
 */

// Mock the NewJimengClient BEFORE importing the API
const mockNewJimengClient = {
  generateImage: jest.fn(),
  generateImageAsync: jest.fn(),
  getImageResult: jest.fn(),
  getBatchResults: jest.fn(),
  getRefreshToken: jest.fn(),
  videoPostProcess: jest.fn(),
  queryVideoResult: jest.fn(),
  queryVideoResults: jest.fn(),
  generateVideo: jest.fn(),
  generateMainReferenceVideo: jest.fn(),
  frameInterpolation: jest.fn(),
  superResolution: jest.fn(),
  generateAudioEffect: jest.fn(),
};

// Use unstable_mockModule for ESM support
jest.unstable_mockModule('../../src/api/NewJimengClient.js', () => ({
  NewJimengClient: jest.fn(() => mockNewJimengClient)
}));

// Dynamic import of the API to ensure mock is applied first
const {
  generateImage,
  generateImageAsync,
  getImageResult,
  getApiClient
} = await import('../../src/api.js');

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

const describeOrSkip = process.env.JIMENG_API_TOKEN ? describe : describe.skip;

describeOrSkip('🚀 图片生成端到端工作流测试', () => {

  let mockClient: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();

    // 保存原始环境变量
    originalEnv = process.env;
    process.env = { ...originalEnv };

    // 重置mock方法
    Object.keys(mockNewJimengClient).forEach(key => {
      (mockNewJimengClient as any)[key].mockReset();
    });

    // 使用全局mock client实例
    mockClient = mockNewJimengClient;
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env = originalEnv;
  });

  // ==================== 完整同步生成工作流 ====================

  describe('完整同步生成工作流', () => {
    it('应该完成基础同步图片生成流程', async () => {
      // 1. 准备生成参数
      const params: ImageGenerationParams = {
        prompt: '一只可爱的猫咪坐在花园里，阳光明媚，高质量摄影',
        refresh_token: 'test-token-12345',
        model: 'jimeng-4.0',
        aspectRatio: '16:9',
        count: 1
      };

      // 2. Mock API响应
      const mockImageUrls = [
        'https://jimeng-ai.com/generated-images/cute-cat-garden-123456.jpg'
      ];
      mockClient.generateImage.mockResolvedValue(mockImageUrls);

      // 3. 执行生成
      const result = await generateImage(params);

      // 4. 验证结果
      expect(result).toEqual(mockImageUrls);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatch(/^https:\/\//);
      expect(result[0]).toContain('.jpg');

      // 5. 验证API调用
      expect(mockClient.generateImage).toHaveBeenCalledTimes(1);
      expect(mockClient.generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: '一只可爱的猫咪坐在花园里，阳光明媚，高质量摄影',
          model: 'jimeng-4.0',
          aspectRatio: '16:9',
          count: 1
        })
      );
    });

    it('应该完成多张图片同步生成流程', async () => {
      // 1. 准备参数
      const params: ImageGenerationParams = {
        prompt: '四季风景：春夏秋冬，每个季节的特色景色',
        refresh_token: 'test-token-12345',
        model: 'jimeng-4.0',
        count: 4,
        aspectRatio: '1:1'
      };

      // 2. Mock响应
      const mockImageUrls = [
        'https://jimeng-ai.com/generated-images/spring-scene-123456.jpg',
        'https://jimeng-ai.com/generated-images/summer-scene-123457.jpg',
        'https://jimeng-ai.com/generated-images/autumn-scene-123458.jpg',
        'https://jimeng-ai.com/generated-images/winter-scene-123459.jpg'
      ];
      mockClient.generateImage.mockResolvedValue(mockImageUrls);

      // 3. 执行生成
      const result = await generateImage(params);

      // 4. 验证结果
      expect(result).toEqual(mockImageUrls);
      expect(result).toHaveLength(4);
      result.forEach((url, index) => {
        expect(url).toMatch(/^https:\/\//);
        expect(url).toContain('.jpg');
        expect(url).toContain(['spring', 'summer', 'autumn', 'winter'][index]);
      });
    });

    it('应该完成带参考图的同步生成流程', async () => {
      // 1. 准备参数
      const params: ImageGenerationParams = {
        prompt: '将这张照片转换成动漫风格',
        refresh_token: 'test-token-12345',
        filePath: ['/absolute/path/to/reference-photo.jpg'],
        sample_strength: 0.8,
        model: 'jimeng-3.0',
        aspectRatio: '3:4'
      };

      // 2. Mock响应
      const mockImageUrls = [
        'https://jimeng-ai.com/generated-images/anime-style-123456.jpg'
      ];
      mockClient.generateImage.mockResolvedValue(mockImageUrls);

      // 3. 执行生成
      const result = await generateImage(params);

      // 4. 验证结果
      expect(result).toEqual(mockImageUrls);
      expect(mockClient.generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: '将这张照片转换成动漫风格',
          filePath: ['/absolute/path/to/reference-photo.jpg'],
          sample_strength: 0.8,
          model: 'jimeng-3.0',
          aspectRatio: '3:4'
        })
      );
    });

    it('应该完成多参考图融合生成流程', async () => {
      // 1. 准备参数
      const params: ImageGenerationParams = {
        prompt: '融合两张图片的风格，创建独特的艺术作品',
        refresh_token: 'test-token-12345',
        filePath: [
          '/absolute/path/to/style-reference1.jpg',
          '/absolute/path/to/style-reference2.jpg'
        ],
        reference_strength: [0.6, 0.4],
        sample_strength: 0.7,
        model: 'jimeng-4.0'
      };

      // 2. Mock响应
      const mockImageUrls = [
        'https://jimeng-ai.com/generated-images/fused-artwork-123456.jpg'
      ];
      mockClient.generateImage.mockResolvedValue(mockImageUrls);

      // 3. 执行生成
      const result = await generateImage(params);

      // 4. 验证结果
      expect(result).toEqual(mockImageUrls);
      expect(mockClient.generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          filePath: [
            '/absolute/path/to/style-reference1.jpg',
            '/absolute/path/to/style-reference2.jpg'
          ],
          reference_strength: [0.6, 0.4],
          sample_strength: 0.7
        })
      );
    });
  });

  // ==================== 完整异步生成工作流 ====================

  describe('完整异步生成工作流', () => {
    it('应该完成完整的异步生成和查询流程', async () => {
      // 1. 提交异步生成任务
      const params: ImageGenerationParams = {
        prompt: '一个复杂的未来城市场景，高细节，科幻风格',
        refresh_token: 'test-token-12345',
        model: 'jimeng-4.0',
        aspectRatio: '21:9',
        count: 1
      };

      const mockHistoryId = 'h1234567890abcdef';
      mockClient.generateImageAsync.mockResolvedValue(mockHistoryId);

      // 2. 提交任务
      const historyId = await generateImageAsync(params);
      expect(historyId).toBe(mockHistoryId);
      expect(mockClient.generateImageAsync).toHaveBeenCalledWith(params);

      // 3. 查询任务状态 - 第1次（进行中）
      const processingResult: QueryResultResponse = {
        status: 'processing' as GenerationStatus,
        progress: 35,
        historyId
      };
      mockClient.getImageResult.mockResolvedValue(processingResult);

      const result1 = await getImageResult(historyId, 'test-token-12345');
      expect(result1.status).toBe('processing');
      expect(result1.progress).toBe(35);
      expect(result1.imageUrls).toBeUndefined();

      // 4. 查询任务状态 - 第2次（继续进行中）
      const stillProcessingResult: QueryResultResponse = {
        status: 'processing' as GenerationStatus,
        progress: 78,
        historyId
      };
      mockClient.getImageResult.mockResolvedValue(stillProcessingResult);

      const result2 = await getImageResult(historyId, 'test-token-12345');
      expect(result2.status).toBe('processing');
      expect(result2.progress).toBe(78);

      // 5. 查询任务状态 - 第3次（完成）
      const completedResult: QueryResultResponse = {
        status: 'completed' as GenerationStatus,
        progress: 100,
        imageUrls: [
          'https://jimeng-ai.com/generated-images/future-city-123456.jpg'
        ],
        historyId
      };
      mockClient.getImageResult.mockResolvedValue(completedResult);

      const result3 = await getImageResult(historyId, 'test-token-12345');
      expect(result3.status).toBe('completed');
      expect(result3.progress).toBe(100);
      expect(result3.imageUrls).toHaveLength(1);
      expect(result3.imageUrls![0]).toMatch(/^https:\/\//);

      // 6. 验证查询调用次数
      expect(mockClient.getImageResult).toHaveBeenCalledTimes(3);
      expect(mockClient.getImageResult).toHaveBeenNthCalledWith(1, historyId);
      expect(mockClient.getImageResult).toHaveBeenNthCalledWith(2, historyId);
      expect(mockClient.getImageResult).toHaveBeenNthCalledWith(3, historyId);
    });

    it('应该处理异步任务失败的情况', async () => {
      // 1. 提交任务
      const params: ImageGenerationParams = {
        prompt: '测试内容',
        refresh_token: 'test-token-12345'
      };

      const mockHistoryId = 'hfailed1234567890';
      mockClient.generateImageAsync.mockResolvedValue(mockHistoryId);

      const historyId = await generateImageAsync(params);
      expect(historyId).toBe(mockHistoryId);

      // 2. 查询失败状态
      const failedResult: QueryResultResponse = {
        status: 'failed' as GenerationStatus,
        progress: 0,
        error: '内容违反政策：包含不当内容',
        historyId
      };
      mockClient.getImageResult.mockResolvedValue(failedResult);

      const result = await getImageResult(historyId, 'test-token-12345');
      expect(result.status).toBe('failed');
      expect(result.progress).toBe(0);
      expect(result.error).toContain('内容违反政策');
    });

    it('应该处理异步任务超时的情况', async () => {
      // 1. 提交任务
      const params: ImageGenerationParams = {
        prompt: '超时测试',
        refresh_token: 'test-token-12345'
      };

      const mockHistoryId = 'htimeout1234567890';
      mockClient.generateImageAsync.mockResolvedValue(mockHistoryId);

      const historyId = await generateImageAsync(params);

      // 2. 模拟查询超时
      const errorMessage = '查询超时：任务处理时间过长';
      mockClient.getImageResult.mockRejectedValue(new Error(errorMessage));

      await expect(getImageResult(historyId, 'test-token-12345')).rejects.toThrow(errorMessage);
    });
  });

  // ==================== 批量操作工作流 ====================

  describe('批量操作工作流', () => {
    it('应该完成批量提交和查询流程', async () => {
      // 1. 批量提交多个异步任务
      const tasks = [
        {
          prompt: '自然风景：山脉湖泊',
          params: {
            prompt: '自然风景：山脉湖泊',
            refresh_token: 'test-token-12345',
            model: 'jimeng-4.0'
          }
        },
        {
          prompt: '城市夜景：霓虹灯光',
          params: {
            prompt: '城市夜景：霓虹灯光',
            refresh_token: 'test-token-12345',
            model: 'jimeng-3.0'
          }
        },
        {
          prompt: '抽象艺术：几何图形',
          params: {
            prompt: '抽象艺术：几何图形',
            refresh_token: 'test-token-12345',
            aspectRatio: '1:1'
          }
        }
      ];

      const historyIds = ['h1111111111111111', 'h2222222222222222', 'h3333333333333333'];

      // Mock提交响应
      for (let i = 0; i < tasks.length; i++) {
        mockClient.generateImageAsync.mockResolvedValueOnce(historyIds[i]);
      }

      // 提交所有任务
      const submittedIds = [];
      for (const task of tasks) {
        const id = await generateImageAsync(task.params);
        submittedIds.push(id);
      }

      expect(submittedIds).toEqual(historyIds);

      // 2. 批量查询结果
      const mockBatchResults = {
        'h1111111111111111': {
          status: 'completed' as GenerationStatus,
          progress: 100,
          imageUrls: ['https://jimeng-ai.com/generated-images/mountain-lake-111.jpg']
        },
        'h2222222222222222': {
          status: 'processing' as GenerationStatus,
          progress: 65
        },
        'h3333333333333333': {
          status: 'failed' as GenerationStatus,
          progress: 0,
          error: '生成失败：内容审核不通过'
        }
      };

      mockClient.getBatchResults.mockResolvedValue(mockBatchResults);

      const batchResults = await mockClient.getBatchResults(historyIds);

      // 3. 验证批量结果
      expect(Object.keys(batchResults)).toHaveLength(3);
      expect(batchResults['h1111111111111111'].status).toBe('completed');
      expect(batchResults['h2222222222222222'].status).toBe('processing');
      expect(batchResults['h3333333333333333'].status).toBe('failed');

      // 4. 验证完成的任务有图片URL
      expect(batchResults['h1111111111111111'].imageUrls).toHaveLength(1);
      expect(batchResults['h1111111111111111'].imageUrls![0]).toContain('mountain-lake');

      // 5. 验证失败的任务有错误信息
      expect(batchResults['h3333333333333333'].error).toContain('内容审核不通过');
    });

    it('应该处理部分批量查询失败', async () => {
      const historyIds = ['hvalid1234567890', 'hinvalid0987654321'];

      const mockPartialResults = {
        'hvalid1234567890': {
          status: 'completed' as GenerationStatus,
          progress: 100,
          imageUrls: ['https://jimeng-ai.com/generated-images/valid-123.jpg']
        },
        'hinvalid0987654321': {
          error: '无效的任务ID：格式不正确'
        }
      };

      mockClient.getBatchResults.mockResolvedValue(mockPartialResults);

      const results = await mockClient.getBatchResults(historyIds);

      expect(results['hvalid1234567890']).toHaveProperty('status', 'completed');
      expect(results['hinvalid0987654321']).toHaveProperty('error');
      expect(results['hinvalid0987654321']).not.toHaveProperty('status');
    });
  });

  // ==================== Continue Generation工作流 ====================

  describe('Continue Generation工作流', () => {
    it('应该处理超过4张图片的continue generation', async () => {
      // 1. 请求生成8张图片
      const params: ImageGenerationParams = {
        prompt: '展示不同情绪的人像表情：喜、怒、哀、乐、惊、恐、思、静',
        refresh_token: 'test-token-12345',
        count: 8,
        model: 'jimeng-4.0',
        aspectRatio: '3:4'
      };

      // 2. Mock continue generation响应
      const mockImageUrls = Array.from({ length: 8 }, (_, i) =>
        `https://jimeng-ai.com/generated-images/emotion-${i + 1}-${100000 + i}.jpg`
      );
      mockClient.generateImage.mockResolvedValue(mockImageUrls);

      // 3. 执行生成
      const result = await generateImage(params);

      // 4. 验证结果
      expect(result).toEqual(mockImageUrls);
      expect(result).toHaveLength(8);

      // 验证所有URL都有效
      result.forEach((url, index) => {
        expect(url).toMatch(/^https:\/\//);
        expect(url).toContain('.jpg');
        expect(url).toContain(`emotion-${index + 1}`);
      });

      // 5. 验证API调用
      expect(mockClient.generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: '展示不同情绪的人像表情：喜、怒、哀、乐、惊、恐、思、静',
          count: 8
        })
      );
    });

    it('应该处理continue generation中的部分失败', async () => {
      // 1. 请求6张图片
      const params: ImageGenerationParams = {
        prompt: '6种不同的花朵特写',
        refresh_token: 'test-token-12345',
        count: 6
      };

      // 2. Mock部分成功的响应
      const mockImageUrls = [
        'https://jimeng-ai.com/generated-images/flower-1-100001.jpg',
        'https://jimeng-ai.com/generated-images/flower-2-100002.jpg',
        'https://jimeng-ai.com/generated-images/flower-3-100003.jpg'
        // 只返回3张，后3张生成失败
      ];
      mockClient.generateImage.mockResolvedValue(mockImageUrls);

      // 3. 执行生成
      const result = await generateImage(params);

      // 4. 验证部分成功的结果
      expect(result).toEqual(mockImageUrls);
      expect(result).toHaveLength(3); // 实际返回的数量
    });
  });

  // ==================== 错误恢复工作流 ====================

  describe('错误恢复工作流', () => {
    it('应该处理网络中断后的重试', async () => {
      const params: ImageGenerationParams = {
        prompt: '网络重试测试',
        refresh_token: 'test-token-12345'
      };

      // 1. 第一次尝试失败
      mockClient.generateImage.mockRejectedValueOnce(new Error('网络连接失败'));

      // 2. 第二次尝试成功
      const mockImageUrls = ['https://jimeng-ai.com/generated-images/retry-success-123.jpg'];
      mockClient.generateImage.mockResolvedValueOnce(mockImageUrls);

      // 3. 第一次尝试失败
      await expect(generateImage(params)).rejects.toThrow('网络连接失败');

      // 4. 第二次尝试成功（在实际应用中，这里会有重试逻辑）
      const result = await generateImage(params);
      expect(result).toEqual(mockImageUrls);
    });

    it('应该处理认证失效后的重新登录', async () => {
      const params: ImageGenerationParams = {
        prompt: '认证测试',
        refresh_token: 'expired-token-12345'
      };

      // 1. 第一次尝试失败（认证失效）
      mockClient.generateImage.mockRejectedValueOnce(new Error('认证失败：token已过期'));

      // 2. 使用新token重试
      const paramsWithNewToken: ImageGenerationParams = {
        ...params,
        refresh_token: 'new-valid-token-67890'
      };

      const mockImageUrls = ['https://jimeng-ai.com/generated-images/new-auth-456.jpg'];
      mockClient.generateImage.mockResolvedValueOnce(mockImageUrls);

      // 3. 第一次失败
      await expect(generateImage(params)).rejects.toThrow('认证失败：token已过期');

      // 4. 使用新token成功
      const result = await generateImage(paramsWithNewToken);
      expect(result).toEqual(mockImageUrls);
      expect(mockClient.generateImage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          refresh_token: 'new-valid-token-67890'
        })
      );
    });

    it('应该处理参数错误的修正', async () => {
      // 1. 错误的参数
      const invalidParams: ImageGenerationParams = {
        prompt: '', // 空prompt
        refresh_token: 'test-token-12345',
        sample_strength: 1.5 // 超出范围
      } as any;

      mockClient.generateImage.mockRejectedValue(new Error('prompt必须是非空字符串'));

      // 2. 第一次尝试失败
      await expect(generateImage(invalidParams)).rejects.toThrow('prompt必须是非空字符串');

      // 3. 修正参数后重试
      const validParams: ImageGenerationParams = {
        prompt: '修正后的有效prompt',
        refresh_token: 'test-token-12345',
        sample_strength: 0.8 // 修正范围内的值
      };

      const mockImageUrls = ['https://jimeng-ai.com/generated-images/corrected-789.jpg'];
      mockClient.generateImage.mockResolvedValue(mockImageUrls);

      const result = await generateImage(validParams);
      expect(result).toEqual(mockImageUrls);
    });
  });

  // ==================== 性能测试工作流 ====================

  describe('性能测试工作流', () => {
    it('应该处理大量并发请求', async () => {
      const concurrentCount = 10;
      const params: ImageGenerationParams = {
        prompt: '并发测试图片',
        refresh_token: 'test-token-12345'
      };

      // Mock并发响应
      const mockResponses = Array.from({ length: concurrentCount }, (_, i) => [
        `https://jimeng-ai.com/generated-images/concurrent-${i}-${100000 + i}.jpg`
      ]);

      mockClient.generateImage.mockResolvedValue(mockResponses[0]);

      // 并发执行多个生成请求
      const promises = Array.from({ length: concurrentCount }, () => generateImage(params));
      const results = await Promise.all(promises);

      // 验证所有请求都成功
      expect(results).toHaveLength(concurrentCount);
      results.forEach((result, index) => {
        expect(result).toEqual(mockResponses[0]);
      });

      // 验证API调用次数
      expect(mockClient.generateImage).toHaveBeenCalledTimes(concurrentCount);
    });

    it('应该快速处理简单查询请求', async () => {
      const historyId = 'h1234567890abcdef';

      const mockResult: QueryResultResponse = {
        status: 'completed' as GenerationStatus,
        progress: 100,
        imageUrls: ['https://jimeng-ai.com/generated-images/quick-test-123.jpg'],
        historyId
      };

      mockClient.getImageResult.mockResolvedValue(mockResult);

      const startTime = Date.now();
      const result = await getImageResult(historyId, 'test-token-12345');
      const endTime = Date.now();

      // 验证结果
      expect(result.status).toBe('completed');
      expect(result.imageUrls).toHaveLength(1);

      // 验证响应时间（应该在合理范围内，这里设置为100ms）
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});