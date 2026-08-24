import { parseLog, extractMultilinePayload } from '../../../src/shared/gameData/parseLog';
import path from 'path';

const FIXTURE = path.join(__dirname, '..', '..', 'fixtures', 'debuglog_p0.txt');
const FIXTURE_FB = path.join(__dirname, '..', '..', 'fixtures', 'debuglog_p0_fallbacks.txt');

async function aiChar(file: string) {
    const gd = await parseLog(file);
    expect(gd).toBeDefined();
    const ai = gd!.characters.get(2000)!;
    expect(ai).toBeDefined();
    return ai;
}

describe('P0 scalar state datatypes', () => {
    it('parses stress', async () => {
        const ai = await aiChar(FIXTURE);
        expect(ai.stress).toEqual({ value: 42, level: 'Stressed', progress: 30 });
    });

    it('parses legitimacy with expectations', async () => {
        const ai = await aiChar(FIXTURE);
        expect(ai.legitimacy).toEqual({
            value: 55, level: 3, type: 'Feudal Legacy',
            powerfulVassalExpectation: '40', vassalExpectation: '35', liegeExpectation: '50'
        });
    });

    it('handles legitimacy "no" fallback', async () => {
        const ai = await aiChar(FIXTURE_FB);
        expect(ai.legitimacy).toBeUndefined();
    });

    it('parses income with multiline breakdown', async () => {
        const ai = await aiChar(FIXTURE);
        expect(ai.incomeGold).toBe(250);
        expect(ai.incomeBalance).toBeCloseTo(3.25);
        expect(ai.incomeBreakdown).toContain('Gold from domains: 4.5');
        expect(ai.incomeBreakdown).not.toContain('ENDMULTILINE');
    });

    it('parses treasury / influence / herd', async () => {
        const ai = await aiChar(FIXTURE);
        expect(ai.treasuryAmount).toBe(500);
        expect(ai.treasuryTooltip).toContain('Treasury: 500 gold');
        expect(ai.influenceAmount).toBe(120);
        expect(ai.influenceTooltip).toContain('Influence: 120');
        expect(ai.herdAmount).toBe(800);
        expect(ai.herdBreakdown).toBe('Herd breakdown here');
    });
});

describe('extractMultilinePayload', () => {
    it('returns trimmed element when no STARTMULTILINE marker', () => {
        expect(extractMultilinePayload('plain text here')).toBe('plain text here');
    });

    it('extracts payload between markers', () => {
        expect(extractMultilinePayload('STARTMULTILINE#line one#line two#ENDMULTILINE')).toBe('line one#line two');
    });

    it('handles truncated block without ENDMULTILINE', () => {
        expect(extractMultilinePayload('STARTMULTILINE#partial data')).toBe('partial data');
    });

    it('returns empty string for undefined or empty input', () => {
        expect(extractMultilinePayload(undefined)).toBe('');
        expect(extractMultilinePayload('')).toBe('');
    });
});

describe('P0 troops datatypes', () => {
    it('parses levies and sums multiple levies_dom lines', async () => {
        const ai = await aiChar(FIXTURE);
        expect(ai.vassalLeviesTotal).toBe(1200);
        expect(ai.domainLevyHoldings).toEqual([400, 450]);
        expect(ai.getTotalDomainLevies()).toBe(850);
        expect(ai.theocraticLeaseLevies).toBe(100);
    });

    it('parses men-at-arms regiments', async () => {
        const ai = await aiChar(FIXTURE);
        expect(ai.maaRegiments).toEqual([
            { name: 'Armored Footmen', isPersonal: true, menAlive: 120 },
            { name: 'Spearmen', isPersonal: false, menAlive: 80 },
        ]);
    });
});
