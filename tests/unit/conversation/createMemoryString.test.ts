import { describe, it, expect } from '@jest/globals';
import { createMemoryString } from '../../../src/main/conversation/promptBuilder';
import { Character } from '../../../src/shared/gameData/Character';
import { Memory } from '../../../src/shared/gameData/GameData';

function makeCharacter(id: number, name: string, memories: Memory[]): Character {
  const char = new Character(new Array(27).fill(''));
  char.id = id;
  char.shortName = name;
  char.fullName = name;
  char.memories = memories;
  return char;
}

function makeConv(player: Character, ai: Character, others: Character[]): any {
  const characters = new Map<number, Character>();
  characters.set(player.id, player);
  characters.set(ai.id, ai);
  for (const c of others) characters.set(c.id, c);
  return {
    gameData: { characters, playerID: player.id, aiID: ai.id },
    config: { maxMemoryTokens: 100000 },
    textGenApiConnection: { calculateTokensFromText: (text: string) => text.length },
  };
}

const prompts = { memoriesPrompt: 'MEMORIES:' };

describe('createMemoryString scoping', () => {
  const player = makeCharacter(1, 'Player', [
    { type: 'affair', creationDate: '867.1.1', desc: 'Player slept with the mistress', relevanceWeight: 10 },
  ]);
  const mistress = makeCharacter(2, 'Mistress', [
    { type: 'affair', creationDate: '867.1.1', desc: 'Mistress slept with the player', relevanceWeight: 10 },
  ]);
  const wife = makeCharacter(3, 'Wife', [
    { type: 'court', creationDate: '867.1.1', desc: 'Wife hosted a feast', relevanceWeight: 5 },
  ]);

  it('only includes the speaking character memory when scoped', () => {
    const conv = makeConv(player, wife, [mistress]);
    const result = createMemoryString(conv, prompts, wife);
    expect(result).toContain('Wife hosted a feast');
    expect(result).not.toContain('slept with');
  });

  it('excludes the player and mistress private memories from the wife prompt', () => {
    const conv = makeConv(player, wife, [mistress]);
    const result = createMemoryString(conv, prompts, wife);
    expect(result).not.toContain('Player slept');
    expect(result).not.toContain('Mistress slept');
  });

  it('includes the mistress own memory when she is the speaking character', () => {
    const conv = makeConv(player, wife, [mistress]);
    const result = createMemoryString(conv, prompts, mistress);
    expect(result).toContain('Mistress slept with the player');
  });

  it('returns a non-empty fallback (player + ai) when no character is provided', () => {
    const conv = makeConv(player, wife, [mistress]);
    const result = createMemoryString(conv, prompts);
    expect(result).toContain('Player slept');
    expect(result).toContain('Wife hosted a feast');
    expect(result).not.toContain('Mistress slept');
  });
});
