//---update product---//
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductOptionInputDto } from './product-option-input.dto';

export class UpdateProductDto {
  @ApiPropertyOptional({
    description: 'Product name',
    example: 'Premium Wireless Headphones',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Product description', example: '...' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Product price',
    example: 249.99,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({
    description: 'Product original/base price',
    example: 249.99,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  originalPrice?: number;

  @ApiPropertyOptional({
    description: 'Product discount percent (0-100)',
    example: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  discountPercent?: number;

  @ApiPropertyOptional({
    description: 'Whether the product is currently available',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @ApiPropertyOptional({ description: 'Product category ID', example: '...' })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Array of product image URLs',
    type: [String],
    example: ['https://.../1.jpg'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  // <-- new: URLs of existing images that should be kept (when using FormData)
  @ApiPropertyOptional({
    description: 'List of existing image object to keep)',
    type: [Object],
  })
  @IsArray()
  @IsOptional()
  keepImages?: { id?: string; url: string; publicId?: string }[];

  @ApiPropertyOptional({
    description: 'به‌روزرسانی آپشن‌های محصول',
    type: [ProductOptionInputDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductOptionInputDto)
  @IsOptional()
  options?: ProductOptionInputDto[];
}
