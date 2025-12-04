import { ApiProperty } from '@nestjs/swagger';
import {
  Equals,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethodEnum } from '../../orders/dto/create-order.dto';
import { OrderItemOptionDto } from '../../orders/dto/create-order.dto';

class PaymentOrderItemDto {
  @ApiProperty({ description: 'شناسه محصول', example: 'prod_123' })
  @IsString()
  productId!: string;

  @ApiProperty({ description: 'تعداد سفارش داده شده', example: 2 })
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiProperty({ description: 'قیمت واحد در زمان سفارش', example: 89000 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiProperty({
    type: [OrderItemOptionDto],
    required: false,
    description: 'آپشن‌های انتخاب‌شده برای این آیتم',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemOptionDto)
  options?: OrderItemOptionDto[];
}

export class CreatePaymentDto {
  @ApiProperty({ type: [PaymentOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentOrderItemDto)
  items!: PaymentOrderItemDto[];

  @ApiProperty({ description: 'مجموع مبلغ سفارش (تومان)', example: 178000 })
  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @ApiProperty({ enum: PaymentMethodEnum, default: PaymentMethodEnum.ONLINE })
  @IsEnum(PaymentMethodEnum)
  @Equals(PaymentMethodEnum.ONLINE, {
    message: 'روش پرداخت باید آنلاین باشد',
  })
  paymentMethod!: PaymentMethodEnum;

  @ApiProperty({ description: 'شماره میز', required: false, example: 'A12' })
  @IsOptional()
  @IsString()
  tableNumber?: string;

  @ApiProperty({ description: 'یادداشت‌های مشتری', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
