import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  profileUpdateSchema,
  cryptoPaymentSchema,
  giftCardPaymentSchema,
  cryptoResubmitSchema,
  giftCardResubmitSchema,
  reviewActionSchema,
  packageSchema,
  pastDateSchema,
  checkDobPolicy,
  publicIdentifierSchema
} from '@/lib/validation/schemas';
import { randomUUID } from 'node:crypto';

describe('auth validation', () => {
  it('accepts a valid registration', () => {
    expect(
      registerSchema.safeParse({
        fullName: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'correct horse battery'
      }).success
    ).toBe(true);
  });

  it('rejects bad emails and short passwords', () => {
    expect(
      registerSchema.safeParse({ fullName: 'A L', email: 'nope', password: 'longenoughpassword' })
        .success
    ).toBe(false);
    expect(
      registerSchema.safeParse({ fullName: 'A L', email: 'a@b.co', password: 'short' }).success
    ).toBe(false);
  });
});

describe('dates', () => {
  it('rejects impossible calendar dates', () => {
    expect(pastDateSchema.safeParse('1990-02-30').success).toBe(false);
    expect(pastDateSchema.safeParse('1990-13-01').success).toBe(false);
    expect(pastDateSchema.safeParse('not-a-date').success).toBe(false);
  });

  it('rejects future dates of birth', () => {
    expect(pastDateSchema.safeParse('2999-01-01').success).toBe(false);
  });

  it('accepts a real past date', () => {
    expect(pastDateSchema.safeParse('1990-05-15').success).toBe(true);
  });

  it('enforces the configured minimum age policy server-side', () => {
    const adult = '1990-01-01';
    const child = '2015-01-01';
    expect(checkDobPolicy(adult, { required: true, minimumAge: 18 })).toBeNull();
    expect(checkDobPolicy(child, { required: true, minimumAge: 18 })).toMatch(/18/);
    expect(checkDobPolicy(null, { required: true, minimumAge: 18 })).toMatch(/required/i);
    expect(checkDobPolicy(null, { required: false, minimumAge: 18 })).toBeNull();
  });

  it('rejects DOB outside profile when empty but enforces when given', () => {
    const ok = profileUpdateSchema.safeParse({
      fullName: 'Ada Lovelace',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      region: '',
      postalCode: '',
      country: '',
      dateOfBirth: ''
    });
    expect(ok.success).toBe(true);
  });
});

describe('crypto payment schema', () => {
  const base = {
    orderId: randomUUID(),
    cryptoCurrency: 'USDT',
    network: 'TRC-20',
    expectedAmount: '1000.5',
    txHash: 'a1b2c3d4e5f6a7b8',
    paidAt: '',
    notes: ''
  };

  it('accepts a valid submission', () => {
    expect(cryptoPaymentSchema.safeParse(base).success).toBe(true);
  });

  it('rejects invalid transaction hashes and amounts', () => {
    expect(cryptoPaymentSchema.safeParse({ ...base, txHash: 'bad hash!!' }).success).toBe(false);
    expect(cryptoPaymentSchema.safeParse({ ...base, expectedAmount: '-5' }).success).toBe(false);
    expect(cryptoPaymentSchema.safeParse({ ...base, expectedAmount: '0.000000001' }).success).toBe(false);
  });

  it('STRICT: unexpected fields (e.g. secrets) are rejected', () => {
    expect(
      cryptoPaymentSchema.safeParse({ ...base, privateKey: '0xdeadbeef' }).success
    ).toBe(false);
    expect(
      cryptoPaymentSchema.safeParse({ ...base, seedPhrase: 'witch collapse...' }).success
    ).toBe(false);
  });

  it('rejects future payment timestamps', () => {
    expect(
      cryptoPaymentSchema.safeParse({ ...base, paidAt: '2999-01-01T00:00' }).success
    ).toBe(false);
  });
});

describe('gift card schema', () => {
  const base = {
    orderId: randomUUID(),
    issuer: 'Brand X',
    denomination: '1000.00',
    currency: 'USD',
    purchaseReference: 'RCP-9911',
    notes: ''
  };

  it('accepts a valid submission', () => {
    expect(giftCardPaymentSchema.safeParse(base).success).toBe(true);
  });

  it('NEVER accepts PIN / redemption / claim code fields (strict schema)', () => {
    for (const secretField of ['pin', 'cardPin', 'redemptionCode', 'claimCode', 'cardNumber']) {
      expect(
        giftCardPaymentSchema.safeParse({ ...base, [secretField]: '1234' }).success,
        `field ${secretField} must be rejected`
      ).toBe(false);
    }
  });

  it('requires issuer and a valid currency', () => {
    expect(giftCardPaymentSchema.safeParse({ ...base, issuer: '' }).success).toBe(false);
    expect(giftCardPaymentSchema.safeParse({ ...base, currency: 'usd1' }).success).toBe(false);
  });
});

describe('resubmission schemas', () => {
  it('crypto resubmission requires a payment id, not an order id', () => {
    const payload = {
      paymentId: randomUUID(),
      cryptoCurrency: 'USDT',
      network: 'TRC-20',
      expectedAmount: '1000.5',
      txHash: 'a1b2c3d4e5f6a7b8',
      paidAt: '',
      notes: ''
    };
    expect(cryptoResubmitSchema.safeParse(payload).success).toBe(true);
    expect(cryptoResubmitSchema.safeParse({ ...payload, paymentId: 'nope' }).success).toBe(false);
    // still strict — secrets cannot ride along
    expect(
      cryptoResubmitSchema.safeParse({ ...payload, seedPhrase: 'witch collapse...' }).success
    ).toBe(false);
  });

  it('gift-card resubmission keeps the PIN/code prohibition (strict + screening)', () => {
    const payload = {
      paymentId: randomUUID(),
      issuer: 'Brand X',
      denomination: '1000.00',
      currency: 'USD',
      purchaseReference: 'RCP-9911',
      notes: ''
    };
    expect(giftCardResubmitSchema.safeParse(payload).success).toBe(true);
    for (const secretField of ['pin', 'cardNumber', 'redemptionCode', 'claimCode']) {
      expect(
        giftCardResubmitSchema.safeParse({ ...payload, [secretField]: '1234' }).success
      ).toBe(false);
    }
  });
});

describe('admin review schema', () => {
  it('requires valid actions and ids', () => {
    expect(
      reviewActionSchema.safeParse({ paymentId: randomUUID(), action: 'approve', reason: '' })
        .success
    ).toBe(true);
    expect(
      reviewActionSchema.safeParse({ paymentId: 'nope', action: 'approve' }).success
    ).toBe(false);
    expect(
      reviewActionSchema.safeParse({ paymentId: randomUUID(), action: 'self_approve' }).success
    ).toBe(false);
  });
});

describe('package schema', () => {
  it('parses benefits from lines and coerces order', () => {
    const parsed = packageSchema.safeParse({
      id: '',
      slug: 'signature',
      name: 'Signature',
      description: '',
      price: '1000.00',
      currency: 'USD',
      displayOrder: '1',
      isPublished: 'true',
      durationMonths: '12',
      benefits: 'One benefit\n\nSecond benefit',
      terms: ''
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.benefits).toEqual(['One benefit', 'Second benefit']);
      expect(parsed.data.displayOrder).toBe(1);
      expect(parsed.data.durationMonths).toBe(12);
    }
  });

  it('rejects negative prices and bad slugs', () => {
    expect(
      packageSchema.safeParse({
        id: '',
        slug: 'Bad Slug',
        name: 'X',
        description: '',
        price: '-100',
        currency: 'USD',
        displayOrder: 1,
        isPublished: true,
        durationMonths: '',
        benefits: '',
        terms: ''
      }).success
    ).toBe(false);
  });
});

describe('verification identifiers', () => {
  it('only accepts 32-char hex public identifiers', () => {
    expect(publicIdentifierSchema.safeParse('9f4c2b8a1d3e4f5a6b7c8d9e0f1a2b3c').success).toBe(true);
    expect(publicIdentifierSchema.safeParse('short').success).toBe(false);
    expect(
      publicIdentifierSchema.safeParse('zz4c2b8a1d3e4f5a6b7c8d9e0f1a2b3c').success
    ).toBe(false);
  });
});
