// Pure helpers for report date ranges (no Firebase, testable).
import { parseSafeDate } from './dateHelper';

export function toRangeIso(startDate: string, endDate: string): { fromIso: string | null; toIso: string | null } {
  const fromIso = startDate ? new Date(`${startDate}T00:00:00`).toISOString() : null;
  const toIso = endDate ? new Date(`${endDate}T23:59:59.999`).toISOString() : null;
  return { fromIso, toIso };
}

export function liveCoversRange(liveDates: string[], limitCount: number, fromIso: string | null): boolean {
  if (liveDates.length < limitCount) return true;
  if (!fromIso) return false;
  let oldest = Infinity;
  for (const d of liveDates) {
    const t = parseSafeDate(d).getTime();
    if (!isNaN(t) && t < oldest) oldest = t;
  }
  return oldest !== Infinity && oldest <= new Date(fromIso).getTime();
}
