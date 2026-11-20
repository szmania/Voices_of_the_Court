import { Character } from '../../../src/shared/gameData/Character';
import type { Relative } from '../../../src/shared/gameData/GameData';

function makeRelative(overrides: Partial<Relative> & Pick<Relative, 'id' | 'name' | 'relationship'>): Relative {
    return {
        sheHe: undefined,
        isDeceased: false,
        traits: [],
        partners: [],
        ...overrides,
    };
}

function makeAi(): Character {
    const c = new Character(new Array(27).fill(''));
    c.id = 2000; c.shortName = 'Duke AI'; c.fullName = 'Duke AI the Wise';
    c.stress = { value: 42, level: 'Stressed', progress: 30 };
    c.legitimacy = { value: 55, level: 3, type: 'Feudal Legacy', powerfulVassalExpectation: '40', vassalExpectation: '35', liegeExpectation: '50' };
    c.incomeGold = 250; c.incomeBalance = 3.25; c.incomeBreakdown = 'Gold from domains: 4.5; Taxes: -1.25';
    c.treasuryAmount = 500; c.treasuryTooltip = 'Treasury: 500 gold';
    c.vassalLeviesTotal = 1200; c.domainLevyHoldings = [400, 450]; c.theocraticLeaseLevies = 100;
    c.maaRegiments = [{ name: 'Armored Footmen', isPersonal: true, menAlive: 120 }];
    c.laws = ['Crown Authority III', 'High Tax'];
    c.personaNumbers = { boldness: 40, compassion: 10, energy: 60, greed: 70, honor: 50, rationality: 45, sociability: 30, vengefulness: 20, zeal: 55 };
    c.knownSecrets = [{
        name: 'Murdered Father', desc: 'He murdered his father.', category: 'Murder', type: 'secret_murder',
        ownerId: 3000, ownerName: 'Count Bad', targetId: 3000, targetName: 'Count Bad',
        isCriminal: true, spent: false, canBeExposed: true, otherKnowers: [{ id: 4000, name: 'Bishop Curious' }]
    }];
    c.modifiers = [{ id: 'mod_wounded', name: 'Wounded', desc: 'This character is wounded.' }];
    return c;
}

describe('getExtendedFactsDescription', () => {
    it('renders all populated sections', () => {
        const text = makeAi().getExtendedFactsDescription();
        expect(text).toContain('Stress: 42 (Stressed, 30%)');
        expect(text).toContain('Legitimacy: 55');
        expect(text).toContain('powerful vassals expect 40');
        expect(text).toContain('monthly balance 3.25');
        expect(text).toContain('domain levies 850');   // 400+450 求和
        expect(text).toContain('Armored Footmen (personal, 120)');
        expect(text).toContain('Laws: Crown Authority III; High Tax');
        expect(text).toContain('boldness 40');
        expect(text).toContain('Known secrets:');
        expect(text).toContain('owned by Count Bad');
        expect(text).toContain('Notable modifiers: Wounded');
    });

    it('returns empty string when nothing is set', () => {
        const bare = new Character(new Array(27).fill(''));
        expect(bare.getExtendedFactsDescription()).toBe('');
    });

    it('respects token budget (chars/4 estimate)', () => {
        const c = makeAi();
        const text = c.getExtendedFactsDescription(20); // 极小预算
        expect(Math.ceil(text.length / 4)).toBeLessThanOrEqual(24); // 允许单节粒度误差
        expect(text.length).toBeGreaterThan(0);
    });

    it('omits non-finite numbers instead of rendering NaN', () => {
        const c = makeAi();
        c.stress = { value: NaN, level: 'Broken', progress: NaN };
        (c.personaNumbers as any).honor = NaN;
        const text = c.getExtendedFactsDescription();
        expect(text).not.toContain('NaN');
        expect(text).toContain('Stress'); // 其余节不受影响
    });

    it('omits legitimacy level when non-finite and renders stress without empty level', () => {
        const c = makeAi();
        c.stress = { value: 42, level: '', progress: NaN };
        c.legitimacy = { value: 55, level: NaN, type: 'Feudal Legacy' };
        const text = c.getExtendedFactsDescription();
        expect(text.split('\n')).toContain('Stress: 42');
        expect(text).toContain('Legitimacy: 55 (Feudal Legacy)');
        expect(text).not.toContain('level');
    });

    it('caps long list sections and reports overflow', () => {
        const c = makeAi();
        c.maaRegiments = Array.from({ length: 12 }, (_, i) => ({ name: `Reg ${i}`, isPersonal: false, menAlive: 10 }));
        let text = c.getExtendedFactsDescription();
        expect(text).toContain('Reg 7');
        expect(text).not.toContain('Reg 8');
        expect(text).toContain('+4 more');
        c.modifiers = Array.from({ length: 25 }, (_, i) => ({ id: `m${i}`, name: `Mod ${i}`, desc: '' }));
        text = c.getExtendedFactsDescription();
        expect(text).toContain('+5 more');
        expect(text).not.toContain('Mod 20');
    });
});

describe('getRelativesDescription', () => {
    function makeCharacter(overrides: Partial<Character> = {}): Character {
        const c = new Character(new Array(27).fill(''));
        c.id = 1; c.fullName = 'Player'; c.sheHe = 'he';
        Object.assign(c, overrides);
        return c;
    }

    it('maps child pronouns to son/daughter (English, Chinese, case-insensitive)', () => {
        const c = makeCharacter();
        c.relatives = [
            makeRelative({ id: 10, name: 'Boy', relationship: 'Child', sheHe: 'he' }),
            makeRelative({ id: 11, name: 'Girl', relationship: 'Child', sheHe: 'she' }),
            makeRelative({ id: 12, name: 'CnBoy', relationship: 'Child', sheHe: '他' }),
            makeRelative({ id: 13, name: 'CnGirl', relationship: 'Child', sheHe: '她' }),
            makeRelative({ id: 14, name: 'Upper', relationship: 'Child', sheHe: 'SHE' }),
        ];
        const text = c.getRelativesDescription(365 * 40);
        expect(text).toContain('son Boy');
        expect(text).toContain('daughter Girl');
        expect(text).toContain('son CnBoy');
        expect(text).toContain('daughter CnGirl');
        expect(text).toContain('daughter Upper');
    });

    it('never renders NaN ages when the current day is missing or invalid', () => {
        const c = makeCharacter({ birthTotalDays: 365 * 30 });
        c.relatives = [makeRelative({ id: 10, name: 'Kid', relationship: 'Child', sheHe: 'he', birthTotalDays: 365 * 20 })];
        expect(c.getRelativesDescription(undefined as unknown as number)).not.toContain('NaN');
        expect(c.getRelativesDescription(NaN)).not.toContain('NaN');
        expect(c.getRelativesDescription(365 * 45)).toContain('age 24');
    });

    it('orders children oldest first and keeps unknown birth days last', () => {
        const c = makeCharacter();
        c.relatives = [
            makeRelative({ id: 1, name: 'Young', relationship: 'Child', sheHe: 'he', birthTotalDays: 365 * 20 }),
            makeRelative({ id: 2, name: 'NoBirth', relationship: 'Child', sheHe: 'he' }),
            makeRelative({ id: 3, name: 'Old', relationship: 'Child', sheHe: 'he', birthTotalDays: 365 * 5 }),
        ];
        const text = c.getRelativesDescription(365 * 40);
        expect(text.indexOf('Old')).toBeLessThan(text.indexOf('Young'));
        expect(text.indexOf('Young')).toBeLessThan(text.indexOf('NoBirth'));
    });

    it('labels siblings older/younger relative to the character', () => {
        const c = makeCharacter({ birthTotalDays: 365 * 30 });
        c.relatives = [
            makeRelative({ id: 1, name: 'Sis', relationship: 'Sibling', sheHe: 'she', birthTotalDays: 365 * 28 }),
            makeRelative({ id: 2, name: 'Bro', relationship: 'Sibling', sheHe: 'he', birthTotalDays: 365 * 35 }),
        ];
        const text = c.getRelativesDescription(365 * 45);
        expect(text).toContain('older sister Sis');
        expect(text).toContain('younger brother Bro');
    });
});
