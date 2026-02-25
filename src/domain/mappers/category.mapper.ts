import { Category, CategoryOptionModel } from '../category.model';
import type { CategoryResponseDto } from '../../categories/dto/category-response.dto';

type PrismaCategory = {
  id: string;
  name: string;
  isActive: boolean;
  type: 'CAFE' | 'RESTAURANT' | 'BREAKFAST';
  iconId: string | null;
  createdAt: Date;
  updatedAt: Date;
  icon?: { id: string; iconPath: string } | null;
  discountPercent?: number | null;
  options?: PrismaCategoryOption[];
};

type PrismaCategoryOption = {
  id: number;
  name: string;
  additionalPrice: number;
  isAvailable: boolean;
};

function mapOption(option: PrismaCategoryOption): CategoryOptionModel {
  return {
    id: option.id,
    name: option.name,
    additionalPrice: Number(option.additionalPrice ?? 0),
    isAvailable: option.isAvailable,
  };
}

export class CategoryMapper {
  static toDomain(prismaCategory: PrismaCategory): Category {
    return {
      id: prismaCategory.id,
      name: prismaCategory.name,
      discountPercent: prismaCategory.discountPercent ?? 0,
      isActive: prismaCategory.isActive,
      type: prismaCategory.type,
      iconId: prismaCategory.iconId ?? undefined,
      iconPath: prismaCategory.icon?.iconPath ?? undefined,
      createdAt: prismaCategory.createdAt,
      updatedAt: prismaCategory.updatedAt,
      options: (prismaCategory.options ?? []).map(mapOption),
    };
  }

  static toResponseDto(category: Category): CategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      isActive: category.isActive,
      discountPercent: category.discountPercent ?? 0,
      type: category.type,
      iconId: category.iconId ?? undefined,
      iconPath: category.iconPath ?? undefined,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      options: (category.options ?? []).map((option) => ({
        id: option.id,
        name: option.name,
        additionalPrice: option.additionalPrice,
        isAvailable: option.isAvailable,
      })),
    };
  }
}
