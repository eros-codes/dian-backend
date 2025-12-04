import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FooterSettingsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.footerSetting.findMany({ orderBy: { id: 'asc' } });
  }

  async create(data: { key: string; title: string; url?: string }) {
    return this.prisma.footerSetting.create({
      data: { key: data.key, title: data.title, url: data.url || null },
    });
  }

  async update(id: number, data: { title?: string; url?: string }) {
    const exists = await this.prisma.footerSetting.findUnique({
      where: { id },
    });
    if (!exists) throw new NotFoundException('Footer setting not found');
    return this.prisma.footerSetting.update({ where: { id }, data });
  }

  async remove(id: number) {
    const exists = await this.prisma.footerSetting.findUnique({
      where: { id },
    });
    if (!exists) throw new NotFoundException('Footer setting not found');
    await this.prisma.footerSetting.delete({ where: { id } });
    return { success: true };
  }
}
