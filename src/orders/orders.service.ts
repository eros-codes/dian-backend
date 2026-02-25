//C:\Users\LOQ\WebProjects\Cafe\backend\src\orders\orders.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { CreateOrderDto, PaymentMethodEnum } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { OrderModel } from '../domain/order.model';
import { OrdersRepository } from './orders.repository';
import { PrismaService } from '../prisma/prisma.service';
import { computeOrderPricing } from './utils/pricing.util';

/**
 * Service responsible for managing order operations including creation, retrieval,
 * and status updates for customer orders.
 *
 * @class OrdersService
 * @since 1.0.0
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly repo: OrdersRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Creates a new COD order. Online orders must go through the payment flow
   * and will be persisted only after successful gateway verification.
   */
  async create(tableNumber: string, dto: CreateOrderDto): Promise<OrderModel> {
    if (dto.paymentMethod === PaymentMethodEnum.ONLINE) {
      throw new BadRequestException(
        'Online orders must be created via the payment endpoint.',
      );
    }

    const pricing = await computeOrderPricing(this.prisma, dto.items);

    // debug
    try {
      const declaredTotal = Number(dto.totalAmount ?? 0);
      if (declaredTotal && Math.abs(declaredTotal - pricing.totalAmount) > 1) {
        console.warn(
          '[OrdersService.create] declared total differs from computed total',
          {
            declaredTotal,
            computedTotal: pricing.totalAmount,
          },
        );
      }
    } catch {
      // ignore logging errors
    }

    return this.repo.create({
      tableNumber,
      paymentMethod: PaymentMethod.COD,
      trackingCode: null,
      notes: dto.notes ?? null,
      subtotal: pricing.subtotal,
      serviceFee: pricing.serviceFee,
      taxMultiplier: pricing.taxMultiplier,
      taxAmount: pricing.taxAmount,
      totalAmount: pricing.totalAmount,
      items: pricing.items.map((i, index) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        totalPrice: i.totalPrice,
        unitPriceFinal: i.unitPriceFinal,
        totalPriceFinal: i.totalPriceFinal,
        taxAmount: i.taxAmount,
        options: dto.items[index]?.options?.map((option) => ({
          id: option.id,
          name: option.name,
          additionalPrice: option.additionalPrice,
        })),
      })),
    });
  }

  /**
   * Retrieves orders with optional filtering by status and pagination support.
   */
  async findAll(query: OrderQueryDto): Promise<OrderModel[]> {
    return this.repo.findAll(query);
  }

  /**
   * Retrieves an order by its unique identifier, including all order items.
   *
   * @async
   * @function findOne
   * @param {string} id - The unique identifier of the order
   * @returns {Promise<OrderModel | undefined>} The order model if found, undefined otherwise
   *
   * @example
   * ```typescript
   * const order = await ordersService.findOne('order-id-123');
   * if (order) {
   *   console.log(order.totalAmount); // Order total
   *   console.log(order.items.length); // Number of items
   * }
   * ```
   *
   * @since 1.0.0
   */
  async findOne(id: string): Promise<OrderModel | undefined> {
    return this.repo.findById(id);
  }

  /**
   * Updates the status of an existing order.
   */
  async updateStatus(
    id: string,
    dto: UpdateOrderStatusDto,
  ): Promise<OrderModel | undefined> {
    return this.repo.updateStatus(id, dto.status);
  }
}
