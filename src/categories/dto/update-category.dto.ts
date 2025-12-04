import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MaxLength,
  IsNumber,
  Min,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { CategoryTypeOption } from './create-category.dto';
import { Type } from 'class-transformer';
import { CategoryOptionInputDto } from './category-option-input.dto';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: 'Category name', example: 'Electronics' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Category active status', example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Category discount percent (0-100)',
    example: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  discountPercent?: number;

  @ApiPropertyOptional({
    description:
      'New icon source. Accepts an HTTPS URL, an SVG data URI، or raw <svg> markup.',
    examples: {
      remoteUrl: {
        summary: 'Remote SVG URL',
        value: 'https://example.com/icon.svg',
      },
      dataUrl: {
        summary: 'SVG data URI',
        value: 'data:image/svg+xml;base64,PHN2ZyB4bWxu...',
      },
      inlineSvg: {
        summary: 'Inline SVG markup',
        value:
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">...</svg>',
      },
    },
  })
  @IsString()
  @IsOptional()
  @MaxLength(20000)
  iconUrl?: string;

  @ApiPropertyOptional({
    description: 'Clear the currently assigned category icon',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  clearIcon?: boolean;

  @ApiPropertyOptional({
    description: 'Category type (CAFE or RESTAURANT)',
    enum: CategoryTypeOption,
  })
  @IsEnum(CategoryTypeOption)
  @IsOptional()
  type?: CategoryTypeOption;

  @ApiPropertyOptional({
    description: 'Category-wide options to sync with all products',
    type: [CategoryOptionInputDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryOptionInputDto)
  @IsOptional()
  options?: CategoryOptionInputDto[];
}
