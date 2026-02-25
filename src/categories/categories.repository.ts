import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryMapper } from '../domain/mappers/category.mapper';
import { Category } from '../domain/category.model';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class CategoriesRepository {
  private readonly logger = new Logger(CategoriesRepository.name);
  private readonly cacheTtl = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private async runWithTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Prisma query timed out after ${ms}ms`)), ms);
    });
    try {
      return await Promise.race([p, timeout]);
    } finally {
      clearTimeout(timer!);
    }
  }

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
    const cacheKey = 'categories:all';
    try {
      // Try cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as Category[];
      }
    } catch (e) {
      this.logger.warn(`Cache retrieval failed for ${cacheKey}: ${(e as Error).message}`);
    }

    const categories = await this.runWithTimeout(
      this.prisma.category.findMany({
        where: { name: { not: 'uncategorized' } },
        include: this.defaultInclude,
      }),
      10000,
    );
    const result = categories.map((category) => CategoryMapper.toDomain(category));

    // Store in cache
    try {
      await this.redis.setex(cacheKey, this.cacheTtl, JSON.stringify(result));
    } catch (e) {
      this.logger.warn(`Cache storage failed for ${cacheKey}: ${(e as Error).message}`);
    }

    return result;
  }

  async findAllActive(): Promise<Category[]> {
    const cacheKey = 'categories:active';
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as Category[];
      }
    } catch (e) {
      this.logger.warn(`Cache retrieval failed for ${cacheKey}: ${(e as Error).message}`);
    }

    const categories = await this.runWithTimeout(
      this.prisma.category.findMany({
        where: { isActive: true, name: { not: 'uncategorized' } },
        include: this.defaultInclude,
      }),
      10000,
    );
    const result = categories.map((category) => CategoryMapper.toDomain(category));

    try {
      await this.redis.setex(cacheKey, this.cacheTtl, JSON.stringify(result));
    } catch (e) {
      this.logger.warn(`Cache storage failed for ${cacheKey}: ${(e as Error).message}`);
    }

    return result;
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
