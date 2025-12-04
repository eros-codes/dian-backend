// backend/src/banners/banners.repository.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Banner, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type BannerCreateInput = Prisma.BannerUncheckedCreateInput;
type BannerUpdateInput = Prisma.BannerUpdateInput;

@Injectable()
export class BannersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: BannerCreateInput): Promise<Banner> {
    const toCreate: BannerCreateInput = {
      ...data,
      order: data.order ?? 0,
    };

    return this.prisma.$transaction(async (tx) => {
      await tx.banner.updateMany({
        where: {},
        data: { order: { increment: 1 } },
      });
      return tx.banner.create({ data: toCreate });
    });
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

    return this.prisma.banner.update({ where: { id }, data });
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
  }

  async reorder(ids: string[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < ids.length; i += 1) {
        const id = ids[i];
        await tx.banner.update({ where: { id }, data: { order: i } });
      }
    });
  }

  async remove(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException('Banner not found');
    }

    await this.prisma.banner.delete({ where: { id } });
  }
}
