//---products.mapper---//
import { ProductModel, ProductOptionModel } from '../product.model';
import { CreateProductDto } from '../../products/dto/create-product.dto';
import { UpdateProductDto } from '../../products/dto/update-product.dto';
import { ProductResponseDto } from '../../products/dto/product-response.dto';
import { CategoryMapper } from './category.mapper';

type PrismaDecimalLike = number | string | { toString: () => string };

/**
 * شکل تصویر در پاسخ Prisma (product.images include)
 */
type PrismaImageShape = {
  id: string;
  url: string;
  publicId: string;
  createdAt?: Date;
};

/**
 * شکل محصولی که از Prisma می‌آید
 */
type PrismaProductShape = {
  id: string;
  name: string;
  description: string;
  originalPrice: PrismaDecimalLike;
  discountPercent?: number | null;
  price: PrismaDecimalLike;
  categoryId: string;
  images: PrismaImageShape[]; // <-- اکنون آرایه‌ی اشیاء
  isActive: boolean;
  isAvailable: boolean;
  soldCount: number;
  createdAt: Date;
  updatedAt: Date;
  category?: PrismaCategoryShape;
  options?: PrismaProductOptionShape[];
};

type PrismaProductOptionShape = {
  id: number;
  productId: string;
  name: string;
  additionalPrice: number;
  isAvailable: boolean;
  categoryOptionId?: number | null;
};

type PrismaCategoryShape = {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  type: 'CAFE' | 'RESTAURANT' | 'BREAKFAST';
  iconId: string | null;
  icon?: { id: string; iconPath: string } | null;
  discountPercent?: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export class ProductMapper {
  private static toNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number(value);
    if (
      value &&
      typeof (value as { toString: () => string }).toString === 'function'
    ) {
      const str: string = (value as { toString: () => string }).toString();
      return Number(str);
    }
    return Number(value as number);
  }

  /**
   * تبدیل CreateProductDto -> ProductModel
   * اگر dto.images به عنوان string[] باشد آن را به آرایه‌ی اشیاء تبدیل می‌کنیم
   * (publicId و id در اینجا خالی هستند، زیرا ممکن است بعداً با آپلود فایل پر شوند)
   */
  static fromCreateDto(dto: CreateProductDto): ProductModel {
    const now = new Date();

    // اگر کاربر urls داده، آنها را به اشیاء با publicId خالی تبدیل کن
    const images =
      dto.images && Array.isArray(dto.images)
        ? dto.images.map((url) => ({
            id: '', // هنوز id در دیتابیس ساخته نشده
            url,
            publicId: '',
          }))
        : [];

    const options: ProductOptionModel[] = Array.isArray(dto.options)
      ? dto.options.map((opt) => ({
          id: opt.id,
          productId: '',
          name: opt.name,
          additionalPrice: Number(opt.additionalPrice ?? 0),
          isAvailable: opt.isAvailable !== false,
          categoryOptionId: opt.categoryOptionId ?? null,
        }))
      : [];

    return {
      id: '',
      name: dto.name,
      description: dto.description,
      originalPrice: Number(dto.originalPrice ?? dto.price ?? 0),
      discountPercent: Number(dto.discountPercent ?? 0),
      price: Number(dto.originalPrice ?? dto.price ?? 0),
      categoryId: dto.categoryId,
      images,
      options,
      isAvailable: dto.isAvailable !== false,
      soldCount: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    } as ProductModel;
  }

  /**
   * تبدیل نتیجه‌ی Prisma -> ProductModel
   * prismaProduct.images انتظار می‌رود که آرایه‌ای از اشیاء باشد (با publicId)
   */
  static toDomain(
    prismaProduct: PrismaProductShape & { category?: PrismaCategoryShape },
  ): ProductModel {
    return {
      id: prismaProduct.id,
      name: prismaProduct.name,
      description: prismaProduct.description,
      originalPrice: ProductMapper.toNumber(prismaProduct.originalPrice),
      discountPercent: prismaProduct.discountPercent ?? 0,
      price: ProductMapper.toNumber(prismaProduct.price),
      categoryId: prismaProduct.categoryId ?? prismaProduct.category?.id ?? '',
      category: prismaProduct.category
        ? CategoryMapper.toDomain(prismaProduct.category)
        : undefined,
      // نگهداری ساختار images به عنوان آرایه‌ای از آبجکت‌ها
      images:
        (prismaProduct.images || []).map((img: PrismaImageShape) => ({
          id: img.id,
          url: img.url,
          publicId: img.publicId ?? '',
        })) || [],
      isAvailable: prismaProduct.isAvailable,
      soldCount: prismaProduct.soldCount ?? 0,
      isActive: prismaProduct.isActive,
      createdAt: prismaProduct.createdAt,
      updatedAt: prismaProduct.updatedAt,
      options: (prismaProduct.options ?? []).map((opt) => ({
        id: opt.id,
        productId: opt.productId,
        name: opt.name,
        additionalPrice: Number(opt.additionalPrice ?? 0),
        isAvailable: Boolean(opt.isAvailable),
        categoryOptionId: opt.categoryOptionId ?? null,
      })),
    } as ProductModel;
  }

  /**
   * اعمال تغییرات UpdateProductDto روی مدل موجود
   * توجه: هیچ‌گونه تبدیل دیتابیس/تصاویر در اینجا انجام نمی‌شود،
   * فقط فیلدهای متنی را روی مدل اعمال می‌کنیم.
   */
  static applyUpdate(model: ProductModel, dto: UpdateProductDto): ProductModel {
    const nextImages = (() => {
      const kept =
        dto.keepImages?.map((img) => ({
          id: img.id ?? '',
          url: img.url,
          publicId: img.publicId ?? '',
        })) ?? model.images;

      const newlyUploaded = dto.images?.map((url) => ({
        id: '',
        url,
        publicId: '',
      }));

      if (newlyUploaded && newlyUploaded.length > 0) {
        return [...(dto.keepImages ? kept : model.images), ...newlyUploaded];
      }

      return kept;
    })();

    const updatedModel: ProductModel = {
      ...model,
      ...dto,
      images: nextImages,
      updatedAt: new Date(),
    };

    // اگر dto.images ارسال شده (به عنوان string[] یا آبجکت) بخواهیم نگهداری کنیم:
    // در آپدیت با فایل‌ها معمولاً از سرویس updateWithFiles استفاده می‌کنیم که ساختار تصاویر را عوض می‌کند.
    // بنابراین اینجا تغییری روی images انجام نمی‌دهیم؛ منطق تصاویر در Service/Repository قرار دارد.

    return updatedModel;
  }

  /**
   * تبدیل ProductModel -> ProductResponseDto (برای خروجی API)
   * تصاویر را همانطور که در مدل هستند پاس می‌دهیم (آرایه‌ای از اشیاء)
   */
  static toResponseDto(model: ProductModel): ProductResponseDto {
    return {
      id: model.id,
      name: model.name,
      description: model.description,
      price: model.price,
      // include originalPrice and discountPercent so admin UI can show/edit them
      originalPrice: model.originalPrice,
      discountPercent: model.discountPercent,
      categoryId: model.categoryId,
      category: model.category,
      images: model.images ?? [],
      options: model.options ?? [],
      isAvailable: model.isAvailable,
      soldCount: model.soldCount,
      isActive: model.isActive,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }
}
