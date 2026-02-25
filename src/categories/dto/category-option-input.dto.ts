import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CategoryOptionInputDto {
  @ApiPropertyOptional({
    description: 'Existing category option id',
    example: 1,
  })
  @IsNumber()
  @IsOptional()
  id?: number;

  @ApiPropertyOptional({ description: 'Option name', example: 'اضافه پنیر' })
  @ValidateIf(
    (option: Partial<CategoryOptionInputDto>) =>
      option.id === undefined || option.name !== undefined,
  )
  @IsString()
  @MaxLength(120)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Extra price in base currency units',
    example: 15000,
    default: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  additionalPrice?: number;

  @ApiPropertyOptional({
    description: 'Whether the option is available',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @ApiPropertyOptional({
    description: 'Mark true to remove this option from the category',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  _delete?: boolean;
}
