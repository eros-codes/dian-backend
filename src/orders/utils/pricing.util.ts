import { PrismaService } from '../../prisma/prisma.service';
import {
  getServiceFee,
  getTaxMultiplier,
  toMoney,
} from '../../common/utils/tax.util';

export type RawOrderItemInput = {
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
};

export type EnrichedOrderItem = RawOrderItemInput & {
  unitPrice: number;
  totalPrice: number;
  unitPriceFinal: number;
  totalPriceFinal: number;
  taxAmount: number;
};

export type PricingComputation = {
  subtotal: number;
  taxMultiplier: number;
  taxAmount: number;
  serviceFee: number;
  totalAmount: number;
  items: EnrichedOrderItem[];
};

export async function computeOrderPricing(
  prisma: PrismaService,
  items: RawOrderItemInput[],
): Promise<PricingComputation> {
  const normalized: EnrichedOrderItem[] = items.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const baseUnit = toMoney(Number(item.unitPrice) || 0);
    const baseTotal = toMoney(
      item.totalPrice !== undefined
        ? Number(item.totalPrice)
        : baseUnit * quantity,
    );

    return {
      ...item,
      quantity,
      unitPrice: baseUnit,
      totalPrice: baseTotal,
      unitPriceFinal: baseUnit,
      totalPriceFinal: baseTotal,
      taxAmount: 0,
    };
  });

  const subtotal = toMoney(
    normalized.reduce((acc, item) => acc + item.totalPrice, 0),
  );

  const [{ multiplier: taxMultiplier }, serviceFee] = await Promise.all([
    getTaxMultiplier(prisma),
    getServiceFee(prisma),
  ]);

  const taxAmount = toMoney(subtotal * (taxMultiplier - 1));

  const itemsWithFinal = normalized.map((item) => {
    if (subtotal <= 0 || taxMultiplier === 1) {
      return {
        ...item,
        unitPriceFinal: item.unitPrice,
        totalPriceFinal: item.totalPrice,
        taxAmount: 0,
      };
    }

    const share = item.totalPrice / subtotal;
    const itemTax = toMoney(taxAmount * share);
    const totalPriceFinal = toMoney(item.totalPrice + itemTax);
    const unitPriceFinal =
      item.quantity > 0
        ? toMoney(totalPriceFinal / item.quantity)
        : toMoney(item.unitPrice);

    return {
      ...item,
      unitPriceFinal,
      totalPriceFinal,
      taxAmount: itemTax,
    };
  });

  const totalAmount = toMoney(subtotal + taxAmount + serviceFee);

  return {
    subtotal,
    taxMultiplier,
    taxAmount,
    serviceFee,
    totalAmount,
    items: itemsWithFinal,
  };
}
