import { OrderModel } from '../order.model';
import {
  OrderResponseDto,
  OrderItemResponseDto,
} from '../../orders/dto/order-response.dto';

export class OrderMapper {
  static toResponseDto(model: OrderModel): OrderResponseDto {
    const items: OrderItemResponseDto[] = (model.items ?? []).map((i) => ({
      id: i.id,
      orderId: i.orderId,
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      totalPrice: i.totalPrice,
      unitPriceFinal: i.unitPriceFinal,
      totalPriceFinal: i.totalPriceFinal,
      taxAmount: i.taxAmount,
      productImages:
        i.productImages?.map((img) => ({
          id: img.id,
          url: img.url,
          publicId: img.publicId ?? null,
        })) ?? [],
      options: i.options ?? [],
    }));

    try {
      // Log summary: product names and counts (avoid dumping full image objects)
      const summary = items.map((it) => ({
        productId: it.productId,
        productName: it.productName,
        images: it.productImages?.length ?? 0,
      }));
      console.log('OrderMapper.toResponseDto - items summary:', summary);
    } catch {
      // ignore logging errors
    }

    return {
      id: model.id,
      tableNumber: model.tableNumber,
      paymentMethod: model.paymentMethod,
      notes: model.notes ?? null,
      trackingCode: model.trackingCode ?? null,
      paymentGatewayRef: model.paymentGatewayRef ?? null,
      status: model.status,
      subtotal: model.subtotal,
      serviceFee: model.serviceFee,
      taxMultiplier: model.taxMultiplier,
      taxAmount: model.taxAmount,
      totalAmount: model.totalAmount,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      items,
    };
  }
}
