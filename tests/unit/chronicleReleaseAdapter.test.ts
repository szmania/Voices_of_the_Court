import { ApiConnection } from '../../src/shared/apiConnection';
import { createChronicleSummarizationConnection, type ChronicleGeneratorConfig } from '../../src/main/chronicle/ChronicleGenerator';

jest.mock('../../src/shared/apiConnection', () => ({ ApiConnection: jest.fn() }));

describe('chronicle adapter for release providers', () => {
    const config = {
        summarizationUseTextGenApi: false,
        summarizationApiConnectionConfig: { connection: { type: 'chatgpt', model: 'test-model' } },
        summarizationParameters: { temperature: 0.3 }
    } as ChronicleGeneratorConfig;
    const complete = jest.fn();
    const isChat = jest.fn();
    beforeEach(() => {
        jest.clearAllMocks();
        (ApiConnection as jest.Mock).mockImplementation(() => ({
            complete, isChat, context: 4096, model: 'test-model', parameters: config.summarizationParameters,
            calculateTokensFromText: (text: string) => text.length
        }));
    });

    test('converts chat prompts and structured results while keeping internal metadata off the wire', async () => {
        isChat.mockReturnValue(true);
        complete.mockResolvedValue({ content: 'Chronicle prose' });
        const encoder = { encode: jest.fn() } as never;
        const api = createChronicleSummarizationConnection(config, encoder);
        expect(await api.complete('Source facts', false, { max_tokens: 1000, __purpose: 'chronicle' })).toBe('Chronicle prose');
        expect(ApiConnection).toHaveBeenCalledWith(config.summarizationApiConnectionConfig!.connection, config.summarizationParameters, encoder);
        expect(complete).toHaveBeenCalledWith([{ role: 'user', content: 'Source facts' }], false, { max_tokens: 1000 });
        expect(api.calculateTokensFromText('abc')).toBe(3);
    });

    test('preserves instruct prompts and returns an empty string for an empty provider result', async () => {
        isChat.mockReturnValue(false);
        complete.mockResolvedValue(undefined);
        const api = createChronicleSummarizationConnection(config);
        expect(await api.complete('Source facts', false, { __purpose: 'chronicle_digest' })).toBe('');
        expect(complete).toHaveBeenCalledWith('Source facts', false, {});
    });
});
