/**
 * Unit tests for new CreditService implementation
 * Tests composition pattern instead of inheritance
 */

import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { NewCreditService, InsufficientCreditsError, CreditReceiveResult, CreditHistoryResult, SubscriptionInfo } from '../../src/api/NewCreditService.js';
import { HttpClient } from '../../src/api/HttpClient.js';

describe('NewCreditService (Composition Pattern)', () => {
  let creditService: NewCreditService;
  let httpClient: HttpClient;
  let mockRequest: jest.SpyInstance;

  beforeAll(() => {
    process.env.JIMENG_API_TOKEN = 'test-token-12345';
    httpClient = new HttpClient();
    creditService = new NewCreditService(httpClient);
  });

  beforeEach(() => {
    // Mock the request method
    mockRequest = jest.spyOn(httpClient, 'request');
  });

  afterEach(() => {
    mockRequest.mockRestore();
  });

  describe('Composition Pattern Architecture', () => {
    it('should use injected HttpClient', () => {
      expect(creditService['httpClient']).toBe(httpClient);
    });

    it('should not extend any base class (composition, not inheritance)', () => {
      const proto = Object.getPrototypeOf(creditService);
      expect(proto.constructor.name).toBe('NewCreditService');

      // Should only have NewCreditService in the prototype chain
      const protoChain: string[] = [];
      let current = creditService;
      while (Object.getPrototypeOf(current) !== null) {
        current = Object.getPrototypeOf(current);
        protoChain.push(current.constructor.name);
      }

      expect(protoChain).toEqual(['NewCreditService', 'Object']);
      expect(protoChain).not.toContain('JimengApiClient');
      expect(protoChain).not.toContain('BaseClient');
    });
  });

  describe('getBalance', () => {
    it('should return total credits on success', async () => {
      mockRequest.mockResolvedValue({
        credit: {
          gift_credit: 10,
          purchase_credit: 20,
          vip_credit: 30
        }
      });

      const balance = await creditService.getBalance();

      expect(balance).toBe(60);
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/commerce/v1/benefits/user_credit'
        })
      );
    });

    it('should return 0 on failure instead of throwing', async () => {
      mockRequest.mockRejectedValue(new Error('Network error'));

      const balance = await creditService.getBalance();

      expect(balance).toBe(0);
    });
  });

  describe('getCredit', () => {
    it('should return detailed credit info', async () => {
      mockRequest.mockResolvedValue({
        credit: {
          gift_credit: 15,
          purchase_credit: 25,
          vip_credit: 35
        }
      });

      const credit = await creditService.getCredit();

      expect(credit).toEqual({
        giftCredit: 15,
        purchaseCredit: 25,
        vipCredit: 35,
        totalCredit: 75
      });
    });

    it('should handle missing credit data', async () => {
      mockRequest.mockResolvedValue({});

      const credit = await creditService.getCredit();

      expect(credit).toEqual({
        giftCredit: 0,
        purchaseCredit: 0,
        vipCredit: 0,
        totalCredit: 0
      });
    });
  });

  describe('hasEnoughCredits', () => {
    beforeEach(() => {
      mockRequest.mockResolvedValue({
        credit: {
          gift_credit: 50,
          purchase_credit: 0,
          vip_credit: 0
        }
      });
    });

    it('should return true when credits are sufficient', async () => {
      const result = await creditService.hasEnoughCredits(30);
      expect(result).toBe(true);
    });

    it('should return false when credits are insufficient', async () => {
      const result = await creditService.hasEnoughCredits(100);
      expect(result).toBe(false);
    });
  });

  describe('receiveCredit', () => {
    it('should return credit receive result on success', async () => {
      mockRequest.mockResolvedValue({
        ret: '0',
        errmsg: 'success',
        data: {
          is_first_receive: false,
          receive_quota: 60,
          has_popup: true,
          cur_total_credits: 3584
        }
      });

      const result: CreditReceiveResult = await creditService.receiveCredit();

      expect(result.curTotalCredits).toBe(3584);
      expect(result.receiveQuota).toBe(60);
      expect(result.isFirstReceive).toBe(false);
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/commerce/v1/benefits/credit_receive',
          data: { time_zone: 'Asia/Shanghai' }
        })
      );
    });

    it('should return first receive info', async () => {
      mockRequest.mockResolvedValue({
        ret: '0',
        errmsg: 'success',
        data: {
          is_first_receive: true,
          receive_quota: 80,
          has_popup: true,
          cur_total_credits: 80
        }
      });

      const result = await creditService.receiveCredit();

      expect(result.curTotalCredits).toBe(80);
      expect(result.receiveQuota).toBe(80);
      expect(result.isFirstReceive).toBe(true);
    });

    it('should return defaults when system busy (ret=1014)', async () => {
      mockRequest.mockResolvedValue({
        ret: '1014',
        errmsg: 'system busy'
      });

      const result = await creditService.receiveCredit();

      expect(result.curTotalCredits).toBe(0);
      expect(result.receiveQuota).toBe(0);
      expect(result.isFirstReceive).toBe(false);
    });

    it('should return defaults on network error without throwing', async () => {
      mockRequest.mockRejectedValue(new Error('Network error'));

      const result = await creditService.receiveCredit();

      expect(result.curTotalCredits).toBe(0);
      expect(result.receiveQuota).toBe(0);
      expect(result.isFirstReceive).toBe(false);
    });

    it('should handle missing data field gracefully', async () => {
      mockRequest.mockResolvedValue({
        ret: '0',
        errmsg: 'success'
      });

      const result = await creditService.receiveCredit();

      expect(result.curTotalCredits).toBe(0);
      expect(result.receiveQuota).toBe(0);
      expect(result.isFirstReceive).toBe(false);
    });
  });

  describe('getCreditHistory', () => {
    it('should return credit history records', async () => {
      mockRequest.mockResolvedValue({
        data: {
          new_cursor: '1770997398:123',
          has_more: true,
          records: [
            {
              amount: 90,
              create_time: 1771101566,
              title: '视频生成',
              history_type: 2,
              submit_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
              status: 'Init',
            },
            {
              amount: 60,
              create_time: 1771097335,
              title: '每日免费积分',
              history_type: 1,
              submit_id: '11111111-2222-3333-4444-555555555555',
              status: 'Checked',
            }
          ]
        }
      });

      const result: CreditHistoryResult = await creditService.getCreditHistory();

      expect(result.records).toHaveLength(2);
      expect(result.records[0].amount).toBe(90);
      expect(result.records[0].title).toBe('视频生成');
      expect(result.records[0].historyType).toBe(2);
      expect(result.records[1].title).toBe('每日免费积分');
      expect(result.records[1].historyType).toBe(1);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('1770997398:123');
    });

    it('should return empty on error', async () => {
      mockRequest.mockRejectedValue(new Error('Network error'));

      const result = await creditService.getCreditHistory();

      expect(result.records).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('should pass cursor and count params', async () => {
      mockRequest.mockResolvedValue({ data: { records: [], has_more: false, new_cursor: '0' } });

      await creditService.getCreditHistory('cursor123', 10);

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { count: 10, cursor: 'cursor123' }
        })
      );
    });
  });

  describe('getSubscriptionInfo', () => {
    it('should return VIP subscription info', async () => {
      mockRequest.mockResolvedValue({
        data: {
          flag: true,
          cur_vip_level: 'artisan',
          start_time: 1770732775,
          end_time: 1802873574,
          is_cancel_subscribe: false,
          subscribe_type: 'auto',
          subscribe_cycle: 12,
        }
      });

      const result: SubscriptionInfo = await creditService.getSubscriptionInfo();

      expect(result.isVip).toBe(true);
      expect(result.vipLevel).toBe('artisan');
      expect(result.startTime).toBe(1770732775);
      expect(result.endTime).toBe(1802873574);
      expect(result.isAutoRenew).toBe(true);
      expect(result.subscribeType).toBe('auto');
      expect(result.subscribeCycle).toBe(12);
    });

    it('should return defaults for non-VIP user', async () => {
      mockRequest.mockResolvedValue({
        data: { flag: false }
      });

      const result = await creditService.getSubscriptionInfo();

      expect(result.isVip).toBe(false);
      expect(result.vipLevel).toBe('');
    });

    it('should return defaults on error', async () => {
      mockRequest.mockRejectedValue(new Error('Network error'));

      const result = await creditService.getSubscriptionInfo();

      expect(result.isVip).toBe(false);
      expect(result.vipLevel).toBe('');
    });
  });

  describe('deductCredits', () => {
    it('should throw InsufficientCreditsError when not enough credits', async () => {
      mockRequest.mockResolvedValue({
        credit: { gift_credit: 10, purchase_credit: 0, vip_credit: 0 }
      });

      await expect(creditService.deductCredits(50, 'Test deduction'))
        .rejects
        .toThrow(InsufficientCreditsError);

      await expect(creditService.deductCredits(50, 'Test'))
        .rejects
        .toThrow('需要50积分，当前10');
    });

    it('should succeed when enough credits available', async () => {
      mockRequest.mockResolvedValue({
        credit: { gift_credit: 100, purchase_credit: 0, vip_credit: 0 }
      });

      await expect(creditService.deductCredits(50, 'Test deduction'))
        .resolves
        .not.toThrow();
    });
  });
});
