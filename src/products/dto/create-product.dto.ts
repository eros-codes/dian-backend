//---create product---//
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateProductDto {
  @ApiProperty({ description: 'Product name', example: 'Wireless Headphones' })
  @IsString()
  name!: string;

  @ApiProperty({
    description: 'Detailed product description',
    example: 'High-quality...',
  })
  @IsString()
  description!: string;

  @ApiProperty({
    description: 'Product price in USD',
    example: 299.99,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({
    description: 'Product original/base price',
    example: 299.99,
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
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiProperty({ description: 'Product category ID', example: '...' })
  @IsString()
  categoryId!: string;

  // <-- make images optional (client may upload files instead)
  @ApiProperty({
    description: 'Array of product image URLs',
    type: [String],
    example: ['https://.../1.jpg', 'https://.../2.jpg'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @ApiPropertyOptional({
    description: 'لیست آپشن‌های محصول',
    type: [ProductOptionInputDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductOptionInputDto)
  @IsOptional()
  options?: ProductOptionInputDto[];
}
