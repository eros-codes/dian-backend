import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryMapper } from '../domain/mappers/category.mapper';
import { Category } from '../domain/category.model';

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly defaultInclude: Prisma.CategoryInclude = {
    icon: true,
    options: {
      select: {
        id: true,
        name: true,
        additionalPrice: true,
        isAvailable: true,
      },
    },
  };

  async create(
    data: Prisma.CategoryCreateInput | Prisma.CategoryUncheckedCreateInput,
  ): Promise<Category> {
    const category = await this.prisma.category.create({
      data,
      include: this.defaultInclude,
    });
    return CategoryMapper.toDomain(category);
  }

  async findAll(): Promise<Category[]> {
    const categories = await this.prisma.category.findMany({
      where: { name: { not: 'uncategorized' } },
      include: this.defaultInclude,
    });
    return categories.map((category) => CategoryMapper.toDomain(category));
  }

  async findAllActive(): Promise<Category[]> {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true, name: { not: 'uncategorized' } },
      include: this.defaultInclude,
    });
    return categories.map((category) => CategoryMapper.toDomain(category));
  }

  async findById(id: string): Promise<Category | null> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: this.defaultInclude,
    });
    return category ? CategoryMapper.toDomain(category) : null;
  }

  async findByName(name: string): Promise<Category | null> {
    const category = await this.prisma.category.findUnique({
      where: { name },
      include: this.defaultInclude,
    });
    return category ? CategoryMapper.toDomain(category) : null;
  }

  async update(
    id: string,
    data: Prisma.CategoryUpdateInput | Prisma.CategoryUncheckedUpdateInput,
  ): Promise<Category> {
    const category = await this.prisma.category.update({
      where: { id },
      data,
      include: this.defaultInclude,
    });
    return CategoryMapper.toDomain(category);
  }

  async delete(id: string): Promise<Category> {
    const category = await this.prisma.category.delete({
      where: { id },
      include: this.defaultInclude,
    });
    return CategoryMapper.toDomain(category);
  }
}
