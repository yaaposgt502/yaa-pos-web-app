// Robust date normalization and timezone helper for Yaa POS (Guatemala UTC-6 and local browser)

/**
 * Safely parses any date value into a valid JavaScript Date.
 * Supports:
 * - JavaScript Date objects
 * - Firestore Timestamps with .toDate()
 * - Firestore Timestamp plain objects: { seconds: number, nanoseconds?: number } or { _seconds: number }
 * - Unix numeric timestamps (both seconds 10-digit and milliseconds 13-digit)
 * - ISO-8601 strings, SQL date-time strings, or slash-separated dates
 */
export function parseSafeDate(val: any): Date {
  if (val === null || val === undefined || val === '') {
    return new Date();
  }

  // Already a Date object
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? new Date() : val;
  }

  // Firestore Timestamp with toDate() method
  if (typeof val === 'object' && typeof val.toDate === 'function') {
    try {
      const d = val.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) return d;
    } catch {}
  }

  // Firestore Timestamp plain representation: { seconds: number } or { _seconds: number }
  if (typeof val === 'object') {
    const sec = typeof val.seconds === 'number' ? val.seconds : (typeof val._seconds === 'number' ? val._seconds : null);
    if (sec !== null) {
      const nano = typeof val.nanoseconds === 'number' ? val.nanoseconds : (typeof val._nanoseconds === 'number' ? val._nanoseconds : 0);
      return new Date(sec * 1000 + Math.floor(nano / 1000000));
    }
  }

  // Numeric timestamp (seconds or milliseconds)
  if (typeof val === 'number') {
    if (isNaN(val)) return new Date();
    // 10 digits = seconds (< 10000000000); 13 digits = milliseconds
    return new Date(val < 10000000000 ? val * 1000 : val);
  }

  // String parsing
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return new Date();

    // Pure date string "YYYY-MM-DD" or midnight string: construct with local noon to prevent UTC negative-offset day shifting
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-').map(Number);
      return new Date(y, m - 1, d, 12, 0, 0);
    }
    if (/^\d{4}-\d{2}-\d{2}T00:00:00/.test(trimmed)) {
      const [y, m, d] = trimmed.slice(0, 10).split('-').map(Number);
      return new Date(y, m - 1, d, 12, 0, 0);
    }

    // Standard ISO parse
    const isoDate = new Date(trimmed);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }

    // Try space replacement: "2026-10-22 14:30:00" -> "2026-10-22T14:30:00"
    if (trimmed.includes(' ') && !trimmed.includes('T')) {
      const withT = new Date(trimmed.replace(' ', 'T'));
      if (!isNaN(withT.getTime())) {
        return withT;
      }
    }

    // Try slash format: "DD/MM/YYYY" or "YYYY/MM/DD"
    if (trimmed.includes('/')) {
      const parts = trimmed.split(/[\/\s:]+/);
      if (parts.length >= 3) {
        // If year is first: YYYY/MM/DD
        if (parts[0].length === 4) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          const d = parseInt(parts[2], 10);
          return new Date(y, m, d, 12, 0, 0);
        }
        // If day is first: DD/MM/YYYY
        if (parts[2].length === 4) {
          const d = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          const y = parseInt(parts[2], 10);
          return new Date(y, m, d, 12, 0, 0);
        }
      }
    }
  }

  return new Date();
}

/**
 * Returns today's date formatted as "YYYY-MM-DD" in local time.
 * Never uses toISOString() which shifts to UTC and causes day-ahead errors in UTC-6.
 */
export function getTodayDateString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns a guaranteed "YYYY-MM-DD" string in the user's local / Guatemala timezone.
 * Never returns "NaN-NaN-NaN" and never loses a day when parsing date strings.
 */
export function toLocalDateString(val?: any): string {
  if (!val) {
    return getTodayDateString();
  }

  // If already a YYYY-MM-DD string, return it directly to avoid timezone distortion
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    if (/^\d{4}-\d{2}-\d{2}T00:00:00/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
  }

  const d = parseSafeDate(val);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Checks if a date representation belongs to today (local browser or Guatemala UTC-6).
 */
export function isToday(val: any): boolean {
  if (!val) return false;
  const todayStr = getTodayDateString();
  const itemDateStr = toLocalDateString(val);
  if (itemDateStr === todayStr) return true;

  // Also check America/Guatemala timezone in case system clock / browser offset differs
  try {
    const d = parseSafeDate(val);
    const now = new Date();
    const guatToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(now);
    const guatItem = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(d);
    if (guatToday === guatItem) return true;
  } catch {}

  return isSameCalendarDay(val, new Date());
}

/**
 * Checks if a date falls between startDate and endDate (inclusive, comparing YYYY-MM-DD strings).
 * Protects against timezone roll-overs between UTC and local time.
 */
export function isDateInRange(val: any, startDate?: string, endDate?: string): boolean {
  if (!startDate && !endDate) return true;

  const todayStr = getTodayDateString();
  // If user is filtering strictly for "Hoy"
  if (startDate === todayStr && (!endDate || endDate === todayStr)) {
    if (isToday(val)) return true;
  }

  const itemDateStr = toLocalDateString(val);

  // Check Guatemala timezone date string as well
  let guatItemDateStr: string | null = null;
  try {
    const d = parseSafeDate(val);
    guatItemDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(d);
  } catch {}

  const inLocalRange = (!startDate || itemDateStr >= startDate) && (!endDate || itemDateStr <= endDate);
  const inGuatRange = guatItemDateStr 
    ? ((!startDate || guatItemDateStr >= startDate) && (!endDate || guatItemDateStr <= endDate))
    : false;

  return inLocalRange || inGuatRange;
}

/**
 * Checks if two date representations fall on the exact same calendar day.
 */
export function isSameCalendarDay(valA: any, valB: any): boolean {
  return toLocalDateString(valA) === toLocalDateString(valB);
}

/**
 * Formats date and time cleanly: "DD/MM/YYYY HH:mm"
 */
export function formatDisplayDateTime(val: any): string {
  const d = parseSafeDate(val);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Formats time only: "HH:mm a"
 */
export function formatDisplayTime(val: any): string {
  const d = parseSafeDate(val);
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
}
