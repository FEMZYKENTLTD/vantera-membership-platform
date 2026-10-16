/**
 * Business-day arithmetic for the 1–3 working-day payment verification SLA.
 * Weekends never count. Configured public holidays (YYYY-MM-DD) are excluded.
 */

export function toISODate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isWeekendUTC(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

export function isBusinessDay(d: Date, holidays: ReadonlySet<string> = new Set()): boolean {
  return !isWeekendUTC(d) && !holidays.has(toISODate(d));
}

/**
 * Add `days` business days to a date. The start day itself never counts;
 * the deadline of "N working days from submission" is N business days later
 * at the same UTC time.
 */
export function addBusinessDays(
  start: Date,
  days: number,
  holidays: ReadonlySet<string> = new Set()
): Date {
  if (!Number.isInteger(days) || days < 0) {
    throw new Error('days must be a non-negative integer');
  }
  const result = new Date(start.getTime());
  let remaining = days;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (isBusinessDay(result, holidays)) remaining -= 1;
  }
  return result;
}

/**
 * Count business days elapsed from `start` up to `now` (exclusive of the
 * start day, inclusive of `now` when it is a business day). Never negative.
 */
export function businessDaysElapsed(
  start: Date,
  now: Date,
  holidays: ReadonlySet<string> = new Set()
): number {
  if (now <= start) return 0;
  let count = 0;
  const cursor = new Date(start.getTime());
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(now.getTime());
  end.setUTCHours(0, 0, 0, 0);
  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isBusinessDay(cursor, holidays)) count += 1;
  }
  return count;
}

export interface VerificationEstimate {
  /** e.g. "1–3 working days" */
  label: string;
  /** Latest expected verification date given the configured SLA. */
  dueBy: Date;
  /** Business days elapsed since submission (0 on the submission day). */
  elapsedBusinessDays: number;
  overdue: boolean;
}

export function verificationEstimate(
  submittedAt: Date,
  workingDays: number,
  holidays: ReadonlySet<string> = new Set(),
  now: Date = new Date()
): VerificationEstimate {
  const dueBy = addBusinessDays(submittedAt, workingDays, holidays);
  const elapsed = businessDaysElapsed(submittedAt, now, holidays);
  return {
    label: workingDays <= 1 ? '1 working day' : `1–${workingDays} working days`,
    dueBy,
    elapsedBusinessDays: elapsed,
    overdue: now > dueBy
  };
}
