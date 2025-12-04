import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface ProductSummary {
  id: string;
  name: string;
}

export interface SalesSummaryItem {
  productId: string;
  soldQuantity: number;
  baseRevenue: number;
  totalRevenue: number;
  totalTax: number;
  product: ProductSummary | null;
  options: string[];
}

export interface ClearResetsResult {
  deletedCount: number;
  summary: SalesSummaryItem[];
}

interface DateRange {
  from: Date;
  to: Date;
}

export interface MonthlyMetrics {
  period: {
    current: DateRange;
    previous: DateRange;
  };
  orders: {
    current: number;
    previous: number;
  };
  revenue: {
    current: number;
    previous: number;
  };
  returns: {
    current: number;
    previous: number;
  };
}

type OrderItemGroupWithSum = {
  productId: string;
  _sum: {
    quantity: number | null;
    totalPrice: Prisma.Decimal | number | null;
    taxAmount: Prisma.Decimal | number | null;
  };
};

type OrderItemOptionRow = {
  productId: string;
  optionsJson: Prisma.JsonValue | null;
};

const toNumber = (
  value: Prisma.Decimal | number | null | undefined,
): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  return Number(value);
};

const parseOptionNames = (raw: Prisma.JsonValue | null): string[] => {
  if (raw === null || raw === undefined) {
    return [];
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as Prisma.JsonValue;
      return parseOptionNames(parsed);
    } catch {
      return [];
    }
  }

  if (Array.isArray(raw)) {
    return raw
      .map((option) => {
        if (typeof option === 'string') {
          return option;
        }
        if (
          option &&
          typeof option === 'object' &&
          'name' in option &&
          typeof (option as Record<string, unknown>).name === 'string'
        ) {
          return String((option as Record<string, unknown>).name);
        }
        return null;
      })
      .filter(
        (name): name is string => typeof name === 'string' && name.length > 0,
      );
  }

  if (typeof raw === 'object' && raw !== null) {
    const maybeOptions = (raw as Record<string, unknown>).options;
    if (Array.isArray(maybeOptions)) {
      return parseOptionNames(maybeOptions as Prisma.JsonValue);
    }
  }

  return [];
};

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesSummary(
    adminId: string,
    from?: Date,
    to?: Date,
  ): Promise<SalesSummaryItem[]> {
    let usedSnapshot = false;
    let lastSnapshotResetAt: Date | undefined;

    if (!from || !to) {
      const lastSnapshot = await this.prisma.salesSnapshot.findFirst({
        where: { adminId },
        orderBy: { resetAt: 'desc' },
      });

      if (lastSnapshot) {
        from = from ?? lastSnapshot.resetAt;
        to = to ?? new Date();
        usedSnapshot = true;
        lastSnapshotResetAt = lastSnapshot.resetAt;
      }
    }

    const orderFilter: Prisma.OrderWhereInput = {
      status: { in: ['PAID'] },
    };

    if (from || to) {
      orderFilter.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    const whereClause: Prisma.OrderItemWhereInput = {
      order: orderFilter,
    };

    const groupByResult = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: {
        quantity: true,
        totalPrice: true,
        taxAmount: true,
      },
      where: whereClause,
    });

    if (usedSnapshot && groupByResult.length === 0) {
      console.debug(
        '[SalesService] getSalesSummary - snapshot used and no rows after reset',
        { adminId, resetAt: lastSnapshotResetAt },
      );
      return [];
    }

    const productIds = groupByResult.map((group) => group.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
      },
    });
    const productById = new Map<string, ProductSummary>(
      products.map((product) => [product.id, product]),
    );

    console.debug('[SalesService] getSalesSummary', {
      adminId,
      usedSnapshot,
      resultCount: groupByResult.length,
      productIds,
    });

    const optionRows: OrderItemOptionRow[] =
      await this.prisma.orderItem.findMany({
        where: whereClause,
        select: {
          productId: true,
          optionsJson: true,
        },
      });

    // Map productId -> Map<optionName, count>
    const optionCountMap = new Map<string, Map<string, number>>();
    for (const row of optionRows) {
      const optionNames = parseOptionNames(row.optionsJson);
      if (optionNames.length === 0) continue;
      let productMap = optionCountMap.get(row.productId);
      if (!productMap) {
        productMap = new Map<string, number>();
        optionCountMap.set(row.productId, productMap);
      }
      for (const name of optionNames) {
        const prev = productMap.get(name) ?? 0;
        productMap.set(name, prev + 1);
      }
    }

    const mapped: SalesSummaryItem[] = (
      groupByResult as OrderItemGroupWithSum[]
    ).map((group) => {
      const optsMap = optionCountMap.get(group.productId) ?? new Map<string, number>();
      const options = Array.from(optsMap.entries()).map(([name, cnt]) => `${name} x${cnt}`);
      const quantity = toNumber(group._sum.quantity);
      const baseRevenue = toNumber(group._sum.totalPrice);
      const totalTax = toNumber(group._sum.taxAmount);
      const totalRevenue = baseRevenue + totalTax;

      return {
        productId: group.productId,
        soldQuantity: quantity,
        baseRevenue,
        totalRevenue,
        totalTax,
        product: productById.get(group.productId) ?? null,
        options,
      };
    });

    return mapped;
  }

  async resetSales(adminId: string) {
    return this.prisma.salesSnapshot.create({
      data: { adminId, resetAt: new Date() },
    });
  }

  async clearResets(adminId: string): Promise<ClearResetsResult> {
    const deleted = await this.prisma.salesSnapshot.deleteMany({
      where: { adminId },
    });
    const summary = await this.getSalesSummary(adminId);
    return { deletedCount: deleted.count, summary };
  }

  /**
   * Monthly metrics for dashboard: orders count, revenue sum, returns count.
   * Compares current month vs previous month using createdAt ranges.
   */
  async getMonthlyMetrics(): Promise<MonthlyMetrics> {
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPreviousMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
    );
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [ordersCurrent, ordersPrevious] = await Promise.all([
      this.prisma.order.count({
        where: {
          createdAt: { gte: startOfCurrentMonth, lt: startOfNextMonth },
        },
      }),
      this.prisma.order.count({
        where: {
          createdAt: { gte: startOfPreviousMonth, lt: startOfCurrentMonth },
        },
      }),
    ]);

    const [revenueCurrentAggregate, revenuePreviousAggregate] =
      await Promise.all([
        this.prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: {
            createdAt: { gte: startOfCurrentMonth, lt: startOfNextMonth },
          },
        }),
        this.prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: {
            createdAt: { gte: startOfPreviousMonth, lt: startOfCurrentMonth },
          },
        }),
      ]);

    const revenueCurrent = toNumber(revenueCurrentAggregate._sum.totalAmount);
    const revenuePrevious = toNumber(revenuePreviousAggregate._sum.totalAmount);

    const returnsCurrent = 0;
    const returnsPrevious = 0;

    return {
      period: {
        current: { from: startOfCurrentMonth, to: startOfNextMonth },
        previous: { from: startOfPreviousMonth, to: startOfCurrentMonth },
      },
      orders: { current: ordersCurrent, previous: ordersPrevious },
      revenue: { current: revenueCurrent, previous: revenuePrevious },
      returns: { current: returnsCurrent, previous: returnsPrevious },
    };
  }
}
