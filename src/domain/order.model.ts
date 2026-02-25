//order.model
import { OrderStatusEnum } from '../common/enums/order-status.enum';

export class OrderItemModel {
  id!: string;
  orderId!: string;
  productId!: string;
  productName!: string;
  productImages: { id: string; url: string; publicId?: string | null }[];
  quantity!: number;
  unitPrice!: number;
  totalPrice!: number;
  unitPriceFinal?: number;
  totalPriceFinal?: number;
  taxAmount?: number;
  options?: { id?: number; name: string; additionalPrice: number }[];
  product?: {
    id: string;
    name: string;
    productImages: { id: string; url: string; publicId?: string | null }[];
  };
}

export class OrderModel {
  id!: string;
  tableNumber!: string; // شماره میز
  status!: OrderStatusEnum;
  paymentMethod!: string;
  trackingCode?: string | null;
  paymentGatewayRef?: string | null;
  notes?: string | null;
  totalAmount!: number;
  subtotal?: number;
  serviceFee?: number;
  taxMultiplier?: number;
  taxAmount?: number;
  createdAt!: Date;
  updatedAt!: Date;
  items!: OrderItemModel[];
}
