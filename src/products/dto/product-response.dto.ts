import { ApiProperty } from '@nestjs/swagger';
import {
  ProductImageModel,
  ProductOptionModel,
} from '../../domain/product.model';

export class ProductResponseDto {
  @ApiProperty({
    description: 'Product unique identifier',
    example: 'clx1b2c3d4e5f6g7h8i9j0k1',
  })
  id!: string;

  @ApiProperty({
    description: 'Product name',
    example: 'Wireless Headphones',
  })
  name!: string;

  @ApiProperty({
    description: 'Product description',
    example:
      'High-quality wireless headphones with noise cancellation and 20-hour battery life',
  })
  description!: string;

  @ApiProperty({
    description: 'Number of times product has been sold',
    example: 120,
  })
  soldCount!: number;

  @ApiProperty({
    description: 'Whether the product is currently available',
    example: true,
  })
  isAvailable!: boolean;

  @ApiProperty({
    description: 'Product price in USD',
    example: 299.99,
  })
  price!: number;

  @ApiProperty({
    description: 'Product original/base price in USD',
    example: 349.99,
  })
  originalPrice?: number;

  @ApiProperty({
    description: 'Product-specific discount percent (0-100)',
    example: 20,
    required: false,
  })
  discountPercent?: number;

  @ApiProperty({
    description: 'Product category ID',
    example: 'clq1g3k9p0000qw3j5xh2e8m9',
  })
  categoryId!: string;

  @ApiProperty({
    description: 'Product category details',
    example: {
      id: 'clq1g3k9p0000qw3j5xh2e8m9',
      name: 'Electronics',
      description: 'Electronic devices and accessories',
      isActive: true,
    },
    required: false,
  })
  category?: any;

  @ApiProperty({
    description: 'Array of product image objects',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        url: { type: 'string' },
        publicId: { type: 'string' },
      },
    },
  })
  images!: ProductImageModel[];

  @ApiProperty({
    description: 'لیست آپشن‌های محصول',
    type: 'array',
    required: false,
    items: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        additionalPrice: { type: 'number' },
        isAvailable: { type: 'boolean' },
      },
    },
  })
  options?: ProductOptionModel[];

  @ApiProperty({
    description: 'Whether the product is active in the catalog',
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description: 'Product creation timestamp',
    example: '2024-01-15T10:30:00Z',
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Product last update timestamp',
    example: '2024-01-15T14:20:00Z',
    format: 'date-time',
  })
  updatedAt!: Date;
}
