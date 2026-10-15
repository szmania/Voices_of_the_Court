import { GameData } from "../../shared/gameData/GameData";

export interface Message {
    id?: string;
    role: 'system' | 'user' | 'assistant';
    name?: string,
    content: string ;
    narrative?: string; // Narrative property
    characterId?: number;
    actions?: ActionResponse[];
}


export interface ErrorMessage {
    text: string,
}

export interface MessageChunk {
    role?: 'system' | 'user' | 'assistant' | 'tool';
    content?: string | null | undefined;
    isFinal?: boolean;
    special?: any;
}

export interface Preset {
    systemPrompt: string;
    inputSequence: string;
    outputSequence: string;
}

export interface Setting {
    mainPrompt: string,
    inputSequence: string,
    outputSequence: string,
    parameters: Object;
}

export interface Summary{
    date: string,
    content: string,
    /** Timeline v2 protocol: checkpoint epoch / node id stamped on summaries written after a close. */
    votcCheckpointEpoch?: number,
    votcTimelineNodeId?: string,
    /** Timeline v2 protocol: parent node id of the branch the summary belongs to. */
    votcTimelineParentId?: string,
    /** Campaign lineage stamp for campaign-scoped summary stores. */
    votcCampaignId?: string,
    characterId?: string,
    /** Stable summary id (also the merge key for timeline-aware saves). */
    id?: string,
    /** Display name of the character the summary belongs to. */
    characterName?: string,
    /** Source flow that produced the summary (incoming letters stamp their topic in sourceRecordId's record). */
    sourceType?: 'conversation' | 'letter' | 'incoming_letter' | 'battle_report',
    sourceRecordId?: string,
    gameDate?: import("../../shared/gameData/gameDate").Ck3GameDate
}

export interface ActionArgument{
    name: string;
    type: string;
    desc: string
}

export interface Action{
    signature: string,
    args: ActionArgument[],
    description: string,
    creator?: string,
    check: (gameData: GameData, sourceId: number, targetId: number) => boolean,
    preCheck?: (gameData: GameData, args: string[], sourceId: number, targetId: number) => { success: boolean, message?: string },
    run: (gameData: GameData, runGameEffect: (effect: string) => void, args: string[], sourceId: number, targetId: number) => void,
    chatMessage: (args: string[]) => any,
    chatMessageClass: string
}

export interface ActionResponse{
    actionName: string,
    chatMessage: string,
    chatMessageClass: string
}

export interface PendingAction {
    action: Action;
    args: string[];
    sourceId: number;
    targetId: number;
}
