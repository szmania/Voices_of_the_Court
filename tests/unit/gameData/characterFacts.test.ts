import { Character } from '../../../src/shared/gameData/Character';

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

    it('caps long list sections and reports overflow', () => {
        const c = makeAi();
        c.maaRegiments = Array.from({ length: 12 }, (_, i) => ({ name: `Reg ${i}`, isPersonal: false, menAlive: 10 }));
        const text = c.getExtendedFactsDescription();
        expect(text).toContain('Reg 7');
        expect(text).not.toContain('Reg 8');
        expect(text).toContain('+4 more');
    });
});
