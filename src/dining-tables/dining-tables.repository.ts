import { Injectable } from '@nestjs/common';
import { DiningTable, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DiningTablesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<DiningTable[]> {
    return this.prisma.diningTable.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  findActive(): Promise<DiningTable[]> {
    return this.prisma.diningTable.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string): Promise<DiningTable | null> {
    return this.prisma.diningTable.findUnique({ where: { id } });
  }

  findByStaticId(staticId: string): Promise<DiningTable | null> {
    return this.prisma.diningTable.findUnique({ where: { staticId } });
  }

  create(data: Prisma.DiningTableCreateInput): Promise<DiningTable> {
    return this.prisma.diningTable.create({ data });
  }

  update(
    id: string,
    data: Prisma.DiningTableUpdateInput,
  ): Promise<DiningTable> {
    return this.prisma.diningTable.update({ where: { id }, data });
  }

  delete(id: string): Promise<DiningTable> {
    return this.prisma.diningTable.delete({ where: { id } });
  }
}
