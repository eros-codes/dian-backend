import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as redis from 'redis';

type RealRedisClient = ReturnType<typeof redis.createClient>;

type NoopRedisClient = {
  connect: () => Promise<void>;
  quit: () => Promise<void>;
  set: (k: string, v: string) => Promise<void>;
  setEx: (k: string, ttl: number, v: string) => Promise<void>;
  get: (k: string) => Promise<string | null>;
  del: (k: string) => Promise<number>;
  eval: (script: string, opts: { keys: string[] }) => Promise<string | null>;
  incr: (k: string) => Promise<number>;
  expire: (k: string, ttl: number) => Promise<boolean>;
  exists: (k: string) => Promise<number>;
  ttl: (k: string) => Promise<number>;
  publish: (ch: string, msg: string) => Promise<number>;
  duplicate: () => {
    connect: () => Promise<void>;
    pSubscribe: (pattern: string, cb: (message: string, channel: string) => void) => Promise<void>;
  };
};

export type RedisClient = RealRedisClient | NoopRedisClient;

/**
 * Redis service for QR session management
 * سرویس Redis برای مدیریت نشست‌های QR
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClient;
  private readonly logger = new Logger(RedisService.name);

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not set — using noop Redis client (non-persistent).');
      this.client = this.createNoopClient();
      return;
    }

    try {
      const client = redis.createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              this.logger.error('Redis max reconnection attempts reached');
              return new Error('Redis connection failed');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      client.on('error', (err) => {
        this.logger.error('Redis Client Error', err);
      });

      client.on('connect', () => {
        this.logger.log('Redis Client Connected');
      });

      client.on('ready', () => {
        this.logger.log('Redis Client Ready');
      });

      client.on('reconnecting', () => {
        this.logger.warn('Redis Client reconnecting');
      });

      client.on('end', () => {
        this.logger.warn('Redis Client connection ended');
      });

      await client.connect();
      this.client = client as RealRedisClient;
    } catch (err) {
      this.logger.error('Failed to connect to Redis, falling back to noop client', err as any);
      this.client = this.createNoopClient();
    }
  }

  async onModuleDestroy() {
    try {
      await this.client?.quit();
    } catch (err) {
      this.logger.debug('Error quitting Redis client (ignored)', err as any);
    }
  }

  getClient(): RedisClient {
    return this.client;
  }

  /**
   * Set key with TTL
   */
  async setex(key: string, ttl: number, value: string): Promise<void> {
    try {
      await (this.client as any).setEx(key, ttl, value);
    } catch (err) {
      this.logger.debug('Redis setEx failed (noop or error)', err as any);
    }
  }

  /**
   * Get key value
   */
  async get(key: string): Promise<string | null> {
    try {
      return await (this.client as any).get(key);
    } catch (err) {
      this.logger.debug('Redis get failed (noop or error)', err as any);
      return null;
    }
  }

  /**
   * Delete key
   */
  async del(key: string): Promise<number> {
    try {
      return await (this.client as any).del(key);
    } catch (err) {
      this.logger.debug('Redis del failed (noop or error)', err as any);
      return 0;
    }
  }

  /**
   * Atomic GET and DELETE using Lua script
   * This ensures single-use token consumption
   */
  async getAndDelete(key: string): Promise<string | null> {
    const luaScript = `
      local value = redis.call('GET', KEYS[1])
      if value then
        redis.call('DEL', KEYS[1])
      end
      return value
    `;

    try {
      const result = await (this.client as any).eval(luaScript, {
        keys: [key],
      });
      return result as string | null;
    } catch (error) {
      this.logger.debug('Lua script execution failed or noop client in use', error as any);
      // Fallback: non-atomic operation (not ideal but safer than crash)
      const value = await this.get(key);
      if (value) {
        await this.del(key);
      }
      return value;
    }
  }

  /**
   * Increment counter with TTL (for rate limiting)
   */
  async incr(key: string, ttl?: number): Promise<number> {
    try {
      const value = await (this.client as any).incr(key);
      if (ttl && value === 1) {
        await (this.client as any).expire(key, ttl);
      }
      return value;
    } catch (err) {
      this.logger.debug('Redis incr failed (noop or error)', err as any);
      return 1;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await (this.client as any).exists(key);
      return result === 1;
    } catch (err) {
      this.logger.debug('Redis exists failed (noop or error)', err as any);
      return false;
    }
  }

  /**
   * Get TTL of key
   */
  async ttl(key: string): Promise<number> {
    try {
      return await (this.client as any).ttl(key);
    } catch (err) {
      this.logger.debug('Redis ttl failed (noop or error)', err as any);
      return -2; // key does not exist
    }
  }

  /**
   * Publish message to Redis channel for pub/sub
   */
  async publish(channel: string, message: string): Promise<number> {
    try {
      return await (this.client as any).publish(channel, message);
    } catch (err) {
      this.logger.debug('Redis publish failed (noop or error)', err as any);
      return 0;
    }
  }

  private createNoopClient(): NoopRedisClient {
    const noopSubscriber = {
      connect: async () => {},
      pSubscribe: async (_pattern: string, _cb: (message: string, channel: string) => void) => {
        // no-op: no messages will be emitted when Redis absent
        return;
      },
    };

    return {
      connect: async () => {},
      quit: async () => {},
      set: async () => {},
      setEx: async () => {},
      get: async () => null,
      del: async () => 0,
      eval: async () => null,
      incr: async () => 1,
      expire: async () => true,
      exists: async () => 0,
      ttl: async () => -2,
      publish: async () => 0,
      duplicate: () => noopSubscriber,
    };
  }
}
