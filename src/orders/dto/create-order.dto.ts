import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  Min,
  IsEnum,
  IsOptional,
  IsString,
  IsNotEmpty,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
// Keep a local enum for validation to avoid importing generated types directly
export enum PaymentMethodEnum {
  ONLINE = 'ONLINE',
  COD = 'COD',
}

export class OrderItemOptionDto {
  @ApiProperty({
    required: false,
    description: 'شناسه آپشن انتخاب‌شده (در صورت موجود بودن در سیستم)',
    example: 12,
  })
  @IsOptional()
  @IsNumber()
  id?: number;

  @ApiProperty({
    description: 'نام آپشن انتخاب شده',
    example: 'شات اضافه اسپرسو',
  })
  @IsString()
  @IsNotEmpty({ message: 'نام آپشن الزامی است' })
  name!: string;

  @ApiProperty({ description: 'قیمت افزایشی آپشن', example: 15000 })
  @IsNumber()
  @Min(0)
  additionalPrice!: number;
}

export class CreateOrderItemDto {
  @ApiProperty({ description: 'شناسه محصول', example: 'prod_123' })
  @IsString()
  productId!: string;

  @ApiProperty({ description: 'تعداد سفارش داده شده از این محصول', example: 2 })
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiProperty({
    description: 'قیمت واحد نهایی (شامل آپشن‌ها)',
    example: 89000,
  })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiProperty({
    type: [OrderItemOptionDto],
    required: false,
    description: 'لیست آپشن‌های انتخاب‌شده برای این آیتم',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemOptionDto)
  options?: OrderItemOptionDto[];
}

export class CreateOrderDto {
  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @ApiProperty()
  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @ApiProperty({
    enum: PaymentMethodEnum,
    description: 'Payment method: ONLINE or COD',
  })
  @IsEnum(PaymentMethodEnum)
  paymentMethod!: PaymentMethodEnum;

  @ApiProperty({ required: false, description: 'شماره میز - Table number' })
  @IsOptional()
  @IsString()
  tableNumber?: string;

  @ApiProperty({
    required: false,
    description: 'Optional notes from customer about the order',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
