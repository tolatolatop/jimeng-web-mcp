/**
 * Unit tests for new HttpClient implementation
 */

import { HttpClient } from '../../src/api/HttpClient.js';

describe('HttpClient (New Implementation)', () => {
  let httpClient: HttpClient;

  beforeAll(() => {
    // Use test token or mock
    process.env.JIMENG_API_TOKEN = 'test-token-12345';
    httpClient = new HttpClient();
  });

  describe('Constructor', () => {
    it('should initialize with token from environment', () => {
      expect(httpClient).toBeDefined();
      expect(httpClient.getRefreshToken()).toBe('test-token-12345');
    });

    it('should throw error if no token provided', () => {
      delete process.env.JIMENG_API_TOKEN;
      expect(() => new HttpClient()).toThrow('JIMENG_API_TOKEN 环境变量未设置');
      process.env.JIMENG_API_TOKEN = 'test-token-12345'; // Restore
    });

    it('should accept token parameter', () => {
      const client = new HttpClient('custom-token');
      expect(client.getRefreshToken()).toBe('custom-token');
    });
  });

  describe('Request Parameter Generation', () => {
    it('should generate request params with required fields', () => {
      const params = httpClient.generateRequestParams();

      expect(params).toHaveProperty('aid', 513695);
      expect(params).toHaveProperty('device_platform', 'web');
      expect(params).toHaveProperty('webId');
      expect(params).toHaveProperty('babi_param');
    });

    it('should use lowercase region', () => {
      const params = httpClient.generateRequestParams();
      expect(params.region).toBe('cn');
    });

    it('should include web_version and da_version', () => {
      const params = httpClient.generateRequestParams();
      expect(params.web_version).toBe('7.5.0');
      expect(params.da_version).toBe('3.3.9');
      expect(params.aigc_features).toBe('app_lip_sync');
    });

    it('should generate babi_param with ref image context', () => {
      const params = httpClient.generateRequestParams('jimeng-4.0', true);
      const babiParam = JSON.parse(decodeURIComponent(params.babi_param));
      expect(babiParam.feature_key).toBe('to_image_referenceimage_generate');
      expect(babiParam.feature_entrance_detail).toBe('to_image-referenceimage-byte_edit');
    });
  });

  describe('Utility Methods', () => {
    it('should generate random string of correct length', () => {
      const str5 = httpClient.generateRandomString(5);
      const str11 = httpClient.generateRandomString(11);

      expect(str5).toHaveLength(5);
      expect(str11).toHaveLength(11);
      expect(/^[0-9A-Za-z]+$/.test(str5)).toBe(true);
    });

    it('should build HTTP query string correctly', () => {
      const query = httpClient.httpBuildQuery({
        name: 'test',
        value: '123',
        special: 'a&b=c'
      });

      expect(query).toContain('name=test');
      expect(query).toContain('value=123');
      expect(query).toContain('special=');
    });
  });

  describe('Authorization Generation', () => {
    it('should generate authorization headers for ImageX API', async () => {
      const headers = await httpClient.generateAuthorizationAndHeader(
        'test-access-key',
        'test-secret-key',
        'test-session-token',
        'cn-north-1',
        'imagex',
        'GET',
        { Action: 'ApplyImageUpload' }
      );

      // Check for authorization headers (AWS4 format uses different property names)
      expect(headers).toHaveProperty('Authorization');
      expect(headers.Authorization).toContain('AWS4-HMAC-SHA256');
      expect(headers).toHaveProperty('X-Amz-Security-Token', 'test-session-token');
      expect(headers.Authorization).toContain('HMAC-SHA256');
    });
  });
});
