//...product.model...//
import { Category } from './category.model';

export interface ProductImageModel {
  id?: string;
  url: string;
  publicId: string;
}

export interface ProductOptionModel {
  id?: number;
  productId?: string;
  name: string;
  additionalPrice: number;
  isAvailable: boolean;
  categoryOptionId?: number | null;
}

export class ProductModel {
  id!: string;
  name!: string;
  description!: string;
  // originalPrice: the base price set by admin
  originalPrice!: number;
  // discountPercent: product-specific discount (0-100)
  discountPercent!: number;
  // price: final price after applying discount (calculated on backend)
  price!: number;
  categoryId!: string;
  images!: ProductImageModel[];
  options: ProductOptionModel[] = [];
  isAvailable!: boolean;
  soldCount!: number;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
  category?: Category;
}
