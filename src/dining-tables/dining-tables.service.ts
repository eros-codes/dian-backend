import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DiningTable } from '@prisma/client';
import { DiningTablesRepository } from './dining-tables.repository';
import { CreateDiningTableDto } from './dto/create-dining-table.dto';
import { UpdateDiningTableDto } from './dto/update-dining-table.dto';

@Injectable()
export class DiningTablesService {
  constructor(private readonly repository: DiningTablesRepository) {}

  async create(dto: CreateDiningTableDto): Promise<DiningTable> {
    const existing = await this.repository.findByStaticId(dto.staticId);
    if (existing) {
      throw new ConflictException('میز با این شناسه از قبل وجود دارد');
    }

    return this.repository.create({
      staticId: dto.staticId,
      name: dto.name,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
    });
  }

  findAll(): Promise<DiningTable[]> {
    return this.repository.findAll();
  }

  findActive(): Promise<DiningTable[]> {
    return this.repository.findActive();
  }

  async update(id: string, dto: UpdateDiningTableDto): Promise<DiningTable> {
    const table = await this.repository.findById(id);
    if (!table) {
      throw new NotFoundException('میز پیدا نشد');
    }

    if (dto.staticId && dto.staticId !== table.staticId) {
      const existing = await this.repository.findByStaticId(dto.staticId);
      if (existing) {
        throw new ConflictException('شناسه ثابت تکراری است');
      }
    }

    return this.repository.update(id, {
      staticId: dto.staticId ?? table.staticId,
      name: dto.name ?? table.name,
      description: dto.description ?? table.description,
      isActive: dto.isActive ?? table.isActive,
    });
  }

  async remove(id: string): Promise<void> {
    const table = await this.repository.findById(id);
    if (!table) {
      throw new NotFoundException('میز پیدا نشد');
    }

    await this.repository.delete(id);
  }
}
