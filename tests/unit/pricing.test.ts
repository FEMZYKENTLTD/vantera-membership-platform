import { describe, it, expect } from 'vitest';
import {
  toMinorUnits,
  fromMinorUnits,
  computeOrderAmount,
  isValidCryptoAmount
} from '@/lib/payments/pricing';

describe('money', () => {
  it('parses decimal strings to integer minor units without floats', () => {
    expect(toMinorUnits('1000')).toBe(100000);
    expect(toMinorUnits('1000.00')).toBe(100000);
    expect(toMinorUnits('999.99')).toBe(99999);
    expect(toMinorUnits('0.01')).toBe(1);
    expect(toMinorUnits('20000.00')).toBe(2000000);
  });

  it('rejects junk and negative-free invariants', () => {
    expect(() => toMinorUnits('abc')).toThrow();
    expect(() => toMinorUnits('10.005')).toThrow();
    expect(() => toMinorUnits('')).toThrow();
    expect(() => toMinorUnits('1,000')).toThrow();
  });

  it('formats back to 2-decimal strings exactly', () => {
    expect(fromMinorUnits(100000)).toBe('1000.00');
    expect(fromMinorUnits(1)).toBe('0.01');
    expect(fromMinorUnits(99999)).toBe('999.99');
  });

  it('round-trips without precision loss (classic 0.1+0.2 trap)', () => {
    // With floats this would be 30000000000000004-style errors; integers are exact.
    const a = toMinorUnits('0.10');
    const b = toMinorUnits('0.20');
    expect(fromMinorUnits(a + b)).toBe('0.30');
  });

  it('computes order amounts from the server tier, quantity 1', () => {
    const amount = computeOrderAmount({ price: '5000.00', currency: 'USD' });
    expect(amount).toEqual({ unitPrice: '5000.00', totalPrice: '5000.00', currency: 'USD' });
  });

  it('rejects bad quantities, currencies and negative prices', () => {
    expect(() => computeOrderAmount({ price: '1', currency: 'USD' }, 0)).toThrow();
    expect(() => computeOrderAmount({ price: '1', currency: 'usd' })).toThrow();
    expect(() => computeOrderAmount({ price: '-5', currency: 'USD' })).toThrow();
  });

  it('validates crypto amounts (max 8 decimals, positive)', () => {
    expect(isValidCryptoAmount('0.05250000')).toBe(true);
    expect(isValidCryptoAmount('1')).toBe(true);
    expect(isValidCryptoAmount('0')).toBe(false);
    expect(isValidCryptoAmount('0.000000001')).toBe(false);
    expect(isValidCryptoAmount('-1')).toBe(false);
    expect(isValidCryptoAmount('abc')).toBe(false);
  });
});
