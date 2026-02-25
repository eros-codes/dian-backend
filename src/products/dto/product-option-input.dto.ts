import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ProductOptionInputDto {
  @ApiPropertyOptional({ description: 'شناسه آپشن (برای ویرایش)' })
  @IsOptional()
  @IsNumber()
  id?: number;

  @ApiProperty({ description: 'نام آپشن', example: 'شیر بادام' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'شناسه آپشن منوی مرجع (در صورت وجود)' })
  @IsOptional()
  @IsNumber()
  categoryOptionId?: number;

  @ApiProperty({
    description: 'مبلغ افزوده (تومان)',
    example: 15000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  additionalPrice!: number;

  @ApiProperty({ description: 'وضعیت فعال بودن آپشن', example: true })
  @IsBoolean()
  isAvailable!: boolean;

  @ApiPropertyOptional({
    description: 'در صورت true، آپشن حذف می‌شود',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  _destroy?: boolean;
}

export class ProductOptionInputArrayDto {
  @ApiProperty({ type: [ProductOptionInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductOptionInputDto)
  options!: ProductOptionInputDto[];
}
