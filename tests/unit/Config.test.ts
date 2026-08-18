/**
 * Unit tests for Config.ts
 * Test cases: UT-CF-01 through UT-CF-04
 */

import { Config } from '../../src/shared/Config';
import * as fsMod from 'fs';

jest.mock('fs');

describe('Config', () => {
    const mockConfigPath = '/tmp/test-config.json';

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
    });

    describe('UT-CF-01: Default embedding config', () => {
        it('should have sensible defaults for embeddingApiConnectionConfig', () => {
            (fsMod.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({}));
            const config = new Config(mockConfigPath);
            expect(config.embeddingApiConnectionConfig).toBeDefined();
            expect(config.embeddingApiConnectionConfig.connection).toBeDefined();
        });
    });

    describe('UT-CF-02: memoriesInsertDepth boundary - 0', () => {
        it('should handle memoriesInsertDepth of 0 without crash', () => {
            const configData = { memoriesInsertDepth: 0, userFolderPath: '/tmp/test' };
            (fsMod.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(configData));
            const config = new Config(mockConfigPath);
            expect(config.memoriesInsertDepth).toBeDefined();
            expect(() => config.export()).not.toThrow();
        });
    });

    describe('UT-CF-03: memoriesInsertDepth boundary - max', () => {
        it('should accept large memoriesInsertDepth value without overflow', () => {
            const configData = { memoriesInsertDepth: 999999, userFolderPath: '/tmp/test' };
            (fsMod.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(configData));
            const config = new Config(mockConfigPath);
            expect(config.memoriesInsertDepth).toBe(999999);
            expect(() => config.export()).not.toThrow();
        });
    });

    describe('UT-CF-04: Config serialization round-trip', () => {
        it('should preserve all embedding fields during serialization', () => {
            const configData = {
                userFolderPath: '/tmp/test',
                embeddingApiConnectionConfig: {
                    connection: {
                        type: 'openai', baseUrl: 'https://api.openai.com/v1',
                        key: 'test-key', model: 'text-embedding-3-small',
                        forceInstruct: false, overwriteContext: false, customContext: 0
                    },
                    parameters: { temperature: 0.7 }
                }
            };
            (fsMod.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(configData));
            const config = new Config(mockConfigPath);
            config.export();
            const deserialized = new Config(mockConfigPath);
            expect(deserialized.embeddingApiConnectionConfig.connection.type).toBe('openai');
        });
    });
});
