import { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from '../../redis/redis.service';

// Local type matching ThrottlerStorageRecord shape to avoid direct deep import
export interface LocalThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redisService: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<LocalThrottlerStorageRecord> {
    const client = this.redisService.getClient();

    const blockKey = `${key}:block`;

    // If blocked, return blocked info
    const isBlocked = (await client.exists(blockKey)) === 1;
    if (isBlocked) {
      const timeToBlockExpire = await client.ttl(blockKey);
        return {
          totalHits: Number(await client.get(key) ?? 0),
          timeToExpire: Number(await client.ttl(key)),
          isBlocked: true,
          timeToBlockExpire: Number(timeToBlockExpire),
        } as LocalThrottlerStorageRecord;
    }

    // Increase counter and set TTL if first hit
    const totalHits = await client.incr(key);
    if (totalHits === 1) {
      await client.expire(key, ttl);
    }
    const timeToExpire = await client.ttl(key);

    // If over limit, set block key
    let timeToBlockExpire = 0;
    let blocked = false;
    if (totalHits > limit) {
      blocked = true;
      await client.setEx(blockKey, blockDuration, '1');
      timeToBlockExpire = await client.ttl(blockKey);
    }

    return {
      totalHits: Number(totalHits),
      timeToExpire: Number(timeToExpire),
      isBlocked: blocked,
      timeToBlockExpire: Number(timeToBlockExpire),
    } as LocalThrottlerStorageRecord;
  }
}
