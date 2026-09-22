
import path from 'path';
import { promises as fs } from 'fs';
import { Action } from '../ts/conversation_interfaces';
import { Config } from '../../shared/Config';
import { GameData } from '../../shared/gameData/GameData';
import { Letter } from './letterInterfaces';
import { RunFileManager } from '../RunFileManager';
import { ActionEffectWriter } from '../conversation/ActionEffectWriter';
import { parseLog } from '../../shared/gameData/parseLog';
import {app} from "electron";

export interface LetterAssociatedAction {
  signature: string;
  args: any[];
  triggerOn: 'send' | 'receive' | 'read';
}

export interface TriggerResult {
  success: boolean;
  message?: string;
}

export class LetterActionTrigger {
  private static actionCache: Map<string, Action> = new Map();
  private static letterRunFileManager: RunFileManager;

  private static async loadAction(signature: string, votcDataPath: string): Promise<Action | null> {
    if (this.actionCache.has(signature)) {
      return this.actionCache.get(signature) || null;
    }

    const actionFolders = ['standard', 'custom'];
    for (const folder of actionFolders) {
      const actionPath = path.join(votcDataPath, 'scripts', 'actions', folder, `${signature}.js`);
      try {
        await fs.access(actionPath);
        const actionModule = require(actionPath);
        this.actionCache.set(signature, actionModule);
        console.log(`[LetterActionTrigger] Loaded action: ${signature}`);
        return actionModule;
      } catch (error) {
        // File does not exist, try next folder
      }
    }

    console.error(`[LetterActionTrigger] Action not found: ${signature}`);
    return null;
  }

  /**
   * Derives the letter thread name (e.g. "letter_1") from the letter subject.
   * Player-sent letters use the thread name as subject; replies use "Re: letter_N".
   * Falls back to the raw subject if no thread pattern is found.
   */
  private static deriveLetterName(letter: Letter): string {
    const subject = letter.subject || '';
    const match = subject.match(/letter_\d+/);
    return match ? match[0] : subject;
  }

  public static async executeLetterAction(
    letter: Letter,
    actionSpec: LetterAssociatedAction,
    config: Config
  ): Promise<TriggerResult> {
    console.log(`[LetterActionTrigger] Executing action '${actionSpec.signature}' for letter ${letter.id}`);

    if (!this.letterRunFileManager) {
      this.letterRunFileManager = new RunFileManager(config.userFolderPath, 'votc_letter_actions.txt');
    }
    const userDataPath = app.getPath('userData');

    const action = await this.loadAction(actionSpec.signature, path.join(userDataPath, 'votc_data'));
    if (!action) {
      return { success: false, message: `Action module not found for signature: ${actionSpec.signature}` };
    }

    const gameData = await parseLog(path.join(config.userFolderPath, 'logs', 'debug.log'));
    if (!gameData) {
      return { success: false, message: 'Failed to parse GameData from debug.log' };
    }

    let sourceId: number;
    let targetId: number;

    if (actionSpec.triggerOn === 'send') {
      sourceId = letter.sender.id;
      targetId = letter.recipient.id;
    } else { // 'receive' or 'read'
      sourceId = letter.sender.id;
      targetId = letter.recipient.id;
    }

    // Pre-check
    if (action.preCheck) {
      const preCheckResult = action.preCheck(gameData, actionSpec.args, sourceId, targetId);
      if (!preCheckResult.success) {
        const message = `Action pre-check failed for "${actionSpec.signature}": ${preCheckResult.message}`;
        console.warn(`[LetterActionTrigger] ${message}`);
        return { success: false, message };
      }
    }

    let effectBody = '';
    const runGameEffect = (text: string) => {
      effectBody += text;
    };

    try {
      action.run(gameData, runGameEffect, actionSpec.args, sourceId, targetId);

      // Letter actions use dedicated global scope variables (message_first_scope /
      // message_second_scope_<letterName>) instead of the positional conversation list.
      const letterName = LetterActionTrigger.deriveLetterName(letter);
      ActionEffectWriter.appendLetterEffect(
        this.letterRunFileManager,
        sourceId,
        targetId,
        gameData.playerID,
        letterName,
        effectBody
      );

      // Trigger the event to process the run file, then clear it after the game
      // has had time to consume it (mirrors the conversation run file pattern).
      this.letterRunFileManager.append(`
        root = {trigger_event = mcc_event_v2.9003}
      `);
      setTimeout(() => {
        this.letterRunFileManager.clear();
        console.log('[LetterActionTrigger] Cleared votc_letter_actions.txt after trigger event.');
      }, 800);

      return { success: true };
    } catch (e) {
      const message = `Error running action "${actionSpec.signature}": ${e instanceof Error ? e.message : String(e)}`;
      console.error(`[LetterActionTrigger] ${message}`);
      return { success: false, message };
    }
  }
}
