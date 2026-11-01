import { goodBySku, logisticsAccount, stallById } from "./catalog";

export const PLATFORM_RATE = 0.04;
export const LOGISTICS_RATE = 0.08;

export type CartItem = { sku: string; qty: number };

export type QuoteLine = {
  sku: string;
  name: string;
  stallId: string;
  stallName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

export type SplitDraft = {
  split_name: string;
  split_type: "flat";
  split_value: number;
  role: "stall" | "logistics";
  bank_code: string;
  account_number: string;
  account_name: string;
};

export type Quote = {
  lines: QuoteLine[];
  subtotal: number;
  platform: number;
  logistics: number;
  stalls: { stallId: string; name: string; goods: number; settlement: number }[];
  splits: SplitDraft[];
};

export function naira(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Amounts are whole naira. Novac examples use major units (20000 = ₦20,000).
 * Confirm against a live ₦100 charge before trusting this in production.
 * Platform remainder stays on the primary settlement account and is not a split row.
 */
export function quoteCart(items: CartItem[]): Quote {
  const lines: QuoteLine[] = [];
  for (const item of items) {
    if (item.qty <= 0) continue;
    const good = goodBySku(item.sku);
    const stall = good ? stallById(good.stallId) : undefined;
    if (!good || !stall) continue;
    lines.push({
      sku: good.sku,
      name: good.name,
      stallId: stall.id,
      stallName: stall.name,
      qty: item.qty,
      unitPrice: good.price,
      lineTotal: good.price * item.qty,
    });
  }

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const platform = Math.round(subtotal * PLATFORM_RATE);
  const logistics = Math.round(subtotal * LOGISTICS_RATE);
  const vendorPool = Math.max(0, subtotal - platform - logistics);

  const goodsByStall = new Map<string, { name: string; goods: number }>();
  for (const line of lines) {
    const current = goodsByStall.get(line.stallId) ?? { name: line.stallName, goods: 0 };
    current.goods += line.lineTotal;
    goodsByStall.set(line.stallId, current);
  }

  const stallIds = [...goodsByStall.keys()];
  let assigned = 0;
  const stalls = stallIds.map((stallId, index) => {
    const entry = goodsByStall.get(stallId)!;
    const settlement =
      index === stallIds.length - 1
        ? vendorPool - assigned
        : subtotal === 0
          ? 0
          : Math.round((vendorPool * entry.goods) / subtotal);
    assigned += settlement;
    return { stallId, name: entry.name, goods: entry.goods, settlement };
  });

  const splits: SplitDraft[] = [];
  for (const stallQuote of stalls) {
    const stall = stallById(stallQuote.stallId);
    if (!stall || stallQuote.settlement <= 0) continue;
    splits.push({
      split_name: stall.id,
      split_type: "flat",
      split_value: stallQuote.settlement,
      role: "stall",
      bank_code: stall.bankCode,
      account_number: stall.accountNumber,
      account_name: stall.accountName,
    });
  }
  if (logistics > 0) {
    splits.push({
      split_name: logisticsAccount.splitName,
      split_type: "flat",
      split_value: logistics,
      role: "logistics",
      bank_code: logisticsAccount.bankCode,
      account_number: logisticsAccount.accountNumber,
      account_name: logisticsAccount.accountName,
    });
  }

  return { lines, subtotal, platform, logistics, stalls, splits };
}
