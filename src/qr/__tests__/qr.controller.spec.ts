import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { QrController } from '../qr.controller';
import { QrService } from '../qr.service';
import { Request, Response } from 'express';

describe('QrController', () => {
  let controller: QrController;
  let service: QrService;

  const mockQrService = {
    issueToken: jest.fn(),
    consumeToken: jest.fn(),
    getSessionStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ ttl: 60000, limit: 100 }],
        }),
      ],
      controllers: [QrController],
      providers: [
        {
          provide: QrService,
          useValue: mockQrService,
        },
      ],
    }).compile();

    controller = module.get<QrController>(QrController);
    service = module.get<QrService>(QrService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('issueToken', () => {
    it('should issue a new token', async () => {
      const mockResult = {
        token: 'aB3xY9mN4pQ7wR2vK5sT8uL1',
        deepLink: 'http://localhost:3001/t/aB3xY9mN4pQ7wR2vK5sT8uL1',
        ttl: 300,
      };

      mockQrService.issueToken.mockResolvedValue(mockResult);

      const mockReq = {
        headers: { 'user-agent': 'test-agent' },
        socket: { remoteAddress: '127.0.0.1' },
      } as any as Request;

      const result = await controller.issueToken(
        { tableStaticId: '4' },
        mockReq,
      );

      expect(result).toEqual({
        deepLink: mockResult.deepLink,
        token: mockResult.token,
        ttl: mockResult.ttl,
      });
      expect(service.issueToken).toHaveBeenCalledWith(
        '4',
        '127.0.0.1',
        'test-agent',
      );
    });

    it('should handle X-Forwarded-For header', async () => {
      const mockResult = {
        token: 'test-token',
        deepLink: 'http://localhost:3001/t/test-token',
        ttl: 300,
      };

      mockQrService.issueToken.mockResolvedValue(mockResult);

      const mockReq = {
        headers: {
          'user-agent': 'test-agent',
          'x-forwarded-for': '192.168.1.100, 10.0.0.1',
        },
        socket: { remoteAddress: '127.0.0.1' },
      } as any as Request;

      await controller.issueToken({ tableStaticId: '4' }, mockReq);

      expect(service.issueToken).toHaveBeenCalledWith(
        '4',
        '192.168.1.100',
        'test-agent',
      );
    });
  });

  describe('issueTokenRedirect', () => {
    it('should redirect to deepLink', async () => {
      const mockResult = {
        token: 'test-token',
        deepLink: 'http://localhost:3001/t/test-token',
        ttl: 300,
      };

      mockQrService.issueToken.mockResolvedValue(mockResult);

      const mockReq = {
        headers: { 'user-agent': 'test-agent' },
        socket: { remoteAddress: '127.0.0.1' },
      } as any as Request;

      const mockRes = {
        redirect: jest.fn(),
      } as any as Response;

      await controller.issueTokenRedirect(
        { tableStaticId: '4' },
        mockReq,
        mockRes,
      );

      expect(mockRes.redirect).toHaveBeenCalledWith(302, mockResult.deepLink);
    });
  });

  describe('consumeToken', () => {
    it('should consume token and set cookie', async () => {
      const mockResult = {
        tableId: '4',
        tableNumber: 'Table 4',
        establishedAt: new Date(),
        // controller expects sessionId and sessionTtlSeconds to set cookie
        sessionId: 'test-token',
        sessionTtlSeconds: 600,
      };

      mockQrService.consumeToken.mockResolvedValue(mockResult);

      const mockReq = {
        headers: { 'user-agent': 'test-agent' },
        socket: { remoteAddress: '127.0.0.1' },
      } as any as Request;

      const mockRes = {
        cookie: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any as Response;

      await controller.consumeToken({ token: 'test-token' }, mockReq, mockRes);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'table_session',
        'test-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
        }),
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });
  });

  describe('getStats', () => {
    it('should return session statistics', async () => {
      const mockStats = [{ action: 'issue', result: 'success', _count: 10 }];

      mockQrService.getSessionStats.mockResolvedValue(mockStats);

      const result = await controller.getStats();

      expect(result).toEqual(mockStats);
      expect(service.getSessionStats).toHaveBeenCalledWith(24);
    });
  });
});
