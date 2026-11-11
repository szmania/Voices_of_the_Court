import { ck3DateFromTotalDays, parseCk3CalendarDate } from '../../src/shared/gameData/ck3Calendar';

describe('chronicle dates agree with CK3 log evidence', () => {
    test.each([
        ['1066.11.21', 389415, 1066, 11, 21],
        ['1066.12.19', 389443, 1066, 12, 19],
        ['1067.1.18', 389473, 1067, 1, 18],
        ['1067年2月12日', 389498, 1067, 2, 12],
        ['1066.1.1', 389091, 1066, 1, 1]
    ] as const)('%s maps to the engine day count %i', (display, totalDays, year, month, day) => {
        expect(parseCk3CalendarDate(display)).toEqual({ display, totalDays, year, month, day });
        expect(ck3DateFromTotalDays(totalDays)).toEqual({ year, month, day });
    });
    test('one day before a new year remains in the previous CK3 year', () => {
        expect(ck3DateFromTotalDays(389090)).toEqual({ year: 1065, month: 12, day: 31 });
        expect(parseCk3CalendarDate('1068.2.29')).toBeUndefined();
    });
});
