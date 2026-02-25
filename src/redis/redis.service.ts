import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as redis from 'redis';

export type RedisClient = ReturnType<typeof redis.createClient>;

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
      throw new Error('Missing required environment variable REDIS_URL');
    }

    this.client = redis.createClient({
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

    this.client.on('error', (err) => {
      this.logger.error('Redis Client Error', err);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis Client Connected');
    });

    this.client.on('ready', () => {
      this.logger.log('Redis Client Ready');
    });

    this.client.on('reconnecting', () => {
      this.logger.warn('Redis Client reconnecting');
    });

    this.client.on('end', () => {
      this.logger.warn('Redis Client connection ended');
    });

    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  getClient(): RedisClient {
    return this.client;
  }

  /**
   * Set key with TTL
   */
  async setex(key: string, ttl: number, value: string): Promise<void> {
    await this.client.setEx(key, ttl, value);
  }

  /**
   * Get key value
   */
  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  /**
   * Delete key
   */
  async del(key: string): Promise<number> {
    return await this.client.del(key);
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
      const result = await this.client.eval(luaScript, {
        keys: [key],
      });
      return result as string | null;
    } catch (error) {
      this.logger.error('Lua script execution failed', error);
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
    const value = await this.client.incr(key);
    if (ttl && value === 1) {
      await this.client.expire(key, ttl);
    }
    return value;
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * Get TTL of key
   */
  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  /**
   * Publish message to Redis channel for pub/sub
   */
  async publish(channel: string, message: string): Promise<number> {
    return await this.client.publish(channel, message);
  }
}
