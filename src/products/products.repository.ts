//---product.repository.ts---//
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { Decimal } from '@prisma/client/runtime/library';
import type { Prisma } from '@prisma/client';
import {
  ProductModel,
  ProductOptionModel,
  ProductImageModel,
} from '../domain/product.model';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductMapper } from '../domain/mappers/product.mapper';
import { CategoryTypeOption } from '../categories/dto/create-category.dto';

type PrismaProductWithRelations = Prisma.ProductGetPayload<{
  include: { category: true; images: true; options: true };
}>;

export type ProductOptionSyncInput = {
  id?: number;
  name: string;
  additionalPrice: number;
  isAvailable: boolean;
  categoryOptionId?: number | null;
  _destroy?: boolean;
};

@Injectable()
export class ProductsRepository {
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

  private imagesCreatePayload(images?: ProductImageModel[]) {
    if (!images || images.length === 0) return undefined;
    return {
      create: images.map((img) => {
        return {
          url: img.url,
          publicId: img.publicId ?? null,
          // فقط در صورتی id را اضافه کن که معتبر و غیرخالی باشد:
          ...(img.id && img.id.trim() !== '' ? { id: img.id } : {}),
        };
      }),
    };
  }

  private optionsCreatePayload(options?: ProductOptionModel[]) {
    if (!options || options.length === 0) return undefined;
    return {
      create: options.map((opt) => ({
        name: opt.name,
        additionalPrice: opt.additionalPrice ?? 0,
        isAvailable: opt.isAvailable ?? true,
        categoryOptionId: opt.categoryOptionId ?? null,
      })),
    };
  }

  async create(
    model: Omit<ProductModel, 'id' | 'createdAt' | 'updatedAt' | 'category'>,
  ): Promise<ProductModel> {
    const data: Prisma.ProductUncheckedCreateInput = {
      name: model.name,
      description: model.description,
      originalPrice: new Decimal(model.originalPrice),
      discountPercent: model.discountPercent ?? 0,
      price: new Decimal(model.price),
      categoryId: model.categoryId,
      isActive: model.isActive,
      isAvailable: model.isAvailable,
      soldCount: model.soldCount ?? 0,
    };
    const imagesPayload = this.imagesCreatePayload(model.images);
    if (imagesPayload) {
      data.images = imagesPayload;
    }
    const optionsPayload = this.optionsCreatePayload(model.options);
    if (optionsPayload) {
      data.options = optionsPayload;
    }

    const created = await this.prisma.product.create({
      data,
      include: { category: true, images: true, options: true },
    });
    const domain = ProductMapper.toDomain(created as PrismaProductWithRelations);

    // Publish product creation so websocket/clients can react immediately
    try {
      const client = this.redis.getClient();
      if (client) {
        await client.publish(
          'products',
          JSON.stringify({ type: 'productCreated', id: domain.id, product: domain }),
        );
      }
    } catch (e) {
      // don't fail the creation if publish fails; will be picked up by polling
    }

    return domain;
  }

  async findAll(query: ProductQueryDto): Promise<ProductModel[]> {
    const where: Prisma.ProductWhereInput = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.category) where.categoryId = query.category;
    const categoryWhere: Prisma.CategoryWhereInput = { isActive: true };
    if (query.categoryType) {
      categoryWhere.type = query.categoryType;
    }

    // Only include active products whose category is active
    // Apply 15-second timeout to prevent hanging on slow/blocked queries
    const rows = await this.runWithTimeout(
      this.prisma.product.findMany({
        where: { ...where, isActive: true, category: categoryWhere },
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
        include: { category: true, images: true, options: true },
      }),
      15000,
    );
    return rows.map((row) =>
      ProductMapper.toDomain(row as PrismaProductWithRelations),
    );
  }

  // New: find popular products ordered by soldCount desc
  async findPopular(
    limit = 10,
    categoryType?: CategoryTypeOption,
  ): Promise<ProductModel[]> {
    const baseCategoryWhere: Prisma.CategoryWhereInput = { isActive: true };
    if (categoryType) {
      baseCategoryWhere.type = categoryType;
    }

    // Only include active products whose category is also active
    // Apply timeout to prevent hanging
    const rows = await this.runWithTimeout(
      this.prisma.product.findMany({
        where: { isActive: true, category: baseCategoryWhere },
        orderBy: { soldCount: 'desc' },
        take: limit,
        include: { category: true, images: true, options: true },
      }),
      10000,
    );
    // If all soldCount are zero (no historical sales), fallback to newest products
    const anySold = rows.some((r) => r.soldCount && Number(r.soldCount) > 0);
    if (!anySold) {
      const fallback = await this.prisma.product.findMany({
        where: { isActive: true, category: baseCategoryWhere },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { category: true, images: true, options: true },
      });
      return fallback.map((row) =>
        ProductMapper.toDomain(row as PrismaProductWithRelations),
      );
    }
    return rows.map((row) =>
      ProductMapper.toDomain(row as PrismaProductWithRelations),
    );
  }

  async findById(id: string): Promise<ProductModel | undefined> {
    const row = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, images: true, options: true },
    });
    if (!row) return undefined;
    return ProductMapper.toDomain(row as PrismaProductWithRelations);
  }

  async update(
    id: string,
    data: Partial<
      Omit<ProductModel, 'id' | 'createdAt' | 'updatedAt' | 'category'>
    >,
  ): Promise<ProductModel | undefined> {
    const updateData: Prisma.ProductUncheckedUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.originalPrice !== undefined)
      updateData.originalPrice = new Decimal(Number(data.originalPrice));
    if (data.discountPercent !== undefined)
      updateData.discountPercent = data.discountPercent;
    if (data.price !== undefined)
      updateData.price = new Decimal(Number(data.price));
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.isAvailable !== undefined)
      updateData.isAvailable = data.isAvailable;
    if (data.soldCount !== undefined) updateData.soldCount = data.soldCount;

    const updatedRow = await this.prisma.product.update({
      where: { id },
      data: updateData,
      include: { category: true, images: true, options: true },
    });
    const domain = ProductMapper.toDomain(updatedRow as PrismaProductWithRelations);

    // Publish product update event so websocket/clients can react immediately
    try {
      await this.redis.getClient().publish(
        'products',
        JSON.stringify({ type: 'productUpdated', id, product: domain }),
      );
    } catch (e) {
      // don't fail the update if publish fails; log later if needed
    }

    return domain;
  }

  async remove(id: string): Promise<boolean> {
    // If there are historical order items or returns referencing this product
    // we must NOT delete the product record because the order history must
    // remain intact. In that case we soft-delete by setting isActive=false.
    const orderItemsCount = await this.prisma.orderItem.count({
      where: { productId: id },
    });
    const returnsCount = 0; // Returns feature removed

    if (orderItemsCount > 0 || (returnsCount && returnsCount > 0)) {
      // mark product inactive instead of deleting
      await this.prisma.product.update({
        where: { id },
        data: { isActive: false },
      });
      return true;
    }

    // No historic references: safe to delete images and the product itself
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });
    });

    return true;
  }

  async syncOptions(
    productId: string,
    options: ProductOptionSyncInput[],
  ): Promise<void> {
    const normalized = Array.isArray(options) ? options : [];

    const existingOptions: Array<{
      id: number;
      categoryOptionId: number | null;
    }> = await this.prisma.productOption.findMany({
      where: { productId },
      select: { id: true, categoryOptionId: true },
    });
    const categoryManagedIds = new Set(
      existingOptions
        .filter((opt) => opt.categoryOptionId !== null)
        .map((opt) => opt.id),
    );

    const keepIds = normalized
      .filter((opt) => !opt._destroy && opt.id)
      .map((opt) => opt.id as number);

    const deleteQuery =
      keepIds.length > 0
        ? {
            productId,
            id: { notIn: [...keepIds, ...categoryManagedIds] },
            categoryOptionId: null,
          }
        : { productId, categoryOptionId: null };

    const deleteManyPromise = this.prisma.productOption.deleteMany({
      where: deleteQuery,
    });

    const updatePromises = normalized
      .filter(
        (opt): opt is Required<typeof opt> => Boolean(opt.id) && !opt._destroy,
      )
      .filter((opt) => !categoryManagedIds.has(opt.id))
      .map((opt) =>
        this.prisma.productOption.update({
          where: { id: opt.id },
          data: {
            name: opt.name,
            additionalPrice: opt.additionalPrice ?? 0,
            isAvailable: opt.isAvailable ?? true,
          },
        }),
      );

    const createPromises = normalized
      .filter((opt) => !opt._destroy && !opt.id)
      .filter(
        (opt) =>
          opt.categoryOptionId === undefined || opt.categoryOptionId === null,
      )
      .map((opt) =>
        this.prisma.productOption.create({
          data: {
            productId,
            name: opt.name,
            additionalPrice: opt.additionalPrice ?? 0,
            isAvailable: opt.isAvailable ?? true,
            categoryOptionId: null,
          },
        }),
      );

    const operations = [
      deleteManyPromise,
      ...updatePromises,
      ...createPromises,
    ];

    if (operations.length === 0) {
      return;
    }

    await this.prisma.$transaction(operations);
  }

  async addImages(
    productId: string,
    files: { url: string; publicId: string }[],
  ): Promise<{ id: string; url: string; publicId: string | null }[]> {
    if (!files || files.length === 0) return [];
    const created = await Promise.all(
      files.map((file) =>
        this.prisma.productImage.create({
          data: {
            productId,
            url: file.url,
            publicId: file.publicId ?? null,
          },
        }),
      ),
    );
    return created.map((image) => ({
      id: image.id,
      url: image.url,
      publicId: image.publicId,
    }));
  }
  // ✅ حذف عکس با id واقعی عکس
  async removeImage(imageId: string): Promise<{ publicId: string | null }> {
    const image = await this.prisma.productImage.findUnique({
      where: { id: imageId }, // این id باید آیدی رکورد عکس باشه
    });
    if (!image) throw new NotFoundException('عکس پیدا نشد ❌');

    await this.prisma.productImage.delete({
      where: { id: imageId },
    });

    return { publicId: image.publicId };
  }
}
