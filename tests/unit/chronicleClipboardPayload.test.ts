import {
    gameDateFromChroniclePayload,
    parseChronicleClipboardPayload,
    CHRONICLE_CLIPBOARD_FIELD_COUNT,
    type ChronicleClipboardPayload
} from '../../src/main/chronicle/chronicleClipboardPayload';

function makeValidFields(overrides: Partial<Record<number, string>> = {}): string[] {
    const fields = [
        '123',
        '7',
        'Some Name',
        '11',
        '22',
        '33',
        '44',
        '555',
        '666',
        '2',
        '1',
        '101',
        '202',
        '303',
        '404',
        '1',
        '1',
        'quarterly',
        '388738',
        '1066',
        '10',
        '14',
        '4',
        'King of France',
        '777'
    ];
    for (const [idx, value] of Object.entries(overrides)) {
        fields[Number(idx)] = value as string;
    }
    return fields;
}

describe('parseChronicleClipboardPayload - valid payloads', () => {
    it('builds the game date from the explicit CK3 date fields', () => {
        const result = parseChronicleClipboardPayload(makeValidFields());
        expect(result.status).toBe('valid');
        if (result.status !== 'valid') return;

        expect(gameDateFromChroniclePayload(result.payload)).toEqual({
            totalDays: 388738,
            year: 1066,
            month: 10,
            day: 14,
            display: '1066.10.14'
        });
    });

    it('parses a full 25-field CHRONICLE_TICK payload into typed fields', () => {
        const result = parseChronicleClipboardPayload(makeValidFields());
        expect(result.status).toBe('valid');
        if (result.status !== 'valid') return;
        const payload: ChronicleClipboardPayload = result.payload;
        expect(payload.playerId).toBe('123');
        expect(payload.playerName).toBe('Some Name');
        expect(payload.checkpointEpoch).toBe(7);
        expect(payload.protocol).toBeDefined();
        expect(payload.protocol?.protocolSchema).toBe(2);
        expect(payload.signalKind).toBe('quarterly');
        expect(payload.currentDateTotalDays).toBe(388738);
        expect(payload.currentYear).toBe(1066);
        expect(payload.currentMonth).toBe(10);
        expect(payload.currentDay).toBe(14);
        expect(payload.pulseQuarter).toBe(4);
        expect(payload.playerPrimaryTitle).toBe('King of France');
        expect(payload.memoryRequestId).toBe(777);
    });

    it('parses yearly signal kind', () => {
        const result = parseChronicleClipboardPayload(makeValidFields({ 17: 'yearly' }));
        expect(result.status).toBe('valid');
        if (result.status !== 'valid') return;
        expect(result.payload.signalKind).toBe('yearly');
    });

    it('parses manual signal kind', () => {
        const result = parseChronicleClipboardPayload(makeValidFields({ 17: 'manual' }));
        expect(result.status).toBe('valid');
        if (result.status !== 'valid') return;
        expect(result.payload.signalKind).toBe('manual');
    });

    it('accepts a non-zero pulse quarter of 1', () => {
        const result = parseChronicleClipboardPayload(makeValidFields({ 22: '1' }));
        expect(result.status).toBe('valid');
        if (result.status !== 'valid') return;
        expect(result.payload.pulseQuarter).toBe(1);
    });

    it('accepts an empty playerPrimaryTitle (optional display text)', () => {
        const result = parseChronicleClipboardPayload(makeValidFields({ 23: '' }));
        expect(result.status).toBe('valid');
        if (result.status !== 'valid') return;
        expect(result.payload.playerPrimaryTitle).toBe('');
    });
});

describe('parseChronicleClipboardPayload - field count validation (Step 2)', () => {
    it('rejects a payload with fewer than 25 fields as truncated', () => {
        const fields = makeValidFields();
        fields.length = 24;
        const result = parseChronicleClipboardPayload(fields);
        expect(result).toEqual({
            status: 'truncated',
            expected: CHRONICLE_CLIPBOARD_FIELD_COUNT,
            actual: 24
        });
    });

    it('rejects an empty payload as truncated', () => {
        const result = parseChronicleClipboardPayload([]);
        expect(result).toEqual({
            status: 'truncated',
            expected: CHRONICLE_CLIPBOARD_FIELD_COUNT,
            actual: 0
        });
    });

    it('rejects undefined payloads as truncated', () => {
        const result = parseChronicleClipboardPayload(undefined);
        expect(result).toEqual({
            status: 'truncated',
            expected: CHRONICLE_CLIPBOARD_FIELD_COUNT,
            actual: 0
        });
    });

    it('accepts more than 25 fields (extra fields ignored) without truncation', () => {
        const fields = makeValidFields();
        fields.push('extra1', 'extra2');
        const result = parseChronicleClipboardPayload(fields);
        expect(result.status).toBe('valid');
    });
});

describe('parseChronicleClipboardPayload - legacy protocol rejection (Step 2)', () => {
    it('rejects a legacy 9-field payload (no protocol v2 tail)', () => {
        const legacyFields = [
            '123',
            '7',
            'Some Name',
            '11',
            '22',
            '33',
            '44',
            '555',
            '666'
        ];
        const result = parseChronicleClipboardPayload(legacyFields);
        expect(result.status).toBe('truncated');
        if (result.status !== 'truncated') return;
        expect(result.actual).toBe(9);
        expect(result.expected).toBe(CHRONICLE_CLIPBOARD_FIELD_COUNT);
    });

    it('rejects a payload with a partial protocol tail', () => {
        const fields = makeValidFields();
        fields.length = 20;
        const result = parseChronicleClipboardPayload(fields);
        expect(result).toMatchObject({ status: 'truncated', actual: 20 });
    });

    it('rejects an unsupported protocol schema', () => {
        const result = parseChronicleClipboardPayload(makeValidFields({ 9: '3' }));
        expect(result.status).toBe('unsupported-schema');
        if (result.status !== 'unsupported-schema') return;
        expect(result.schema).toBe(3);
    });
});

describe('parseChronicleClipboardPayload - date validation (Step 2)', () => {
    it('rejects a non-numeric currentDateTotalDays', () => {
        const result = parseChronicleClipboardPayload(makeValidFields({ 18: 'abc' }));
        expect(result.status).toBe('invalid');
        if (result.status !== 'invalid') return;
        expect(result.reason).toContain('date');
    });

    it('rejects a non-numeric currentYear', () => {
        const result = parseChronicleClipboardPayload(makeValidFields({ 19: 'xyz' }));
        expect(result.status).toBe('invalid');
        if (result.status !== 'invalid') return;
        expect(result.reason).toContain('year');
    });

    it('rejects a non-numeric currentMonth', () => {
        const result = parseChronicleClipboardPayload(makeValidFields({ 20: 'not-a-number' }));
        expect(result.status).toBe('invalid');
    });

    it('rejects a non-numeric currentDay', () => {
        const result = parseChronicleClipboardPayload(makeValidFields({ 21: 'day' }));
        expect(result.status).toBe('invalid');
    });

    it('rejects month 0', () => {
        const result = parseChronicleClipboardPayload(makeValidFields({ 20: '0' }));
        expect(result.status).toBe('invalid');
    });

    it('rejects month 13', () => {
        const result = parseChronicleClipboardPayload(makeValidFields({ 20: '13' }));
        expect(result.status).toBe('invalid');
    });

    it('rejects day 0', () => {
        const result = parseChronicleClipboardPayload(makeValidFields({ 21: '0' }));
        expect(result.status).toBe('invalid');
    });

    it('rejects day 32 in October', () => {
        const result = parseChronicleClipboardPayload(makeValidFields({ 21: '32' }));
        expect(result.status).toBe('invalid');
    });
});

describe('parseChronicleClipboardPayload - requestId validation (Step 2)', () => {
    it('rejects requestId = 0', () => {
        const result = parseChronicleClipboardPayload(makeValidFields({ 24: '0' }));
        expect(result.status).toBe('invalid');
        if (result.status !== 'invalid') return;
        expect(result.reason).toContain('request');
    });

    it('rejects a non-numeric requestId', () => {
        const result = parseChronicleClipboardPayload(makeValidFields({ 24: 'abc' }));
        expect(result.status).toBe('invalid');
    });

    it('accepts requestId = 1 (smallest valid id)', () => {
        const result = parseChronicleClipboardPayload(makeValidFields({ 24: '1' }));
        expect(result.status).toBe('valid');
    });
});

describe('parseChronicleClipboardPayload - signalKind validation', () => {
    it('rejects an unknown signalKind', () => {
        const result = parseChronicleClipboardPayload(makeValidFields({ 17: 'hourly' }));
        expect(result.status).toBe('invalid');
        if (result.status !== 'invalid') return;
        expect(result.reason).toContain('signal');
    });

    it('rejects an empty signalKind', () => {
        const result = parseChronicleClipboardPayload(makeValidFields({ 17: '' }));
        expect(result.status).toBe('invalid');
    });
});

describe('parseChronicleClipboardPayload - pulseQuarter validation', () => {
    it('rejects a non-numeric pulseQuarter', () => {
        const result = parseChronicleClipboardPayload(makeValidFields({ 22: 'abc' }));
        expect(result.status).toBe('invalid');
    });

    it('rejects pulseQuarter 0', () => {
        const result = parseChronicleClipboardPayload(makeValidFields({ 22: '0' }));
        expect(result.status).toBe('invalid');
    });

    it('rejects pulseQuarter 5 (out of range)', () => {
        const result = parseChronicleClipboardPayload(makeValidFields({ 22: '5' }));
        expect(result.status).toBe('invalid');
    });
});
