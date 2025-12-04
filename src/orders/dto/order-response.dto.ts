import { ApiProperty } from '@nestjs/swagger';
import { OrderStatusEnum } from '../../common/enums/order-status.enum';

export class OrderItemResponseDto {
  @ApiProperty({ description: 'Order item unique identifier' })
  id!: string;

  @ApiProperty({ description: 'Order ID to which this item belongs' })
  orderId!: string;

  @ApiProperty({ description: 'Product ID of the item' })
  productId!: string;

  @ApiProperty({ description: 'Product name at time of order' })
  productName!: string;

  @ApiProperty({ description: 'Quantity ordered', example: 2 })
  quantity!: number;

  @ApiProperty({ description: 'Unit price at time of order', example: 99.99 })
  unitPrice!: number;

  @ApiProperty({ description: 'Total price for the item', example: 199.98 })
  totalPrice!: number;

  @ApiProperty({
    description: 'Unit price after tax/service adjustments',
    example: 109.99,
  })
  unitPriceFinal?: number;

  @ApiProperty({
    description: 'Total price after tax/service adjustments',
    example: 219.98,
  })
  totalPriceFinal?: number;

  @ApiProperty({
    description: 'Allocated tax amount for this item',
    example: 20,
  })
  taxAmount?: number;
  @ApiProperty({
    description: 'Product images at time of order',
    example: [
      { id: 'img1', url: 'https://cdn.example.com/image.jpg', publicId: null },
    ],
    required: false,
  })
  productImages?: { id: string; url: string; publicId?: string | null }[];

  @ApiProperty({
    description: 'Selected add-on options for this item',
    required: false,
    example: [
      { id: 5, name: 'شات اضافه اسپرسو', additionalPrice: 15000 },
      { id: 7, name: 'شیر بادام', additionalPrice: 12000 },
    ],
  })
  options?: { id?: number; name: string; additionalPrice: number }[];
}

export class OrderResponseDto {
  @ApiProperty({
    description: 'Order unique identifier',
    example: 'clx1b2c3d4e5f6g7h8i9j0k1',
  })
  id!: string;

  @ApiProperty({
    description: 'شماره میز',
    example: '5',
  })
  tableNumber!: string;

  @ApiProperty({
    enum: OrderStatusEnum,
    description: 'Order status',
    example: 'CONFIRMED',
  })
  status!: OrderStatusEnum;

  @ApiProperty({
    description: 'Payment method for the order',
    example: 'ONLINE',
  })
  paymentMethod!: string;

  @ApiProperty({
    description: 'Tracking code, if available',
    example: 'TRACK123',
    required: false,
  })
  trackingCode?: string | null;

  @ApiProperty({
    description: 'Final payment gateway reference code',
    example: '1234567890',
    required: false,
  })
  paymentGatewayRef?: string | null;

  @ApiProperty({
    description: 'Optional notes from customer',
    required: false,
    example: 'Please leave at the door',
  })
  notes?: string | null;

  @ApiProperty({
    description: 'Total order amount',
    example: 359.97,
  })
  totalAmount!: number;

  @ApiProperty({
    description: 'Subtotal before tax/service fees',
    example: 320.0,
    required: false,
  })
  subtotal?: number;

  @ApiProperty({
    description: 'Service fee applied to order',
    example: 15.0,
    required: false,
  })
  serviceFee?: number;

  @ApiProperty({
    description: 'Tax multiplier applied (e.g., 1.1 for 110%)',
    example: 1.1,
    required: false,
  })
  taxMultiplier?: number;

  @ApiProperty({
    description: 'Total tax amount applied to the order',
    example: 24.0,
    required: false,
  })
  taxAmount?: number;

  @ApiProperty({
    description: 'Order creation timestamp',
    example: '2024-01-15T10:30:00Z',
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Order last update timestamp',
    example: '2024-01-15T14:20:00Z',
    format: 'date-time',
  })
  updatedAt!: Date;

  @ApiProperty({
    type: [OrderItemResponseDto],
    description: 'Items included in the order',
  })
  items!: OrderItemResponseDto[];
}
