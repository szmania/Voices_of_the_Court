import type { GameData } from '../../shared/gameData/GameData';

/**
 * Shared NPC-letter session skeleton (M7 of the VOTC-194 merge plan): the
 * orchestration steps common to every NPC-initiated letter mode — the npcltr
 * opening flow (main.ts handleNpcLetterInitiation) and the incoming-letter
 * generator (VOTC:INCOMING_LETTER handler). The session refreshes the app's
 * game-date tracker from the session snapshot (when the mode has one),
 * refreshes the Letters UI around the mode-specific work, and contains work
 * failures so a failed session never leaves the UI stale. Per-mode
 * differences (motivation source, run channel, persistence) stay explicit at
 * the call site via the `work` callback.
 */
export interface NpcLetterSessionContext {
    /** Update the app's game-date tracker from the session snapshot. */
    updateDateFromSnapshot?(gameData: GameData): void;
    /** Broadcast a Letters-tab refresh to the renderer windows. */
    refreshLettersUi(): void;
}

export async function runNpcLetterSession<T>(
    gameData: GameData | undefined,
    context: NpcLetterSessionContext,
    work: () => Promise<T>
): Promise<T | null> {
    if (gameData) {
        context.updateDateFromSnapshot?.(gameData);
    }
    context.refreshLettersUi();
    try {
        const result = await work();
        context.refreshLettersUi();
        return result;
    } catch (error) {
        console.error('[npcLetterSession] NPC letter session failed:', error);
        context.refreshLettersUi();
        return null;
    }
}