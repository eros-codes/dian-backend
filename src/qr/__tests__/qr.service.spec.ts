import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QrService } from '../qr.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { GoneException, ConflictException } from '@nestjs/common';

describe('QrService', () => {
  let service: QrService;
  let prisma: PrismaService;
  let redis: RedisService;
  let config: ConfigService;

  // Mock data
  const mockTableId = '4';
  const mockIp = '127.0.0.1';
  const mockUa = 'Mozilla/5.0...';
  const mockToken = 'aB3xY9mN4pQ7wR2vK5sT8uL1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QrService,
        {
          provide: PrismaService,
          useValue: {
            tableSessionLog: {
              create: jest.fn(),
              groupBy: jest.fn(),
            },
            // ensure diningTable.findMany exists for getTableByStaticId
            diningTable: {
              findMany: jest
                .fn()
                .mockResolvedValue([
                  { id: '1', staticId: '4', name: 'Table 4', isActive: true },
                ]),
            },
          },
        },
        {
          provide: RedisService,
          useValue: {
            setex: jest.fn(),
            getAndDelete: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                QR_TOKEN_LENGTH: '24',
                QR_TOKEN_TTL_SECONDS: '300',
                CLIENT_URL: 'http://localhost:3001',
                QR_BIND_TO_IP: 'false',
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<QrService>(QrService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
    config = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('issueToken', () => {
    it('should issue a valid token', async () => {
      const result = await service.issueToken(mockTableId, mockIp, mockUa);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('deepLink');
      expect(result).toHaveProperty('ttl');
      expect(result.token.length).toBe(24);
      expect(result.deepLink).toContain(result.token);
      expect(result.ttl).toBe(300);
      expect(redis.setex).toHaveBeenCalled();
      expect(prisma.tableSessionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'issue',
          result: 'success',
        }),
      });
    });

    it('should generate unique tokens', async () => {
      const token1 = await service.issueToken(mockTableId, mockIp, mockUa);
      const token2 = await service.issueToken(mockTableId, mockIp, mockUa);

      expect(token1.token).not.toBe(token2.token);
    });
  });

  describe('consumeToken', () => {
    it('should consume a valid token successfully', async () => {
      const mockPayload = {
        tableId: mockTableId,
        tableNumber: 'Table 4',
        issuedAt: Date.now(),
        createdIp: mockIp,
        createdUa: mockUa,
        maxUses: 1,
        uses: 0,
      };

      jest
        .spyOn(redis, 'getAndDelete')
        .mockResolvedValue(JSON.stringify(mockPayload));

      const result = await service.consumeToken(mockToken, mockIp, mockUa);

      expect(result).toHaveProperty('tableId', mockTableId);
      expect(result).toHaveProperty('tableNumber', 'Table 4');
      expect(result).toHaveProperty('establishedAt');
      expect(redis.getAndDelete).toHaveBeenCalledWith(
        `table:session:${mockToken}`,
      );
      expect(prisma.tableSessionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'consume',
          result: 'success',
        }),
      });
    });

    it('should throw GoneException for expired token', async () => {
      jest.spyOn(redis, 'getAndDelete').mockResolvedValue(null);

      await expect(
        service.consumeToken(mockToken, mockIp, mockUa),
      ).rejects.toThrow(GoneException);
    });

    it('should throw GoneException for already used token', async () => {
      jest.spyOn(redis, 'getAndDelete').mockResolvedValue(null);

      await expect(
        service.consumeToken(mockToken, mockIp, mockUa),
      ).rejects.toThrow(GoneException);
    });

    it('should reject token with invalid format', async () => {
      await expect(
        service.consumeToken('invalid', mockIp, mockUa),
      ).rejects.toThrow();
    });
  });

  describe('IP binding', () => {
    it('should reject token with different IP when binding enabled', async () => {
      // Create new service with IP binding enabled
      const moduleWithBinding = await Test.createTestingModule({
        providers: [
          QrService,
          {
            provide: PrismaService,
            useValue: {
              tableSessionLog: {
                create: jest.fn(),
              },
            },
          },
          {
            provide: RedisService,
            useValue: {
              getAndDelete: jest.fn(),
            },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'QR_BIND_TO_IP') return 'true';
                return config.get(key);
              }),
            },
          },
        ],
      }).compile();

      const serviceWithBinding = moduleWithBinding.get<QrService>(QrService);
      const redisWithBinding =
        moduleWithBinding.get<RedisService>(RedisService);

      const mockPayload = {
        tableId: mockTableId,
        tableNumber: 'Table 4',
        issuedAt: Date.now(),
        createdIp: '192.168.1.1',
        createdUa: mockUa,
        maxUses: 1,
        uses: 0,
      };

      jest
        .spyOn(redisWithBinding, 'getAndDelete')
        .mockResolvedValue(JSON.stringify(mockPayload));

      await expect(
        serviceWithBinding.consumeToken(mockToken, '192.168.1.2', mockUa),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getSessionStats', () => {
    it('should return session statistics', async () => {
      const mockStats = [
        { action: 'issue', result: 'success', _count: 10 },
        { action: 'consume', result: 'success', _count: 8 },
      ];

      jest
        .spyOn(prisma.tableSessionLog, 'groupBy')
        .mockResolvedValue(mockStats as any);

      const result = await service.getSessionStats(24);

      expect(result).toEqual(mockStats);
      expect(prisma.tableSessionLog.groupBy).toHaveBeenCalled();
    });
  });
});
