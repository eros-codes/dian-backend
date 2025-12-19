import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { Decimal } from '@prisma/client/runtime/library';

interface CartItemPayload {
  productId: string;
  quantity: number;
  unitPrice: number;
  baseUnitPrice: number;
  optionsSubtotal?: number;
  options?: Record<string, any>[] | null;
}

@Injectable()
export class SharedCartService {
  private readonly logger = new Logger(SharedCartService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async getOrCreateCart(tableId: string) {
    let cart = await this.prisma.sharedCart.findUnique({
      where: { tableId },
      include: { items: true },
    });

    if (!cart) {
      cart = await this.prisma.sharedCart.create({
        data: {
          tableId,
          totalAmount: new Decimal(0),
          totalItems: 0,
        },
        include: { items: true },
      });
    }

    return this.mapCart(cart);
  }

  async addItem(tableId: string, payload: CartItemPayload) {
    this.logger.log(`➡️ addItem called for table=${tableId} payload=${JSON.stringify(payload)}`);

    const cart = await this.prisma.sharedCart.findUnique({
      where: { tableId },
      include: { items: true },
    });

    if (!cart) {
      throw new Error(`Cart not found for table ${tableId}`);
    }

    // Check if item with same product + options already exists
    const existingItemId = this.buildCartItemId(
      payload.productId,
      payload.options,
    );
    const existingItem = cart.items.find((item) => item.id === existingItemId);

    let updatedCart: any;
    if (existingItem) {
      // Update quantity
      this.logger.log(`🔁 existing item ${existingItem.id} found, incrementing quantity by ${payload.quantity}`);
      await this.prisma.sharedCartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + payload.quantity },
      });
    } else {
      // Add new item
      this.logger.log(`➕ creating new item ${existingItemId} qty=${payload.quantity}`);
      await this.prisma.sharedCartItem.create({
        data: {
          id: existingItemId,
          cartId: cart.id,
          productId: payload.productId,
          quantity: payload.quantity,
          unitPrice: new Decimal(payload.unitPrice),
          baseUnitPrice: new Decimal(payload.baseUnitPrice),
          optionsSubtotal: new Decimal(payload.optionsSubtotal || 0),
          options:
            payload.options && payload.options.length > 0
              ? payload.options
              : undefined,
        },
      });
    }

    // Recalculate totals
    updatedCart = await this.recalculateTotals(tableId);
    // Publish update to Redis so gateway can broadcast
    await this.publishCartUpdate(tableId, updatedCart);
    return this.mapCart(updatedCart);
  }

  async updateItemQuantity(tableId: string, itemId: string, quantity: number) {
    if (quantity <= 0) {
      return this.removeItem(tableId, itemId);
    }

    const cart = await this.prisma.sharedCart.findUnique({
      where: { tableId },
    });

    if (!cart) {
      throw new Error(`Cart not found for table ${tableId}`);
    }

    await this.prisma.sharedCartItem.update({
      where: { id: itemId },
      data: { quantity },
    });

    const updatedCart = await this.recalculateTotals(tableId);
    await this.publishCartUpdate(tableId, updatedCart);
    return this.mapCart(updatedCart);
  }

  async removeItem(tableId: string, itemId: string) {
    const cart = await this.prisma.sharedCart.findUnique({
      where: { tableId },
    });

    if (!cart) {
      throw new Error(`Cart not found for table ${tableId}`);
    }

    await this.prisma.sharedCartItem.delete({
      where: { id: itemId },
    });

    const updatedCart = await this.recalculateTotals(tableId);
    await this.publishCartUpdate(tableId, updatedCart);
    return this.mapCart(updatedCart);
  }

  async clearCart(tableId: string) {
    const cart = await this.prisma.sharedCart.findUnique({
      where: { tableId },
    });

    if (!cart) {
      throw new Error(`Cart not found for table ${tableId}`);
    }

    await this.prisma.sharedCartItem.deleteMany({
      where: { cartId: cart.id },
    });

    await this.prisma.sharedCart.update({
      where: { tableId },
      data: {
        totalAmount: new Decimal(0),
        totalItems: 0,
      },
      include: { items: true },
    });

    const updated = await this.getOrCreateCart(tableId);
    // publish cleared cart
    const cartRow = await this.prisma.sharedCart.findUnique({
      where: { tableId },
      include: { items: true },
    });
    if (cartRow) {
      await this.publishCartUpdate(tableId, cartRow);
    }

    return updated;
  }

  private async recalculateTotals(tableId: string) {
    const cart = await this.prisma.sharedCart.findUnique({
      where: { tableId },
      include: { items: true },
    });

    if (!cart) {
      throw new Error(`Cart not found for table ${tableId}`);
    }

    const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = cart.items.reduce(
      (sum, item) => sum.plus(new Decimal(item.unitPrice).times(item.quantity)),
      new Decimal(0),
    );

    return this.prisma.sharedCart.update({
      where: { id: cart.id },
      data: {
        totalItems,
        totalAmount,
      },
      include: { items: true },
    });
  }

  private async publishCartUpdate(tableId: string, cartRow: any) {
    try {
      const client = this.redis.getClient();
      if (!client) {
        this.logger.error('❌ Redis client is null!');
        return;
      }
      const channel = `cart:${tableId}`;
      const payload = JSON.stringify({ tableId, cart: this.mapCart(cartRow) });
      await client.publish(channel, payload);
      this.logger.log(`✅ Published cart update for ${tableId} to Redis channel: ${channel}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to publish cart update: ${(error as Error).message}`,
      );
    }
  }

  private buildCartItemId(
    productId: string,
    options?: Record<string, any>[] | null,
  ): string {
    if (!options || options.length === 0) return productId;
    const sorted = [...options]
      .map((opt) => ({
        key: opt.id != null ? String(opt.id) : (opt.name || '').trim(),
        price: Number(opt.additionalPrice) || 0,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
    const signature = sorted.map((opt) => `${opt.key}:${opt.price}`).join('|');
    return `${productId}::${signature}`;
  }

  private mapCart(cart: any) {
    return {
      id: cart.id,
      tableId: cart.tableId,
      items: cart.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        baseUnitPrice: Number(item.baseUnitPrice),
        optionsSubtotal: Number(item.optionsSubtotal || 0),
        options: item.options || [],
      })),
      totalItems: cart.totalItems,
      totalAmount: Number(cart.totalAmount),
      updatedAt: cart.updatedAt,
    };
  }
}
