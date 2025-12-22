import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class FooterSettingsService {
  constructor(private prisma: PrismaService, private readonly redis: RedisService) {}

  async findAll() {
    return this.prisma.footerSetting.findMany({ orderBy: { id: 'asc' } });
  }

  async create(data: { key: string; title: string; url?: string }) {
    const created = await this.prisma.footerSetting.create({
      data: { key: data.key, title: data.title, url: data.url || null },
    });
    try {
      await this.redis.getClient().publish('settings', JSON.stringify({ type: 'footerSettingCreated', id: created.id, data: created }));
    } catch (e) {}
    return created;
  }

  async update(id: number, data: { title?: string; url?: string }) {
    const exists = await this.prisma.footerSetting.findUnique({
      where: { id },
    });
    if (!exists) throw new NotFoundException('Footer setting not found');
    const updated = await this.prisma.footerSetting.update({ where: { id }, data });
    try {
      await this.redis.getClient().publish('settings', JSON.stringify({ type: 'footerSettingUpdated', id, data: updated }));
    } catch (e) {}
    return updated;
  }

  async remove(id: number) {
    const exists = await this.prisma.footerSetting.findUnique({
      where: { id },
    });
    if (!exists) throw new NotFoundException('Footer setting not found');
    const deleted = await this.prisma.footerSetting.delete({ where: { id } });
    try {
      await this.redis.getClient().publish('settings', JSON.stringify({ type: 'footerSettingDeleted', id }));
    } catch (e) {}
    return { success: true };
  }
}
