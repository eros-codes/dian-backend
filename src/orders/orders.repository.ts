import { BadRequestException, Injectable, Logger, Inject } from '@nestjs/common';
import { OrderStatus, PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { OrderItemModel, OrderModel } from '../domain/order.model';
import { OrderQueryDto } from './dto/order-query.dto';
import { OrderStatusEnum } from '../common/enums/order-status.enum';

type OrderWithItems = Prisma.OrderGetPayload<{
  include: {
    items: {
      include: {
        product: {
          select: {
            id: true;
            name: true;
            images: {
              select: {
                id: true;
                url: true;
                publicId: true;
              };
            };
          };
        };
      };
    };
  };
}>;

type OrderItemCreateInput = {
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unitPriceFinal: number;
  totalPriceFinal: number;
  taxAmount: number;
  options?: { id?: number; name: string; additionalPrice: number }[];
};

interface CreateOrderData {
  tableNumber: string;
  subtotal: number;
  serviceFee: number;
  taxMultiplier: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod?: PaymentMethod;
  trackingCode?: string | null;
  notes?: string | null;
  items: OrderItemCreateInput[];
}

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  return value.toNumber();
}

type OrderItemOption = NonNullable<OrderItemModel['options']>[number];

function normalizeOptions(
  raw: Prisma.JsonValue | undefined,
): OrderItemModel['options'] {
  if (!raw) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw.map((entry) => {
      if (entry && typeof entry === 'object') {
        const option = entry as {
          id?: number;
          name?: unknown;
          additionalPrice?: unknown;
        };
        const normalized: OrderItemOption = {
          id: option.id,
          name: typeof option.name === 'string' ? option.name : '',
          additionalPrice:
            typeof option.additionalPrice === 'number'
              ? option.additionalPrice
              : 0,
        };
        return normalized;
      }
      return { name: '', additionalPrice: 0 };
    });
  }

  try {
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw) as unknown;
      if (
        Array.isArray(parsed) ||
        typeof parsed === 'object' ||
        typeof parsed === 'string'
      ) {
        return normalizeOptions(parsed as Prisma.JsonValue);
      }
    }
  } catch {
    // ignore malformed json
  }

  return [];
}

function mapOrderItem(row: OrderWithItems['items'][number]): OrderItemModel {
  return {
    id: row.id,
    orderId: row.orderId,
    productId: row.productId,
    productName: row.product?.name ?? '',
    productImages:
      row.product?.images.map((img) => ({
        id: img.id,
        url: img.url,
        publicId: img.publicId ?? null,
      })) ?? [],
    quantity: row.quantity,
    unitPrice: toNumber(row.unitPrice),
    totalPrice: toNumber(row.totalPrice),
    unitPriceFinal: toNumber(row.unitPriceFinal ?? row.unitPrice),
    totalPriceFinal: toNumber(row.totalPriceFinal ?? row.totalPrice),
    taxAmount: toNumber(row.taxAmount ?? 0),
    options: normalizeOptions(row.optionsJson),
    product: row.product
      ? {
          id: row.product.id,
          name: row.product.name,
          productImages: row.product.images.map((img) => ({
            id: img.id,
            url: img.url,
            publicId: img.publicId ?? null,
          })),
        }
      : undefined,
  };
}

function mapOrder(row: OrderWithItems): OrderModel {
  return {
    id: row.id,
    tableNumber: row.tableNumber,
    paymentMethod: row.paymentMethod,
    notes: row.notes ?? null,
    trackingCode: row.trackingCode ?? null,
    paymentGatewayRef: row.paymentGatewayRef ?? null,
    status: row.status as OrderStatusEnum,
    totalAmount: toNumber(row.totalAmount),
    subtotal: row.subtotal !== null ? toNumber(row.subtotal) : undefined,
    serviceFee: row.serviceFee !== null ? toNumber(row.serviceFee) : undefined,
    taxMultiplier:
      row.taxMultiplier !== null ? toNumber(row.taxMultiplier) : undefined,
    taxAmount: row.taxAmount !== null ? toNumber(row.taxAmount) : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    items: row.items.map(mapOrderItem),
  };
}

function buildOrderInclude() {
  return {
    items: {
      include: {
        product: {
          select: {
            id: true,
            name: true,
            images: {
              select: { id: true, url: true, publicId: true },
            },
          },
        },
      },
    },
  } satisfies Prisma.OrderInclude;
}

@Injectable()
export class OrdersRepository {
  private readonly logger = new Logger(OrdersRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  async create(data: CreateOrderData): Promise<OrderModel> {
    try {
      const created = await this.prisma.order.create({
        data: {
          tableNumber: data.tableNumber,
          paymentMethod: data.paymentMethod ?? PaymentMethod.COD,
          trackingCode: data.trackingCode ?? null,
          notes: data.notes ?? null,
          subtotal: data.subtotal,
          serviceFee: data.serviceFee,
          taxMultiplier: data.taxMultiplier,
          taxAmount: data.taxAmount,
          totalAmount: data.totalAmount,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              unitPriceFinal: item.unitPriceFinal,
              totalPriceFinal: item.totalPriceFinal,
              taxAmount: item.taxAmount,
              optionsJson: item.options ?? [],
            })),
          },
        },
        include: buildOrderInclude(),
      });

      // Update soldCount for each product in the order
      await Promise.all(
        data.items.map((item) =>
          this.prisma.product.update({
            where: { id: item.productId },
            data: { soldCount: { increment: item.quantity } },
          }),
        ),
      );

      return mapOrder(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          const fieldName =
            (error.meta?.field_name as string | undefined) ?? '';
          if (fieldName.includes('productId')) {
            throw new BadRequestException(
              'Product not found for one or more order items.',
            );
          }
          if (fieldName.includes('orderId') || fieldName.includes('userId')) {
            throw new BadRequestException('Related entity not found.');
          }
        }
      }

      throw error;
    }
  }

  async findAll(query: OrderQueryDto): Promise<OrderModel[]> {
    const where: Prisma.OrderWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    const rows = await this.prisma.order.findMany({
      where,
      skip: query.skip,
      take: query.take,
      orderBy: { createdAt: 'desc' },
      include: buildOrderInclude(),
    });

    return rows.map(mapOrder);
  }

  async findById(id: string): Promise<OrderModel | undefined> {
    const row = await this.prisma.order.findUnique({
      where: { id },
      include: buildOrderInclude(),
    });

    return row ? mapOrder(row) : undefined;
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
  ): Promise<OrderModel | undefined> {
    const existing = await this.prisma.order.findUnique({
      where: { id },
      include: buildOrderInclude(),
    });

    if (!existing) {
      return undefined;
    }

    if (existing.status === status) {
      return mapOrder(existing);
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status },
      include: buildOrderInclude(),
    });

    // Publish update to Redis so any gateway can broadcast to clients
    try {
      const client = this.redis.getClient();
      if (client) {
        const receivers = await client.publish(
          `orders:${id}`,
          JSON.stringify({ orderId: id, order: mapOrder(updated) }),
        );
        this.logger.log(`Published order update to Redis orders:${id}, receivers=${receivers}`);
      } else {
        this.logger.warn('Redis client not available to publish order update');
      }
    } catch (err) {
      this.logger.warn('Failed to publish order update to Redis: ' + (err as Error).message);
    }

    return mapOrder(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.order.delete({ where: { id } });
  }
}
