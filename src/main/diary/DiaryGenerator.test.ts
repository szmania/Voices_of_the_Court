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

describe('DiaryGenerator', () => {
  let config: Config;
  let gameData: GameData;
  let conversation: Conversation;
  let diaryGenerator: DiaryGenerator;

  beforeEach(() => {
    config = new Config('default_userdata/configs/default_config.json');
    // @ts-ignore - GameData constructor expects a string argument
    gameData = new GameData('');
    const player = new Character(['1', 'Player', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    player.id = 1;
    player.fullName = 'Player';
    gameData.characters.set(1, player);
    gameData.playerID = 1;
    conversation = new Conversation(gameData, config, {} as any, '');
    diaryGenerator = new DiaryGenerator(config);
  });

  it('should return null if character is not found', async () => {
    const entry = await diaryGenerator.generateDiaryEntry(gameData, conversation, '999');
    expect(entry).toBeNull();
  });

  it('should return null if diary prompt is not found', async () => {
    // @ts-ignore - diaryPrompt is a custom property we added
    config.prompts['en']!.diaryPrompt = '';
    const entry = await diaryGenerator.generateDiaryEntry(gameData, conversation, '1');
    expect(entry).toBeNull();
  });

  it('should return a valid DiaryEntry on success', async () => {
    const mockGenerate = jest.fn().mockResolvedValue('This is a diary entry.');
    // @ts-ignore - ApiConnection mock
    (ApiConnection as jest.Mock).mockImplementation(() => {
      return {
        // @ts-ignore - using complete instead of generate
        complete: mockGenerate,
      };
    });
    diaryGenerator = new DiaryGenerator(config);

    const entry = await diaryGenerator.generateDiaryEntry(gameData, conversation, '1');

    expect(entry).not.toBeNull();
    expect(entry?.content).toBe('This is a diary entry.');
    expect(entry?.character_traits).toBeDefined();
  });

  it('should handle API errors gracefully', async () => {
    const mockGenerate = jest.fn().mockResolvedValue(null);
    // @ts-ignore - ApiConnection mock
    (ApiConnection as jest.Mock).mockImplementation(() => {
      return {
        // @ts-ignore - using complete instead of generate
        complete: mockGenerate,
      };
    });
    diaryGenerator = new DiaryGenerator(config);

    const entry = await diaryGenerator.generateDiaryEntry(gameData, conversation, '1');
    expect(entry).toBeNull();
  });
});
