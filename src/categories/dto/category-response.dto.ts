import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryTypeOption } from './create-category.dto';

export class CategoryResponseDto {
  @ApiProperty({
    description: 'Category ID',
    example: 'clg7zbfrk0000uh5g3jpd8q1z',
  })
  id: string;

  @ApiProperty({ description: 'Category name', example: 'Electronics' })
  name: string;

  @ApiProperty({ description: 'Category active status', example: true })
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'Category discount percent (0-100)',
    example: 0,
  })
  discountPercent?: number;

  @ApiPropertyOptional({
    description: 'Identifier of the stored category icon',
    example: '4c8b6f7d-1234-4a6c-a1f0-2d93f5dfd4c9',
  })
  iconId?: string;

  @ApiPropertyOptional({
    description: 'Public path to the processed category icon',
    example: '/uploads/icons/4c8b6f7d-1234-4a6c-a1f0-2d93f5dfd4c9.svg',
  })
  iconPath?: string;

  @ApiProperty({
    description: 'Category type (CAFE or RESTAURANT)',
    enum: CategoryTypeOption,
    example: CategoryTypeOption.CAFE,
  })
  type: 'CAFE' | 'RESTAURANT' | 'BREAKFAST';

  @ApiPropertyOptional({
    description: 'Category-wide add-on options applied to products',
    type: 'array',
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
  options?: Array<{
    id: number;
    name: string;
    additionalPrice: number;
    isAvailable: boolean;
  }>;

  @ApiProperty({
    description: 'Category creation date',
    example: '2025-09-10T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Category last update date',
    example: '2025-09-10T10:00:00.000Z',
  })
  updatedAt: Date;
}
