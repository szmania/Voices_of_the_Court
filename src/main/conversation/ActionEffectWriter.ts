import { GameData } from '../../shared/gameData/GameData.js';
import { RunFileManager } from '../RunFileManager.js';

/**
 * Utilities for composing and writing CK3 effects with proper source/target scoping.
 * Positions are 0-based to match the provided example and CK3 ordered_in_global_list usage.
 */
export class ActionEffectWriter {
  /**
   * Compose CK3 prelude code to scope source/target characters from the ordered list.
   * Uses:
   *  - global_var:votcce_action_source
   *  - global_var:votcce_action_target
   */
  static composeScopePrelude(sourceIndex: number | null | undefined, targetIndex?: number | null, isPlayerTarget?: boolean): string {
    let prelude = "";

    if (sourceIndex !== null && sourceIndex !== undefined) {
      prelude += `
ordered_in_global_list = {
    variable = mcc_characters_list_v2
    position = ${sourceIndex}
    set_global_variable = {
        name = votcce_action_source
        value = this
    }
}
`;
    }

    if (targetIndex !== null && targetIndex !== undefined) {
      if (isPlayerTarget) {
        // Use 'root' scope for player target
        prelude += `
root = {
    set_global_variable = {
        name = votcce_action_target
        value = root
    }
}
`;
      } else {
        // Regular target scoping
        prelude += `
ordered_in_global_list = {
    variable = mcc_characters_list_v2
    position = ${targetIndex}
    set_global_variable = {
        name = votcce_action_target
        value = this
    }
}
`;
      }
    }

    return prelude;
  }

  /**
   * Compose final CK3 effect block including scope prelude and action effect text.
   * Consumers can write this string into run file.
   */
  static composeFullEffect(
    gameData: GameData,
    sourceCharacterId: number | null | undefined,
    targetCharacterId: number | null | undefined,
    effectBody: string
  ): string {
    const sourceIndex = sourceCharacterId != null ? this.getCharacterIndex(gameData, sourceCharacterId) : null;
    const targetIndex = targetCharacterId != null ? this.getCharacterIndex(gameData, targetCharacterId) : null;
    const isPlayerTarget = targetCharacterId != null && targetCharacterId === gameData.playerID;

    const prelude = this.composeScopePrelude(sourceIndex, targetIndex, isPlayerTarget);
    return `${prelude}\n${effectBody}\n`;
  }

  /**
   * Write composed effect to run file (overwrites).
   */
  static writeEffect(
    runFileManager: RunFileManager,
    gameData: GameData,
    sourceCharacterId: number | null | undefined,
    targetCharacterId: number | null | undefined,
    effectBody: string
  ): void {
    const effect = this.composeFullEffect(gameData, sourceCharacterId, targetCharacterId, effectBody);
    runFileManager.write(
      `${effect}`);
  }

  /**
   * Append composed effect to run file.
   */
  static appendEffect(
    runFileManager: RunFileManager,
    gameData: GameData,
    sourceCharacterId: number | null | undefined,
    targetCharacterId: number | null | undefined,
    effectBody: string
  ): void {
    const effect = this.composeFullEffect(gameData, sourceCharacterId, targetCharacterId, effectBody);
    runFileManager.append(effect);
  }

  /**
   * Compose CK3 prelude for LETTER actions using dedicated global variables instead
   * of the positional conversation list (letter actions fire outside the conversation
   * scene, so `ordered_in_global_list` positions are unreliable there).
   *
   * Sets:
   *  - global_var:message_first_scope = the player (root)
   *  - global_var:message_second_scope_<letterName> = the other letter participant
   *  - global_var:votcce_action_source / votcce_action_target = derived from the two
   *    message scopes above, so existing action scripts keep working unchanged.
   *
   * @param sourceId  Action source character id.
   * @param targetId  Action target character id.
   * @param playerId  The player character id (letter owner).
   * @param letterName Letter thread name, e.g. "letter_1" .. "letter_9".
   */
  static composeLetterScopePrelude(sourceId: number, targetId: number, playerId: number, letterName: string): string {
    const otherId = sourceId === playerId ? targetId : sourceId;
    const sourceVar = sourceId === playerId ? 'message_first_scope' : `message_second_scope_${letterName}`;
    const targetVar = targetId === playerId ? 'message_first_scope' : `message_second_scope_${letterName}`;
    return `
root = {
    set_global_variable = {
        name = message_first_scope
        value = root
    }
}
character:${otherId} = {
    set_global_variable = {
        name = message_second_scope_${letterName}
        value = this
    }
}
set_global_variable = {
    name = votcce_action_source
    value = global_var:${sourceVar}
}
set_global_variable = {
    name = votcce_action_target
    value = global_var:${targetVar}
}
`;
  }

  /**
   * Compose a full letter-action effect (letter scope prelude + effect body).
   */
  static composeFullLetterEffect(
    sourceId: number,
    targetId: number,
    playerId: number,
    letterName: string,
    effectBody: string
  ): string {
    return `${this.composeLetterScopePrelude(sourceId, targetId, playerId, letterName)}\n${effectBody}\n`;
  }

  /**
   * Write a letter-action effect to run file (overwrites).
   */
  static writeLetterEffect(
    runFileManager: RunFileManager,
    sourceId: number,
    targetId: number,
    playerId: number,
    letterName: string,
    effectBody: string
  ): void {
    runFileManager.write(this.composeFullLetterEffect(sourceId, targetId, playerId, letterName, effectBody));
  }

  /**
   * Append a letter-action effect to run file.
   */
  static appendLetterEffect(
    runFileManager: RunFileManager,
    sourceId: number,
    targetId: number,
    playerId: number,
    letterName: string,
    effectBody: string
  ): void {
    runFileManager.append(this.composeFullLetterEffect(sourceId, targetId, playerId, letterName, effectBody));
  }

  /**
   * Compute 0-based position for character id in the ordered list.
   * Uses getCharacterIds() character id list matches the positions in ck3.
   */
  static getCharacterIndex(gameData: GameData, characterId: number): number {
    console.log(`[ActionEffectWriter] Getting index for characterId: ${characterId}`);
    const ids = Array.from(gameData.characters.keys());
    console.log(`[ActionEffectWriter] Character ID list from gameData (map order): [${ids.join(', ')}]`);
    const idx = ids.indexOf(characterId);
    console.log(`[ActionEffectWriter] Found index: ${idx}`);
    if (idx === -1) {
      throw new Error(`Character id ${characterId} not found in GameData.characters`);
    }
    return idx;
  }
}
