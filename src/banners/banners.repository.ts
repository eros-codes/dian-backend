// backend/src/banners/banners.repository.ts
import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { Banner, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

type BannerCreateInput = Prisma.BannerUncheckedCreateInput;
type BannerUpdateInput = Prisma.BannerUpdateInput;

@Injectable()
export class BannersRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  async create(data: BannerCreateInput): Promise<Banner> {
    const toCreate: BannerCreateInput = {
      ...data,
      order: data.order ?? 0,
    };

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.banner.updateMany({
        where: {},
        data: { order: { increment: 1 } },
      });
      return tx.banner.create({ data: toCreate });
    });

    // Publish banner update to Redis so gateway broadcasts to clients
    try {
      const receivers = await this.redis.publish('banners', JSON.stringify({ action: 'created', id: result.id }));
      // receivers = number of clients that received the message
      console.log(`[banners.repository] published 'created' to 'banners' channel, receivers=${receivers}`);
    } catch (err) {
      // Don't fail if Redis unavailable
      console.error('Failed to publish banner creation to Redis:', err);
    }

    return result;
  }

  async findAllActive(): Promise<Banner[]> {
    return this.prisma.banner.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
  }

  async findAll(): Promise<Banner[]> {
    return this.prisma.banner.findMany({
      orderBy: { order: 'asc' },
    });
  }

  async findById(id: string): Promise<Banner | null> {
    return this.prisma.banner.findUnique({ where: { id } });
  }

  async update(id: string, data: BannerUpdateInput): Promise<Banner> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException('Banner not found');
    }

    const result = await this.prisma.banner.update({ where: { id }, data });

    // Publish banner update to Redis so gateway broadcasts to clients
    try {
      const receivers = await this.redis.publish('banners', JSON.stringify({ action: 'updated', id }));
      console.log(`[banners.repository] published 'updated' to 'banners' channel, receivers=${receivers}`);
    } catch (err) {
      // Don't fail if Redis unavailable
      console.error('Failed to publish banner update to Redis:', err);
    }

    return result;
  }

  async swapOrders(idA: string, idB: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const a = await tx.banner.findUnique({ where: { id: idA } });
      const b = await tx.banner.findUnique({ where: { id: idB } });
      if (!a || !b) {
        throw new NotFoundException('Banner(s) not found');
      }

      const aOrder = a.order ?? 0;
      const bOrder = b.order ?? 0;

      await tx.banner.update({ where: { id: idA }, data: { order: bOrder } });
      await tx.banner.update({ where: { id: idB }, data: { order: aOrder } });
    });

    // Publish banner update to Redis
    try {
      const receivers = await this.redis.publish('banners', JSON.stringify({ action: 'reordered' }));
      console.log(`[banners.repository] published 'reordered' to 'banners' channel, receivers=${receivers}`);
    } catch (err) {
      console.error('Failed to publish banner reorder to Redis:', err);
    }
  }

  async reorder(ids: string[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < ids.length; i += 1) {
        const id = ids[i];
        await tx.banner.update({ where: { id }, data: { order: i } });
      }
    });

    // Publish banner update to Redis
    try {
      const receivers = await this.redis.publish('banners', JSON.stringify({ action: 'reordered' }));
      console.log(`[banners.repository] published 'reordered' to 'banners' channel, receivers=${receivers}`);
    } catch (err) {
      console.error('Failed to publish banner reorder to Redis:', err);
    }
  }

  async remove(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException('Banner not found');
    }

    await this.prisma.banner.delete({ where: { id } });

    // Publish banner deletion to Redis
    try {
      const receivers = await this.redis.publish('banners', JSON.stringify({ action: 'deleted', id }));
      console.log(`[banners.repository] published 'deleted' to 'banners' channel, receivers=${receivers}`);
    } catch (err) {
      console.error('Failed to publish banner deletion to Redis:', err);
    }
  }
}
