import { DiaryGenerator } from './DiaryGenerator';
import { Config } from '../../shared/Config';
import { GameData } from '../../shared/gameData/GameData';
import { Conversation } from '../conversation/Conversation';
import { ApiConnection } from '../../shared/apiConnection';
import { DiaryEntry } from '../ts/diary_interfaces';
import { Character } from '../../shared/gameData/Character';

jest.mock('../../shared/apiConnection');

describe('DiaryGenerator', () => {
  let config: Config;
  let gameData: GameData;
  let conversation: Conversation;
  let diaryGenerator: DiaryGenerator;

  beforeEach(() => {
    config = new Config('default_userdata/configs/default_config.json');
    gameData = new GameData();
    const player = new Character();
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
    config.prompts['en']!.diaryPrompt = '';
    const entry = await diaryGenerator.generateDiaryEntry(gameData, conversation, '1');
    expect(entry).toBeNull();
  });

  it('should return a valid DiaryEntry on success', async () => {
    const mockGenerate = jest.fn().mockResolvedValue('This is a diary entry.');
    (ApiConnection as jest.Mock).mockImplementation(() => {
      return {
        generate: mockGenerate,
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
    (ApiConnection as jest.Mock).mockImplementation(() => {
      return {
        generate: mockGenerate,
      };
    });
    diaryGenerator = new DiaryGenerator(config);

    const entry = await diaryGenerator.generateDiaryEntry(gameData, conversation, '1');
    expect(entry).toBeNull();
  });
});
