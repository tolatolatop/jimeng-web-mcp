/**
 * CreditService - 积分管理服务
 * 使用组合模式，依赖HttpClient而非继承
 * 负责积分查询和领取功能
 */

import { HttpClient } from './HttpClient.js';
import { logger } from '../utils/logger.js';

export interface CreditInfo {
  giftCredit: number;
  purchaseCredit: number;
  vipCredit: number;
  totalCredit: number;
}

export interface CreditReceiveResult {
  /** 当前总积分余额 */
  curTotalCredits: number;
  /** 本次领取的积分数量 */
  receiveQuota: number;
  /** 是否首次领取 */
  isFirstReceive: boolean;
}

/**
 * CreditService类（新版本 - 组合模式）
 */
export class NewCreditService {
  constructor(private httpClient: HttpClient) {}

  /**
   * 获取积分余额
   */
  async getBalance(): Promise<number> {
    try {
      const credit = await this.getCredit();
      return credit.totalCredit;
    } catch (error) {
      logger.debug(`查询积分失败: ${error}`);
      return 0; // 失败时返回0而非抛出异常
    }
  }

  /**
   * 获取详细积分信息
   */
  async getCredit(): Promise<CreditInfo> {
    // 积分API根据DevTools抓取：无URL参数，仅通过请求头认证
    const result = await this.httpClient.request({
      method: 'POST',
      url: '/commerce/v1/benefits/user_credit',
      data: {},
      headers: { 'Referer': 'https://jimeng.jianying.com/ai-tool/image/generate' }
    });

    const credit = result.credit || {};
    const giftCredit = credit.gift_credit || 0;
    const purchaseCredit = credit.purchase_credit || 0;
    const vipCredit = credit.vip_credit || 0;

    return {
      giftCredit,
      purchaseCredit,
      vipCredit,
      totalCredit: giftCredit + purchaseCredit + vipCredit
    };
  }

  /**
   * 领取积分并返回当前积分信息
   * 此接口同时具备领取每日积分和查询当前总积分的功能
   */
  async receiveCredit(): Promise<CreditReceiveResult> {
    try {
      const response = await this.httpClient.request({
        method: 'POST',
        url: '/commerce/v1/benefits/credit_receive',
        data: { 'time_zone': 'Asia/Shanghai' },
        headers: { 'Referer': 'https://jimeng.jianying.com/ai-tool/image/generate' }
      });

      // 检查返回状态
      if (response?.ret && response.ret !== '0') {
        if (response.ret === '1014' && response.errmsg === 'system busy') {
          logger.debug('积分系统繁忙，跳过积分领取');
          return { curTotalCredits: 0, receiveQuota: 0, isFirstReceive: false };
        } else {
          logger.debug(`积分领取异常: ret=${response.ret}, errmsg=${response.errmsg || '未知错误'}`);
          return { curTotalCredits: 0, receiveQuota: 0, isFirstReceive: false };
        }
      }

      // 解析返回数据
      const data = response?.data || {};
      const result: CreditReceiveResult = {
        curTotalCredits: data.cur_total_credits || 0,
        receiveQuota: data.receive_quota || 0,
        isFirstReceive: data.is_first_receive || false,
      };

      logger.debug(`积分领取成功: 当前总积分=${result.curTotalCredits}, 本次领取=${result.receiveQuota}`);
      return result;
    } catch (error) {
      logger.debug(`积分领取请求失败: ${(error as Error).message}`);
      // 不抛错，返回默认值
      return { curTotalCredits: 0, receiveQuota: 0, isFirstReceive: false };
    }
  }

  /**
   * 检查是否有足够积分
   */
  async hasEnoughCredits(amount: number): Promise<boolean> {
    const balance = await this.getBalance();
    return balance >= amount;
  }

  /**
   * 扣除积分（记录原因）
   */
  async deductCredits(amount: number, reason: string): Promise<void> {
    const hasEnough = await this.hasEnoughCredits(amount);
    if (!hasEnough) {
      const balance = await this.getBalance();
      throw new InsufficientCreditsError(amount, balance);
    }

    // console.log(`扣除积分: ${amount}, 原因: ${reason}`);
    // 注：实际扣除由JiMeng API自动处理
  }
}

/**
 * 积分不足错误
 */
export class InsufficientCreditsError extends Error {
  constructor(required: number, available: number) {
    super(`需要${required}积分，当前${available}`);
    this.name = 'InsufficientCreditsError';
  }
}
