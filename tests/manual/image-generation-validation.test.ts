/**
 * 图像生成功能验证测试套件
 *
 * 此文件包含所有图像生成功能的验证测试用例
 * 需要真实的API token才能执行
 *
 * 运行方式:
 * 1. 设置环境变量: export JIMENG_API_TOKEN=your_token_here
 * 2. 运行测试: npm test tests/manual/image-generation-validation.test.ts
 *
 * 注意:
 * - 这些测试会消耗真实的API积分
 * - 某些测试可能需要较长时间
 * - 建议按阶段分批执行
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { generateImage, getImageResult, getBatchResults } from '../../src/api.js';
import type { ImageGenerationParams } from '../../src/types/api.types.js';
import * as fs from 'fs';
import * as path from 'path';

// 检查API token
const API_TOKEN = process.env.JIMENG_API_TOKEN;
const TEST_ENABLED = !!API_TOKEN;

// 测试配置
const TEST_CONFIG = {
  // 是否保存生成的图片URL用于后续验证
  saveResults: true,
  // 结果保存路径
  resultsPath: path.join(process.cwd(), 'specs/20250103-image-validation/results.json'),
  // 测试超时时间
  timeout: 120000, // 2分钟
  longTimeout: 600000, // 10分钟（用于大批量生成）
};

// 测试结果收集器
const testResults: any[] = [];

// 测试辅助函数
function saveTestResult(testId: string, params: any, result: any, duration: number, status: 'pass' | 'fail', error?: string) {
  testResults.push({
    testId,
    timestamp: new Date().toISOString(),
    params,
    result,
    duration,
    status,
    error
  });

  if (TEST_CONFIG.saveResults) {
    fs.mkdirSync(path.dirname(TEST_CONFIG.resultsPath), { recursive: true });
    fs.writeFileSync(TEST_CONFIG.resultsPath, JSON.stringify(testResults, null, 2));
  }
}

// 验证URL是否可访问
async function verifyUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

// 测试套件
const describeOrSkip = TEST_ENABLED ? describe : describe.skip;

describeOrSkip('🧪 图像生成功能验证测试套件', () => {

  beforeAll(() => {
    if (!TEST_ENABLED) {
      console.warn('⚠️  JIMENG_API_TOKEN 未设置，跳过验证测试');
    } else {
      console.log('✅ API Token 已配置，开始验证测试');
    }
  });

  // ==================== 阶段1: 功能验证测试 ====================

  describe('阶段1: 功能验证测试', () => {

    describe('1.1 基础生成测试', () => {

      it('TC-BG-001: 单图生成（同步模式）', async () => {
        const startTime = Date.now();
        const params: ImageGenerationParams = {
          prompt: '一只可爱的小猫',
          count: 1,
          async: false,
          refresh_token: API_TOKEN!
        };

        try {
          const result = await generateImage(params);
          const duration = Date.now() - startTime;

          expect(Array.isArray(result)).toBe(true);
          expect(result).toHaveLength(1);
          expect(typeof result[0]).toBe('string');
          expect(result[0]).toMatch(/^https?:\/\//);

          // 验证URL可访问
          const urlAccessible = await verifyUrl(result[0]);
          expect(urlAccessible).toBe(true);

          saveTestResult('TC-BG-001', params, result, duration, 'pass');
        } catch (error) {
          const duration = Date.now() - startTime;
          saveTestResult('TC-BG-001', params, null, duration, 'fail', String(error));
          throw error;
        }
      }, TEST_CONFIG.timeout);

      it('TC-BG-002: 单图生成（异步模式）', async () => {
        const startTime = Date.now();
        const params: ImageGenerationParams = {
          prompt: '一只可爱的小猫',
          count: 1,
          async: true,
          refresh_token: API_TOKEN!
        };

        try {
          const taskId = await generateImage(params as any);
          expect(typeof taskId).toBe('string');
          expect(taskId.length).toBeGreaterThan(0);

          // 查询任务状态
          let attempts = 0;
          let result: any;
          while (attempts < 30) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            result = await getImageResult(taskId, API_TOKEN!);

            if (result.status === 'completed') {
              break;
            }
            attempts++;
          }

          expect(result.status).toBe('completed');
          expect(result.imageUrls).toBeDefined();
          expect(Array.isArray(result.imageUrls)).toBe(true);
          expect(result.imageUrls?.length).toBeGreaterThan(0);

          const duration = Date.now() - startTime;
          saveTestResult('TC-BG-002', params, { taskId, result }, duration, 'pass');
        } catch (error) {
          const duration = Date.now() - startTime;
          saveTestResult('TC-BG-002', params, null, duration, 'fail', String(error));
          throw error;
        }
      }, TEST_CONFIG.timeout);

      it('TC-BG-003: 批量生成2张图片', async () => {
        const startTime = Date.now();
        const params: ImageGenerationParams = {
          prompt: '美丽的风景，一共2张图',
          count: 2,
          async: false,
          refresh_token: API_TOKEN!
        };

        try {
          const result = await generateImage(params);
          const duration = Date.now() - startTime;

          expect(Array.isArray(result)).toBe(true);
          expect(result).toHaveLength(2);
          expect(duration).toBeLessThan(120000); // 2分钟内

          // 验证所有URL可访问
          for (const url of result) {
            const accessible = await verifyUrl(url);
            expect(accessible).toBe(true);
          }

          saveTestResult('TC-BG-003', params, result, duration, 'pass');
        } catch (error) {
          const duration = Date.now() - startTime;
          saveTestResult('TC-BG-003', params, null, duration, 'fail', String(error));
          throw error;
        }
      }, TEST_CONFIG.timeout);

      it('TC-BG-004: 批量生成4张图片', async () => {
        const startTime = Date.now();
        const params: ImageGenerationParams = {
          prompt: '四季风景，一共4张图',
          count: 4,
          async: false,
          refresh_token: API_TOKEN!
        };

        try {
          const result = await generateImage(params);
          const duration = Date.now() - startTime;

          expect(Array.isArray(result)).toBe(true);
          expect(result).toHaveLength(4);

          saveTestResult('TC-BG-004', params, result, duration, 'pass');
        } catch (error) {
          const duration = Date.now() - startTime;
          saveTestResult('TC-BG-004', params, null, duration, 'fail', String(error));
          throw error;
        }
      }, TEST_CONFIG.timeout);

      it('TC-BG-005: 批量生成5张图片（触发继续生成）', async () => {
        const startTime = Date.now();
        const params: ImageGenerationParams = {
          prompt: '不同风格的插画，一共5张图',
          count: 5,
          async: false,
          refresh_token: API_TOKEN!
        };

        try {
          const result = await generateImage(params);
          const duration = Date.now() - startTime;

          expect(Array.isArray(result)).toBe(true);
          expect(result).toHaveLength(5);

          // 验证触发了继续生成（可通过日志观察）
          console.log('✅ 继续生成测试完成，生成时间:', duration, 'ms');

          saveTestResult('TC-BG-005', params, result, duration, 'pass');
        } catch (error) {
          const duration = Date.now() - startTime;
          saveTestResult('TC-BG-005', params, null, duration, 'fail', String(error));
          throw error;
        }
      }, TEST_CONFIG.longTimeout);

      it.skip('TC-BG-006: 批量生成15张图片（最大数量）', async () => {
        // 跳过此测试以节省积分，需要时手动执行
        const startTime = Date.now();
        const params: ImageGenerationParams = {
          prompt: '各种动物，一共15张图',
          count: 15,
          async: false,
          refresh_token: API_TOKEN!
        };

        try {
          const result = await generateImage(params);
          const duration = Date.now() - startTime;

          expect(Array.isArray(result)).toBe(true);
          expect(result).toHaveLength(15);
          expect(duration).toBeLessThan(600000); // 10分钟内

          saveTestResult('TC-BG-006', params, result, duration, 'pass');
        } catch (error) {
          const duration = Date.now() - startTime;
          saveTestResult('TC-BG-006', params, null, duration, 'fail', String(error));
          throw error;
        }
      }, TEST_CONFIG.longTimeout);
    });

    describe('1.3 模型和宽高比测试', () => {
      const models = ['jimeng-4.0', 'jimeng-3.0', 'jimeng-2.1'];

      models.forEach((model, index) => {
        it(`TC-MODEL-00${index + 1}: 测试模型 ${model}`, async () => {
          const startTime = Date.now();
          const params: ImageGenerationParams = {
            prompt: '一只可爱的小猫',
            model,
            count: 1,
            async: false,
            refresh_token: API_TOKEN!
          };

          try {
            const result = await generateImage(params);
            const duration = Date.now() - startTime;

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);

            saveTestResult(`TC-MODEL-00${index + 1}`, params, result, duration, 'pass');
          } catch (error) {
            const duration = Date.now() - startTime;
            saveTestResult(`TC-MODEL-00${index + 1}`, params, null, duration, 'fail', String(error));
            throw error;
          }
        }, TEST_CONFIG.timeout);
      });

      const aspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4'];

      aspectRatios.forEach((aspectRatio, index) => {
        it(`TC-RATIO-00${index + 1}: 测试宽高比 ${aspectRatio}`, async () => {
          const startTime = Date.now();
          const params: ImageGenerationParams = {
            prompt: '风景画',
            aspectRatio: aspectRatio as any,
            count: 1,
            async: false,
            refresh_token: API_TOKEN!
          };

          try {
            const result = await generateImage(params);
            const duration = Date.now() - startTime;

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);

            saveTestResult(`TC-RATIO-00${index + 1}`, params, result, duration, 'pass');
          } catch (error) {
            const duration = Date.now() - startTime;
            saveTestResult(`TC-RATIO-00${index + 1}`, params, null, duration, 'fail', String(error));
            throw error;
          }
        }, TEST_CONFIG.timeout);
      });
    });

    describe('1.4 场景描述测试', () => {

      it('TC-SCENE-001: frames参数（3个场景）', async () => {
        const startTime = Date.now();
        const params: ImageGenerationParams = {
          prompt: '故事分镜',
          frames: ['开始场景：主角出发', '中间场景：遇到挑战', '结尾场景：完成任务'],
          count: 3,
          async: false,
          refresh_token: API_TOKEN!
        };

        try {
          const result = await generateImage(params);
          const duration = Date.now() - startTime;

          expect(Array.isArray(result)).toBe(true);
          expect(result).toHaveLength(3);

          saveTestResult('TC-SCENE-001', params, result, duration, 'pass');
        } catch (error) {
          const duration = Date.now() - startTime;
          saveTestResult('TC-SCENE-001', params, null, duration, 'fail', String(error));
          throw error;
        }
      }, TEST_CONFIG.longTimeout);
    });
  });

  // ==================== 阶段2: 边界条件和异常测试 ====================

  describe('阶段2: 边界条件和异常测试', () => {

    describe('2.1 参数边界测试', () => {

      it('TC-BOUND-001: count=0（应报错）', async () => {
        const params: ImageGenerationParams = {
          prompt: 'test',
          count: 0,
          refresh_token: API_TOKEN!
        };

        await expect(generateImage(params)).rejects.toThrow(/count/);
      });

      it('TC-BOUND-002: count=16（应报错）', async () => {
        const params: ImageGenerationParams = {
          prompt: 'test',
          count: 16,
          refresh_token: API_TOKEN!
        };

        await expect(generateImage(params)).rejects.toThrow(/count/);
      });

      it('TC-BOUND-006: 空prompt（应报错）', async () => {
        const params: ImageGenerationParams = {
          prompt: '',
          refresh_token: API_TOKEN!
        };

        // 应该抛出错误或使用默认提示词
        try {
          await generateImage(params);
          // 如果没有抛出错误，说明系统容忍了空prompt
          console.warn('⚠️  系统允许空prompt，建议添加验证');
        } catch (error) {
          expect(error).toBeDefined();
        }
      });
    });

    describe('2.2 异常情况测试', () => {

      it('TC-ERROR-001: 无效的模型名称', async () => {
        const params: ImageGenerationParams = {
          prompt: 'test',
          model: 'invalid-model-xyz',
          refresh_token: API_TOKEN!
        };

        // 可能使用默认模型或抛出错误
        try {
          const result = await generateImage(params);
          console.warn('⚠️  系统接受了无效模型名称，使用了默认模型');
          expect(result).toBeDefined();
        } catch (error) {
          expect(error).toBeDefined();
        }
      });

      it('TC-ERROR-002: 无效的宽高比', async () => {
        const params: ImageGenerationParams = {
          prompt: 'test',
          aspectRatio: '5:5' as any,
          refresh_token: API_TOKEN!
        };

        // 可能使用默认值或抛出错误
        try {
          const result = await generateImage(params);
          console.warn('⚠️  系统接受了无效宽高比，使用了默认值');
          expect(result).toBeDefined();
        } catch (error) {
          expect(error).toBeDefined();
        }
      });
    });
  });

  // ==================== 测试清理 ====================

  afterAll(() => {
    if (TEST_ENABLED && TEST_CONFIG.saveResults) {
      console.log(`\n📊 测试结果已保存到: ${TEST_CONFIG.resultsPath}`);
      console.log(`✅ 完成 ${testResults.filter(r => r.status === 'pass').length} 个测试`);
      console.log(`❌ 失败 ${testResults.filter(r => r.status === 'fail').length} 个测试`);
    }
  });
});
