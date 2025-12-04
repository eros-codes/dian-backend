import { PrismaService } from '../../prisma/prisma.service';

function parseNumericSetting(
  raw: unknown,
  fallback: number,
  { allowZero = true, min }: { allowZero?: boolean; min?: number } = {},
): number {
  const numeric = coerceToNumber(raw);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  if (!allowZero && numeric === 0) {
    return fallback;
  }

  if (typeof min === 'number' && numeric < min) {
    return fallback;
  }

  return numeric;
}

/**
 * Ensures there is a tax setting row and returns the multiplier (e.g. 1.1 for 110%).
 */
export async function getTaxMultiplier(
  prisma: PrismaService,
): Promise<{ multiplier: number; raw: number }> {
  const setting = await prisma.footerSetting.upsert({
    where: { key: 'tax' },
    update: {},
    create: { key: 'tax', title: '100', url: null },
  });

  const raw = parseNumericSetting(setting?.title ?? 100, 100, {
    allowZero: true,
    min: 0,
  });
  const multiplier = Number((raw / 100).toFixed(4));
  return { multiplier, raw };
}

export async function getServiceFee(prisma: PrismaService): Promise<number> {
  const setting = await prisma.footerSetting.findUnique({
    where: { key: 'fee' },
  });
  return toMoney(
    parseNumericSetting(setting?.title ?? 0, 0, { allowZero: true, min: 0 }),
  );
}

export function toMoney(value: number): number {
  return Number(Number.isFinite(value) ? value.toFixed(2) : 0);
}

function coerceToNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return Number.NaN;
    }
    const cleaned = trimmed.replace(/[^0-9.-]/g, '');
    return Number(cleaned);
  }

  return Number.NaN;
}
