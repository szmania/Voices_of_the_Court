import { getDefaultChroniclePrompt, LEGACY_CHRONICLE_PROMPT, resolveChroniclePrompt } from '../../src/shared/chroniclePrompt';
import { generateChronicle } from '../../src/main/chronicle/ChronicleGenerator';

const languages = [
    ['en', 'Write in English'], ['zh', '请用简体中文书写'], ['fr', 'Écrivez en français'],
    ['de', 'Schreibe auf Deutsch'], ['es', 'Escribe en español'], ['ru', 'Пиши по-русски'],
    ['ja', '日本語で書いてください'], ['ko', '한국어로 작성하세요'], ['pl', 'Pisz po polsku'],
    ['pt', 'Escreva em português'], ['tr', 'Türkçe yaz']
];

describe('localized chronicle defaults', () => {
    test.each(languages)('%s has a translated default with its output language and substitution fields', (language, instruction) => {
        const prompt = getDefaultChroniclePrompt(language);
        expect(prompt).toContain(instruction);
        for (const field of ['playerName', 'periodStart', 'periodEnd']) expect(prompt).toContain(`{{${field}}}`);
        expect(prompt).toMatch(/\n9\./);
        expect(resolveChroniclePrompt('', language)).toBe(prompt);
        expect(resolveChroniclePrompt(LEGACY_CHRONICLE_PROMPT, language)).toBe(prompt);
    });

    test.each(languages)('%s preserves an edited prompt exactly', (language) => {
        const custom = '  Custom chronicle: {{playerName}}\nKeep this wording.  ';
        expect(resolveChroniclePrompt(custom, language)).toBe(custom);
    });

    test('missing/blank values follow the interface language and regional tags resolve to the existing files', () => {
        expect(resolveChroniclePrompt(undefined, 'zh-CN')).toBe(getDefaultChroniclePrompt('zh'));
        expect(resolveChroniclePrompt(' \n ', 'pt-BR')).toBe(getDefaultChroniclePrompt('pt'));
        expect(resolveChroniclePrompt('', 'unsupported')).toBe(getDefaultChroniclePrompt('en'));
    });

    test.each(languages)('%s reaches the real generator with translated instructions', async (language, instruction) => {
        const complete = jest.fn().mockResolvedValue('A completed chronicle entry.');
        const date = { totalDays: 389091, year: 1066, month: 1, day: 1, display: '1066.1.1' };
        const result = await generateChronicle({
            sources: [], requestKey: 'localized-default', playerName: 'Test Ruler', periodStart: date, periodEnd: date,
            generatorConfig: { chroniclePrompt: LEGACY_CHRONICLE_PROMPT, language,
                chronicleOutputMaxTokens: 400, summarizationParameters: { temperature: 0.3 } },
            api: { complete }
        });
        expect(result.ok).toBe(true);
        expect(complete.mock.calls[0][0]).toContain(instruction);
        expect(complete.mock.calls[0][0]).toContain('Test Ruler');
        expect(complete.mock.calls[0][0]).not.toContain('{{playerName}}');
    });
});
