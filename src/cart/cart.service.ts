import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const CART_KEY_PREFIX = 'cart:session:';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(private readonly redis: RedisService) {}

  private keyFor(sessionId: string) {
    return `${CART_KEY_PREFIX}${sessionId}`;
  }

  async getCart(sessionId: string): Promise<string | null> {
    if (!sessionId) return null;
    try {
      const key = this.keyFor(sessionId);
      const value = await this.redis.get(key);
      return value;
    } catch (err) {
      this.logger.error('Failed to get cart from redis', err as any);
      return null;
    }
  }

  async setCart(sessionId: string, json: string, ttlSeconds: number | null = null): Promise<void> {
    if (!sessionId) return;
    try {
      const key = this.keyFor(sessionId);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.redis.setex(key, ttlSeconds, json);
        return;
      }
      // fallback to simple set (no TTL)
      await this.redis.getClient().set(key, json);
    } catch (err) {
      this.logger.error('Failed to set cart in redis', err as any);
    }
  }

  async deleteCart(sessionId: string): Promise<void> {
    if (!sessionId) return;
    try {
      const key = this.keyFor(sessionId);
      await this.redis.del(key);
    } catch (err) {
      this.logger.error('Failed to delete cart from redis', err as any);
    }
  }
}
