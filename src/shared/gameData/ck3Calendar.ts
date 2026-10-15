import { parseLegacyCk3DisplayDate, type Ck3GameDate } from './gameDate.js';

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * CK3's numeric calendar includes year zero and uses 365-day years.
 * Verified tuples from the game log: 1066.11.21 = 389415 and
 * 1067.2.12 = 389498. Generic Gregorian ordinals do not share this epoch.
 */
export function ck3DateFromTotalDays(totalDays: number): { year: number; month: number; day: number } {
    if (!Number.isSafeInteger(totalDays) || totalDays < 1) throw new RangeError('Invalid CK3 total days');
    const year = Math.max(1, Math.floor((totalDays - 1) / 365));
    let day = (totalDays - 1) % 365 + 1;
    let month = 1;
    while (day > MONTH_DAYS[month - 1]) {
        day -= MONTH_DAYS[month - 1];
        month++;
    }
    return { year, month, day };
}

/** Adapt undated legacy display-only sources into the same CK3 ordering. */
export function parseCk3CalendarDate(display: string): Ck3GameDate | undefined {
    const parsed = parseLegacyCk3DisplayDate(display);
    if (!parsed || parsed.day > MONTH_DAYS[parsed.month - 1]) return undefined;
    return {
        ...parsed,
        totalDays: parsed.year * 365 + MONTH_DAYS.slice(0, parsed.month - 1).reduce((sum, days) => sum + days, 0) + parsed.day
    };
}
