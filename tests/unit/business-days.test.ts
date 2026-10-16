import { describe, it, expect } from 'vitest';
import {
  addBusinessDays,
  businessDaysElapsed,
  verificationEstimate,
  isBusinessDay
} from '@/lib/business-days';

describe('business-days', () => {
  // 2026-10-16 is a Friday (UTC).
  const friday = new Date('2026-10-16T10:00:00Z');
  const saturday = new Date('2026-10-17T10:00:00Z');
  const sunday = new Date('2026-10-18T10:00:00Z');
  const monday = new Date('2026-10-19T10:00:00Z');

  it('weekends are never business days', () => {
    expect(isBusinessDay(friday)).toBe(true);
    expect(isBusinessDay(saturday)).toBe(false);
    expect(isBusinessDay(sunday)).toBe(false);
    expect(isBusinessDay(monday)).toBe(true);
  });

  it('adds business days skipping weekends (1–3 working days from Friday)', () => {
    const one = addBusinessDays(friday, 1);
    expect(one.toISOString()).toBe(monday.toISOString());

    const three = addBusinessDays(friday, 3);
    expect(three.toISOString()).toBe(new Date('2026-10-21T10:00:00Z').toISOString());
  });

  it('submission on a weekend lands deadlines on weekdays', () => {
    const due = addBusinessDays(sunday, 1);
    expect(due.getUTCDay()).toBe(1); // Monday
  });

  it('excludes configured public holidays', () => {
    const holidays = new Set(['2026-10-19']); // Monday is a holiday
    const due = addBusinessDays(friday, 1, holidays);
    expect(due.toISOString()).toBe(new Date('2026-10-20T10:00:00Z').toISOString());
  });

  it('counts zero elapsed business days on the submission day', () => {
    expect(businessDaysElapsed(friday, new Date('2026-10-16T18:00:00Z'))).toBe(0);
    expect(businessDaysElapsed(friday, monday)).toBe(1);
    expect(businessDaysElapsed(friday, new Date('2026-10-21T10:00:00Z'))).toBe(3);
  });

  it('verification estimate reports overdue correctly', () => {
    const onTime = verificationEstimate(friday, 3, new Set(), new Date('2026-10-20T10:00:00Z'));
    expect(onTime.overdue).toBe(false);
    expect(onTime.label).toBe('1–3 working days');

    const late = verificationEstimate(friday, 3, new Set(), new Date('2026-10-22T10:00:00Z'));
    expect(late.overdue).toBe(true);
  });

  it('rejects invalid day counts', () => {
    expect(() => addBusinessDays(friday, -1)).toThrow();
    expect(() => addBusinessDays(friday, 1.5)).toThrow();
  });
});
