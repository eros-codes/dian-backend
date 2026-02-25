import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CategoryOptionInputDto } from './category-option-input.dto';

export enum CategoryTypeOption {
  CAFE = 'CAFE',
  RESTAURANT = 'RESTAURANT',
  BREAKFAST = 'BREAKFAST',
}

export class CreateCategoryDto {
  @ApiProperty({ description: 'Category name', example: 'Electronics' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description:
      'Category icon source. Accepts an HTTPS URL, an SVG data URI, or raw <svg> markup.',
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
    description: 'Category type (CAFE or RESTAURANT)',
    enum: CategoryTypeOption,
    default: CategoryTypeOption.CAFE,
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
