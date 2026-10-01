/**
 * Unified CK3 numeric date model.
 *
 * CK3 exposes numeric dates through `Date.GetDateAsTotalDays`, `GetYear`,
 * `GetMonthOfYear`, `GetDayOfMonth` and `GetStringShort`. This module treats
 * `totalDays` as the authoritative ordering value and only validates that the
 * calendar fields form a legal date. It does not require `totalDays` to match a
 * locally computed epoch, so real CK3 output is accepted even if the internal
 * day-count origin differs from the one used for legacy display conversion.
 */

export interface Ck3GameDate {
    totalDays: number;
    year: number;
    month: number;
    day: number;
    display: string;
}

export type Ck3GameDateValidationResult =
    | { readonly valid: true }
    | { readonly valid: false; readonly reason: string };

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Returns whether a year is a leap year under the Gregorian calendar rules
 * used by CK3.
 */
function isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the number of days in the given month (1-12).
 */
function daysInMonth(year: number, month: number): number {
    if (month === 2) {
        return isLeapYear(year) ? 29 : 28;
    }
    return MONTH_DAYS[month - 1];
}

function isPositiveInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * Validates that the numeric date fields are legal and that `display` is a
 * string. `totalDays` is checked for being a positive integer only; it is not
 * recomputed from `year/month/day` so that real CK3 output is accepted verbatim.
 */
export function validateCk3GameDate(date: unknown): Ck3GameDateValidationResult {
    if (typeof date !== 'object' || date === null) {
        return { valid: false, reason: 'date is not an object' };
    }

    const d = date as Partial<Ck3GameDate>;

    if (!isPositiveInteger(d.totalDays)) {
        return { valid: false, reason: 'totalDays must be a positive integer' };
    }
    if (!isPositiveInteger(d.year)) {
        return { valid: false, reason: 'year must be a positive integer' };
    }
    if (!isPositiveInteger(d.month) || d.month < 1 || d.month > 12) {
        return { valid: false, reason: 'month must be an integer between 1 and 12' };
    }
    if (!isPositiveInteger(d.day) || d.day < 1 || d.day > daysInMonth(d.year, d.month)) {
        return { valid: false, reason: 'day is out of range for the given year and month' };
    }
    if (typeof d.display !== 'string') {
        return { valid: false, reason: 'display must be a string' };
    }

    return { valid: true };
}

/**
 * Compares two CK3 game dates by their `totalDays`.
 * Returns a negative number if `a` is earlier, zero if equal, positive if later.
 */
export function compareCk3GameDate(a: Ck3GameDate, b: Ck3GameDate): number {
    return a.totalDays - b.totalDays;
}

/**
 * Checks whether `day` falls in the half-open interval `(start, end]`
 * (start exclusive, end inclusive).
 */
export function isDayInOpenClosedPeriod(
    day: Ck3GameDate,
    start: Ck3GameDate,
    end: Ck3GameDate
): boolean {
    return day.totalDays > start.totalDays && day.totalDays <= end.totalDays;
}

/**
 * Parses legacy display dates produced by `Date.GetStringShort`.
 * Supports the numeric form `YYYY.M.D` used in English and Simplified Chinese,
 * as well as `YYYY年M月D日` for Chinese localized output.
 * Returns `undefined` when the string cannot be parsed or the date is illegal.
 */
export function parseLegacyCk3DisplayDate(display: string): Ck3GameDate | undefined {
    const trimmed = (display ?? '').trim();
    if (!trimmed) return undefined;

    // Numeric form: "1066.1.1" (also covers padded variants like "1066.01.01")
    const numericMatch = trimmed.match(/^(\d{1,4})\.(\d{1,2})\.(\d{1,2})$/);
    // Chinese form: "1066年1月1日"
    const chineseMatch = !numericMatch
        ? trimmed.match(/^(\d{1,4})年(\d{1,2})月(\d{1,2})日$/)
        : null;

    const match = numericMatch ?? chineseMatch;
    if (!match) return undefined;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
        return undefined;
    }

    return {
        totalDays: dateToTotalDays(year, month, day),
        year,
        month,
        day,
        display: trimmed
    };
}

/**
 * Formats a CK3 game date as `YYYY.M.D`, matching the form emitted by
 * `Date.GetStringShort` in English and Simplified Chinese.
 */
export function formatCk3GameDate(date: Ck3GameDate): string {
    return `${date.year}.${date.month}.${date.day}`;
}

export function totalDaysToDate(totalDays: number): { year: number; month: number; day: number } {
    let remaining = totalDays;
    let year = 1;
    while (remaining > (isLeapYear(year) ? 366 : 365)) {
        remaining -= isLeapYear(year) ? 366 : 365;
        year++;
    }
    let month = 1;
    while (remaining > daysInMonth(year, month)) {
        remaining -= daysInMonth(year, month);
        month++;
    }
    return { year, month, day: remaining };
}

/**
 * Converts a proleptic Gregorian calendar date to a day count with
 * `1.1.1 = day 1`. This is used only for legacy display conversion and for
 * producing deterministic ordering values when `totalDays` is unavailable.
 */
function dateToTotalDays(year: number, month: number, day: number): number {
    let days = 0;
    for (let y = 1; y < year; y++) {
        days += isLeapYear(y) ? 366 : 365;
    }
    for (let m = 1; m < month; m++) {
        days += daysInMonth(year, m);
    }
    days += day;
    return days;
}
