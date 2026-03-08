import { DiaryGenerator } from './DiaryGenerator';
import { Config } from '../../shared/Config';
import { GameData } from '../../shared/gameData/GameData';
import { Conversation } from '../conversation/Conversation';
import { ApiConnection } from '../../shared/apiConnection';
import { DiaryEntry } from '../ts/diary_interfaces';
import { Character } from '../../shared/gameData/Character';

// @ts-ignore
import { describe, it, beforeEach, expect, jest } from '@jest/globals';

jest.mock('../../shared/apiConnection');
jest.mock('../conversation/Conversation');

describe('DiaryGenerator', () => {
  let config: Config;
  let gameData: GameData;
  let conversation: jest.Mocked<Conversation>;
  let diaryGenerator: DiaryGenerator;

  beforeEach(() => {
    config = {
        language: 'en',
        prompts: {
            en: {
                diaryPrompt: 'Test Diary Prompt'
            }
        },
        textGenerationApiConnectionConfig: {
            connection: {},
            parameters: {}
        }
    } as any;

    // @ts-ignore
    gameData = new GameData('');
    const player = new Character(['1', 'Player', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    player.id = 1;
    player.fullName = 'Player';
    player.traits = [];
    gameData.characters.set(1, player);
    gameData.playerID = 1;
    
    conversation = new Conversation(gameData, config, {} as any, '') as jest.Mocked<Conversation>;
    diaryGenerator = new DiaryGenerator(config);
  });

  it('should return null if character is not found', async () => {
    (conversation.getHistory as jest.Mock).mockReturnValue([]);
    const entry = await diaryGenerator.generateDiaryEntry(gameData, conversation, '999');
    expect(entry).toBeNull();
  });

  it('should return null if diary prompt is not found', async () => {
    (conversation.getHistory as jest.Mock).mockReturnValue([]);
    config.prompts['en']!.diaryPrompt = '';
    const entry = await diaryGenerator.generateDiaryEntry(gameData, conversation, '1');
    expect(entry).toBeNull();
  });

  it('should return a valid DiaryEntry on success', async () => {
    (conversation.getHistory as jest.Mock).mockReturnValue([]);
    const mockComplete = jest.fn().mockResolvedValue('This is a diary entry.');
    // @ts-ignore
    (ApiConnection as jest.Mock).mockImplementation(() => {
      return {
        complete: mockComplete,
      };
    });
    diaryGenerator = new DiaryGenerator(config);

    const entry = await diaryGenerator.generateDiaryEntry(gameData, conversation, '1');

    expect(entry).not.toBeNull();
    expect(entry?.content).toBe('This is a diary entry.');
    expect(entry?.character_traits).toBeDefined();
  });

  it('should handle API errors gracefully', async () => {
    (conversation.getHistory as jest.Mock).mockReturnValue([]);
    const mockComplete = jest.fn().mockResolvedValue(null);
    // @ts-ignore
    (ApiConnection as jest.Mock).mockImplementation(() => {
      return {
        complete: mockComplete,
      };
    });
    diaryGenerator = new DiaryGenerator(config);

    const entry = await diaryGenerator.generateDiaryEntry(gameData, conversation, '1');
    expect(entry).toBeNull();
  });
});
