//---product.service.ts---//
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductImageModel, ProductModel } from '../domain/product.model';
import { ProductMapper } from '../domain/mappers/product.mapper';
import {
  ProductOptionSyncInput,
  ProductsRepository,
} from './products.repository';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CategoryTypeOption } from '../categories/dto/create-category.dto';
import { ProductOptionInputDto } from './dto/product-option-input.dto';

function computePrice(originalPrice: number, discountPercent?: number) {
  const orig = Number(originalPrice ?? 0);
  const dp = Number(discountPercent ?? 0);
  const safeDp = Math.max(0, Math.min(100, Math.round(dp)));
  return Number((orig * (1 - safeDp / 100)).toFixed(2));
}

function normalizeOptionPayload(
  options?: ProductOptionInputDto[],
): ProductOptionSyncInput[] {
  if (!Array.isArray(options)) return [];
  return options.map((opt) => ({
    id: opt.id,
    name: opt.name,
    additionalPrice: Number(opt.additionalPrice ?? 0),
    isAvailable: opt.isAvailable !== false,
    categoryOptionId: opt.categoryOptionId ?? null,
    _destroy: opt._destroy === true,
  }));
}

type ImageKeepInput =
  | string
  | {
      id?: string;
      url: string;
      publicId?: string;
    };

function normalizeKeptImages(
  keepImages: ImageKeepInput[] | undefined,
  fallback: ProductImageModel[],
): ProductImageModel[] {
  if (!keepImages) {
    return fallback;
  }

  return keepImages.map((img) =>
    typeof img === 'string'
      ? { id: '', url: img, publicId: '' }
      : {
          id: img.id ?? '',
          url: img.url,
          publicId: img.publicId ?? '',
        },
  );
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly repo: ProductsRepository,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // ✅ حالت قدیمی بدون فایل (برای تست/سازگاری)
  async create(dto: CreateProductDto): Promise<ProductModel> {
    const model = ProductMapper.fromCreateDto(dto);
    const originalPrice = Number(model.originalPrice ?? model.price ?? 0);
    const discount = Number(model.discountPercent ?? 0);
    const finalPrice = computePrice(originalPrice, discount);
    const created = await this.repo.create({
      name: model.name,
      description: model.description,
      originalPrice,
      discountPercent: discount,
      price: finalPrice,
      categoryId: model.categoryId,
      images: model.images ?? [],
      isAvailable: model.isAvailable,
      isActive: true,
      soldCount: model.soldCount ?? 0,
      options: model.options ?? [],
    });
    if (dto.options) {
      await this.repo.syncOptions(
        created.id,
        normalizeOptionPayload(dto.options),
      );
      return this.repo.findById(created.id) as Promise<ProductModel>;
    }
    return created;
  }

  // ✅ ایجاد با فایل (جدید)
  async createWithFiles(dto: CreateProductDto, files: Express.Multer.File[]) {
    const uploaded: { url: string; publicId: string }[] = [];
    for (const f of files) {
      const r = await this.cloudinary.uploadImage(f.buffer);
      uploaded.push({ url: r.secure_url, publicId: r.public_id });
    }

    const model = ProductMapper.fromCreateDto(dto);

    const originalPrice = Number(model.originalPrice ?? model.price ?? 0);
    const discount = Number(model.discountPercent ?? 0);
    const finalPrice = computePrice(originalPrice, discount);

    const created = await this.repo.create({
      name: model.name,
      description: model.description,
      originalPrice,
      discountPercent: discount,
      price: finalPrice,
      categoryId: model.categoryId,
      images: uploaded.map((u) => ({ url: u.url, publicId: u.publicId })), // no id field
      isAvailable: model.isAvailable,
      isActive: true,
      soldCount: model.soldCount ?? 0,
      options: model.options ?? [],
    });

    if (dto.options) {
      await this.repo.syncOptions(
        created.id,
        normalizeOptionPayload(dto.options),
      );
      return this.repo.findById(created.id) as Promise<ProductModel>;
    }

    return created;
  }

  async findAll(query: ProductQueryDto): Promise<ProductModel[]> {
    return this.repo.findAll(query);
  }

  async findOne(id: string): Promise<ProductModel | undefined> {
    return this.repo.findById(id);
  }

  // ✅ بروزرسانی با فایل (جدید)
  async updateWithFiles(
    id: string,
    dto: UpdateProductDto,
    files: Express.Multer.File[],
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('محصول پیدا نشد ❌');

    const uploaded: { url: string; publicId: string }[] = [];
    for (const f of files) {
      const r = await this.cloudinary.uploadImage(f.buffer);
      uploaded.push({ url: r.secure_url, publicId: r.public_id });
    }

    const keep = normalizeKeptImages(dto.keepImages, existing.images);

    const finalImages: ProductImageModel[] = [
      ...keep,
      ...uploaded.map((u) => ({
        id: '',
        url: u.url,
        publicId: u.publicId,
      })),
    ];

    const updated = await this.repo.update(id, {
      name: dto.name ?? existing.name,
      description: dto.description ?? existing.description,
      // if originalPrice/discountPercent provided, recalc price; otherwise keep existing
      originalPrice: dto.originalPrice ?? existing.originalPrice,
      discountPercent: dto.discountPercent ?? existing.discountPercent,
      price:
        dto.originalPrice !== undefined || dto.discountPercent !== undefined
          ? computePrice(
              dto.originalPrice ?? existing.originalPrice,
              dto.discountPercent ?? existing.discountPercent,
            )
          : existing.price,
      categoryId: dto.categoryId ?? existing.categoryId,
      isAvailable:
        dto.isAvailable !== undefined ? dto.isAvailable : existing.isAvailable,
      isActive: true,
      images: finalImages, // ✅ حالا شامل publicId است
    });

    if (dto.options) {
      await this.repo.syncOptions(id, normalizeOptionPayload(dto.options));
      return this.repo.findById(id);
    }

    return updated;
  }

  // ✅ فقط برای بروزرسانی دیتا
  async update(
    id: string,
    dto: UpdateProductDto,
  ): Promise<ProductModel | undefined> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('محصول پیدا نشد ❌');

    const updated = ProductMapper.applyUpdate(existing, dto);
    // prepare price/originalPrice/discountPercent fields
    const originalPrice =
      dto.originalPrice ?? existing.originalPrice ?? updated.price;
    const discount = dto.discountPercent ?? existing.discountPercent ?? 0;
    const finalPrice = computePrice(originalPrice, discount);

    const baseUpdated = await this.repo.update(id, {
      name: updated.name,
      description: updated.description,
      originalPrice,
      discountPercent: discount,
      price: finalPrice,
      categoryId: updated.categoryId,
      isAvailable:
        dto.isAvailable !== undefined ? dto.isAvailable : existing.isAvailable,
      isActive: true,
    });

    if (dto.options) {
      await this.repo.syncOptions(id, normalizeOptionPayload(dto.options));
      return this.repo.findById(id);
    }

    return baseUpdated;
  }

  async remove(id: string): Promise<boolean> {
    return this.repo.remove(id);
  }

  // New: return popular products based on soldCount
  async getPopularProducts(
    limit = 10,
    categoryType?: CategoryTypeOption,
  ): Promise<ProductModel[]> {
    return this.repo.findPopular(limit, categoryType);
  }

  /**
   * ✅ آپلود عکس‌های جداگانه (route /products/:id/images)
   */
  async addProductImages(productId: string, files: Express.Multer.File[]) {
    const product = await this.repo.findById(productId);
    if (!product) throw new NotFoundException('محصول پیدا نشد ❌');

    const uploadedFiles: { url: string; publicId: string }[] = [];

    for (const file of files) {
      const result = await this.cloudinary.uploadImage(file.buffer);
      uploadedFiles.push({
        url: result.secure_url,
        publicId: result.public_id,
      });
    }

    // repo.addImages returns created image records with id/url/publicId
    const created = await this.repo.addImages(productId, uploadedFiles);
    // created: [{id, url, publicId}, ...]
    return created;
  }

  /**
   * ✅ حذف عکس از Cloudinary و دیتابیس
   */

  async removeProductImage(imageId: string) {
    const { publicId } = await this.repo.removeImage(imageId);
    if (publicId) await this.cloudinary.deleteFile(publicId);
    return { success: true };
  }
}
