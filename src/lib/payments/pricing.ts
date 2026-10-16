/**
 * Money helpers. Amounts cross the Postgres boundary as strings (numeric);
 * we convert to integer minor units (cents) with PURE STRING PARSING and do
 * all arithmetic on integers — no binary floating point is ever involved.
 */

/** Parse a decimal string/number to integer minor units. Throws on junk. */
export function toMinorUnits(amount: string | number): number {
  const s = String(amount).trim();
  const m = /^(-?\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) throw new Error(`Invalid money amount: ${s}`);
  const whole = Number(m[1]);
  const frac = (m[2] ?? '').padEnd(2, '0');
  const cents = whole * 100 + (whole < 0 ? -1 : 1) * Number(frac || '0');
  if (!Number.isSafeInteger(cents)) throw new Error(`Amount out of range: ${s}`);
  return cents;
}

/** Integer minor units back to a fixed 2-decimal major-unit string. */
export function fromMinorUnits(minor: number): string {
  if (!Number.isSafeInteger(minor)) throw new Error('minor units out of range');
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${whole}.${frac}`;
}

export interface OrderAmount {
  unitPrice: string; // e.g. "1000.00"
  totalPrice: string;
  currency: string;
}

/**
 * Authoritative order pricing: computed on the server from the configured
 * tier row only. Any amount supplied by the client is ignored.
 */
export function computeOrderAmount(
  tier: { price: number | string; currency: string },
  quantity = 1
): OrderAmount {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    throw new Error('Invalid quantity');
  }
  if (!/^[A-Z]{3}$/.test(tier.currency)) {
    throw new Error('Invalid currency code');
  }
  const unitMinor = toMinorUnits(tier.price);
  if (unitMinor < 0) throw new Error('Price may not be negative');
  return {
    unitPrice: fromMinorUnits(unitMinor),
    totalPrice: fromMinorUnits(unitMinor * quantity),
    currency: tier.currency
  };
}

/** Validate a crypto expected amount: positive, max 8 decimal places. */
export function isValidCryptoAmount(amount: string): boolean {
  const s = amount.trim();
  const m = /^(\d+)(?:\.(\d{1,8}))?$/.exec(s);
  if (!m) return false;
  if (m[1].length > 18) return false;
  return Number(`${m[1]}.${m[2] ?? '0'}`) > 0;
}
