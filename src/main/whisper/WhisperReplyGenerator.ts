import { ApiConnection } from "../../shared/apiConnection.js";
import { Tiktoken } from "js-tiktoken";
import { GameData } from "../../shared/gameData/GameData.js";
import { Character } from "../../shared/gameData/Character.js";
import { Config } from "../../shared/Config.js";
import { getEffectivePrompts, getPromptsConfig } from "../conversation/promptBuilder.js";
import { RunFileManager } from "../RunFileManager.js";
import * as fs from "fs";
import { randomUUID } from "crypto";
import { saveWhisperSection, type WhisperRecord } from "./whisperManager.js";

/**
 * Whisper Ledger ("The Whisper Ledger", VOTC-195) app-side support.
 *
 * The mod sends one request per report section through the dedicated whisper
 * channel (protocol v2, 2026-10-16) — every separator is the 3-char "/;/":
 *
 *   VOTC:WHISPER/;<n>|<SECTION>/;<dateAsTotalDays>/;/
 *
 * Older mods (protocol v1) masqueraded the request as an ordinary VOTC:LETTER
 * line with letterId `whisper`:
 *
 *   VOTC:LETTER/;/VOTC_WHISPER_REQUEST_<3|6|12>|<WORLD|REALM|COURT|CIRCLE>/;/whisper/;/<dateAsTotalDays>/;/0/;/
 *
 * Both shapes are accepted (see parseWhisperRequestLine). Replies are written
 * artifact-creation script that fires votc_whisper.30. See .cecli.plans.md §2
 * for the frozen mod-side contract.
 */

export type WhisperSection = 'WORLD' | 'REALM' | 'COURT' | 'CIRCLE';

export interface WhisperRequestInfo {
    /** Cadence code from the request line (3 | 6 | 12). */
    cadenceCode: 3 | 6 | 12;
    /** Cadence window in game days (91 / 182 / 365). */
    cadenceDays: number;
    section: WhisperSection;
    /** The request line's game date as total days; 0 when missing/invalid. */

    requestTotalDays: number;
    /**
     * Per-request nonce (votc_whisper_req_id) from the payload line's trailing
     * field. 0 when absent (older mods). The reply script consumes it so a
     * stale run file re-executed by the ~2s poller is a no-op.
     */
    requestId: number;
}

const CADENCE_DAYS: Record<number, number> = { 3: 91, 6: 182, 12: 365 };

/** heldCourtAndCouncilPositions value the mod stamps material characters with, per section. */
const SECTION_CHARACTER_LABEL: Record<WhisperSection, string> = {
    WORLD: 'whisper_foreign',
    REALM: 'whisper_realm',
    COURT: 'whisper_court',
    CIRCLE: 'whisper_circle'
};

// ponytail: section label/focus are English; the localized whisperPrompt template
// pins the reply language via {{language}}. Upgrade path: per-language maps here.
const SECTION_METADATA: Record<WhisperSection, { label: string; focus: string }> = {
    WORLD: {
        label: 'Distant Lands',
        focus: 'Cover distant courts and wars beyond the realm: foreign rulers, their schemes and marriages, and the wars that shape far-off lands.'
    },
    REALM: {
        label: 'The Realm',
        focus: "Cover the player's realm: its dukes and counts, the factions forming against the crown, and the internal politics of the realm."
    },
    COURT: {
        label: 'Your Court',
        focus: "Cover the courtiers and councillors at the player's side: their ambitions, grudges and quiet maneuvering."
    },
    CIRCLE: {
        label: 'Inner Circle',
        focus: 'Cover family, lovers, rivals and pinned characters: the personal bonds, debts and betrayals closest to the player.'
    }
};

/**
 * Parses a raw debug.log line into a whisper request. Returns undefined for
 * ordinary letter lines and malformed whisper lines.
 */
export function parseWhisperRequestLine(line: string): WhisperRequestInfo | undefined {
    // Protocol v2: the dedicated VOTC:WHISPER channel. Line shape (every
    // separator is the 3-char "/;/"):
    //   VOTC:WHISPER/;<n>|<SECTION>/;<dateAsTotalDays>/;/
    // Receipt lines (VOTC:WHISPER/;/took_section|request_written|no_artifact)
    // never match the request regex, so they parse as undefined.
    const whisperIndex = line.indexOf('VOTC:WHISPER');
    if (whisperIndex !== -1) {
        const parts = line.substring(whisperIndex + 'VOTC:WHISPER'.length).split('/;/').slice(1);
        const match = /^(3|6|12)\|(WORLD|REALM|COURT|CIRCLE)$/.exec((parts[0] ?? '').trim());
        if (!match) return undefined;
        const cadenceCode = Number(match[1]) as 3 | 6 | 12;
        const requestTotalDays = Number((parts[1] ?? '').trim());
        // Trailing nonce field (parts[2]); absent on older mods -> 0.
        const requestId = Number((parts[2] ?? '').trim());
        return {
            cadenceCode,
            cadenceDays: CADENCE_DAYS[cadenceCode],
            section: match[2] as WhisperSection,
            requestTotalDays: Number.isFinite(requestTotalDays) && requestTotalDays > 0 ? requestTotalDays : 0,
            requestId: Number.isInteger(requestId) && requestId > 0 ? requestId : 0
        };
    }
    // Legacy (protocol v1): whisper requests masqueraded as VOTC:LETTER lines
    // with letterId "whisper". Kept so older mods keep working (plan step 14).
    const markerIndex = line.indexOf('VOTC:LETTER');
    if (markerIndex === -1) return undefined;
    const parts = line.substring(markerIndex + 'VOTC:LETTER'.length).split('/;/').slice(1);
    if (parts.length < 3) return undefined;
    if (parts[1].trim() !== 'whisper') return undefined;
    const match = /VOTC_WHISPER_REQUEST_(3|6|12)\|(WORLD|REALM|COURT|CIRCLE)/.exec(parts[0].trim());
    if (!match) return undefined;
    const cadenceCode = Number(match[1]) as 3 | 6 | 12;
    const requestTotalDays = Number(parts[2].trim());
    return {
        cadenceCode,
        cadenceDays: CADENCE_DAYS[cadenceCode],
        section: match[2] as WhisperSection,
        requestTotalDays: Number.isFinite(requestTotalDays) && requestTotalDays > 0 ? requestTotalDays : 0,
        // Legacy v1 lines carry no nonce; the guard degrades to unguarded.
        requestId: 0
    };
}

/**
 * Scans the newest ~1MB of the game log newest-first and returns the first
 * line that parses as a whisper request (either protocol shape). Receipts
 * never parse as requests, and the mod logs VOTC:WHISPER/;/request_written
 * AFTER the payload line, so a single "newest prefixed line" read would
 * return a receipt and miss the request (plan step 14).
 */
export async function detectWhisperRequestFromLog(debugLogPath: string): Promise<WhisperRequestInfo | undefined> {
    const CHUNK_SIZE = 1024 * 1024; // 1MB — enough for the re-logged whisper material
    let handle;
    try {
        handle = await fs.promises.open(debugLogPath, 'r');
        const { size } = await handle.stat();
        const position = Math.max(0, size - CHUNK_SIZE);
        const buffer = Buffer.alloc(size - position);
        await handle.read(buffer, 0, buffer.length, position);
        const lines = buffer.toString('utf8').split(/\r?\n/);
        for (let i = lines.length - 1; i >= 0; i--) {
            const request = parseWhisperRequestLine(lines[i]);
            if (request) return request;
        }
        return undefined;
    } catch (error) {
        console.warn(`[WhisperReplyGenerator] Could not scan the game log for a whisper request: ${error}`);
        return undefined;
    } finally {
        if (handle) await handle.close();
    }
}

/**
 * Resets run/votc_ce_whisper.txt to the blank heartbeat placeholder. The mod's
 * runner re-executes the file every ~2s indefinitely, so once a section has been
 * taken the file must be reset or every pass would create a fresh artifact and
 * re-fire votc_whisper.30. It is reset to the placeholder rather than emptied:
 * an empty (or BOM-only) file makes the CK3 lexer log
 * `console_failure: Effect is empty` on every beat, spamming debug.log for the
 * whole round trip. The placeholder is a harmless effect the runner can
 * re-execute safely, and is byte-identical to the startup seed in main.ts.
 */
export function clearWhisperRunFile(config: Config): void {
    if (!config || !config.userFolderPath) return;
    new RunFileManager(config.userFolderPath, 'votc_ce_whisper.txt')
        .write("debug_log = \"[Localize('talk_event.9999.desc')]\"");
}

export class WhisperReplyGenerator {
    private apiConnection: ApiConnection;
    private config: Config;
    private votcDataPath: string;

    constructor(config: Config, votcDataPath: string, encoder: Tiktoken | null) {
        this.config = config;
        this.votcDataPath = votcDataPath;
        this.apiConnection = new ApiConnection(
            config.textGenerationApiConnectionConfig.connection,
            config.textGenerationApiConnectionConfig.parameters,
            encoder
        );
    }

    /**
     * Generates the section report for the given whisper request and writes the
     * reply script to run/votc_ce_whisper.txt. Returns true when a reply was written.
     * On empty/failed generation nothing is written (the mod self-heals).
     */
    public async generateAndDeliverWhisperReply(gameData: GameData, request: WhisperRequestInfo): Promise<boolean> {
        const sectionMeta = SECTION_METADATA[request.section];
        const characterLabel = SECTION_CHARACTER_LABEL[request.section];

        // 1. Material characters: the mod stamps every logged character's
        // heldCourtAndCouncilPositions with the section's category label.
        const characters = Array.from(gameData.characters.values())
            .filter(c => c.heldCourtAndCouncilPositions === characterLabel);
        console.log(`[WhisperReplyGenerator] Section ${request.section}: ${characters.length} material character(s) selected via "${characterLabel}".`);

        // 2. Memories narrowed to the cadence window against the request's own
        // date field (the whisper init line carries no v2 date-extra block).
        const windowStart = request.requestTotalDays > 0 ? request.requestTotalDays - request.cadenceDays : 0;
        const memoryLines = this.buildMemoryLines(characters, windowStart);

        // 3. Prompt from the whisperPrompt key (plain {{var}} templates).
        const prompt = this.buildPrompt(gameData, request, sectionMeta, characters, memoryLines);
        if (!prompt) return false;

        // 4. Generate.
        const maxTokens = this.config.whisperMaxTokens ?? this.config.maxTokens;
        console.log(`[WhisperReplyGenerator] Generating ${request.section} section (cadence ${request.cadenceDays}d, maxTokens ${maxTokens}).`);
        const result = await this.apiConnection.complete([{ role: 'user', content: prompt }], false, { max_tokens: maxTokens });
        const reply = typeof result === 'string' ? result : ((result as any)?.content ?? '');
        if (!reply || !reply.trim()) {
            console.warn(`[WhisperReplyGenerator] Empty response for ${request.section} section; writing nothing (the mod self-heals).`);
            return false;
        }

        // 5. Persist the generated section for the Whispers tab. Never block
        // delivery on a save failure — the reply must reach the game regardless.
        try {
            const record: WhisperRecord = {
                id: randomUUID(),
                playerId: String(gameData.playerID),
                section: request.section,
                sectionLabel: sectionMeta.label,
                cadenceDays: request.cadenceDays,
                gameDateTotalDays: request.requestTotalDays,
                gameDate: gameData.date,
                realDate: new Date().toISOString(),
                text: reply.trim(),
                materialCharacters: characters.map(c => ({ id: c.id, name: c.fullName }))
            };
            saveWhisperSection(record.playerId, record);
        } catch (error) {
            console.error('[WhisperReplyGenerator] Failed to persist whisper section (delivery continues):', error);
        }

        // 6. Deliver through the dedicated whisper channel.
        this.deliverWhisperReply(reply.trim(), request.requestId);
        return true;
    }

    /** One line per windowed memory, prefixed with the remembering character. */
    private buildMemoryLines(characters: Character[], windowStartDays: number): string {
        const lines: string[] = [];
        for (const character of characters) {
            for (const memory of character.memories) {
                // Memories without a parsable creation day cannot be windowed; the
                // mod pre-filters whisper memories to memory_age_years < 1, so keep them.
                if (windowStartDays > 0 && memory.creationTotalDays !== undefined && memory.creationTotalDays < windowStartDays) {
                    continue;
                }
                lines.push(`- ${character.shortName || character.fullName}: ${memory.desc} (${memory.creationDate})`);
            }
        }
        return lines.join('\n');
    }

    private buildPrompt(gameData: GameData, request: WhisperRequestInfo, sectionMeta: { label: string; focus: string }, characters: Character[], memoryLines: string): string | null {
        const prompts = getEffectivePrompts(this.config, this.votcDataPath, gameData);
        let template = prompts?.whisperPrompt;
        if (!template) {
            console.warn('[WhisperReplyGenerator] whisperPrompt not found for the active language/preset; falling back to the English default.');
            template = getPromptsConfig(this.votcDataPath, 'en')?.prompts?.whisperPrompt;
        }
        if (!template) {
            console.error('[WhisperReplyGenerator] No whisperPrompt available; aborting whisper reply.');
            return null;
        }

        const characterBlock = characters.length > 0
            ? characters.map(c => this.describeCharacter(c)).join('\n')
            : '(no notable people were logged for this section)';

        return template
            .replace(/{{whisperSectionLabel}}/g, sectionMeta.label)
            .replace(/{{whisperSection}}/g, sectionMeta.focus)
            .replace(/{{whisperCadenceDays}}/g, String(request.cadenceDays))
            .replace(/{{whisperCharacters}}/g, characterBlock)
            .replace(/{{whisperMemories}}/g, memoryLines || '(no recent whispers were recorded)')
            .replace(/{{playerName}}/g, gameData.playerName || '')
            .replace(/{{language}}/g, this.config.language || 'en');
    }

    private describeCharacter(character: Character): string {
        const parts: string[] = [character.fullName || character.shortName];
        if (character.primaryTitle && character.primaryTitle !== 'None') parts.push(character.primaryTitle);
        if (character.age > 0) parts.push(`age ${character.age}`);
        if (character.culture) parts.push(`culture ${character.culture}`);
        if (character.faith) parts.push(`faith ${character.faith}`);
        if (character.personality) parts.push(character.personality);
        const relations = character.relationsToPlayer.filter(Boolean).join(', ');
        return `- ${parts.join(', ')}${relations ? ` (relation to you: ${relations})` : ''}`;
    }

    /**
     * Composes and writes the whisper reply script to run/votc_ce_whisper.txt,
     * mirroring the gameCommand built in LetterManager.deliverLetter but with
     * the whisper-specific guard, artifact name and intake event (plan §2.2):
     * no letter-thread variables, no timeline block, no message_event.362.
     *
     * When the request carries a nonce (requestId > 0, protocol v2) the whole
     * body is wrapped in a votc_whisper_consumed_id guard: the first execution
     * consumes the nonce and every re-execution by the ~2s runner is a no-op,
     * race-proof even if the receipt-driven clear loses the race. Legacy v1
     * requests (requestId 0) keep the unguarded body.
     */
    private deliverWhisperReply(replyText: string, requestId: number): void {
        if (!this.config.userFolderPath) {
            console.error('[WhisperReplyGenerator] Cannot deliver whisper reply, user folder path is not set.');
            return;
        }

        // Same escaping as deliverLetter: backslashes and quotes.
        const escapedReply = replyText.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

        const gameCommand = `remove_global_variable ?= votc_whisper
create_artifact = {
\tname = votc_whisper_latest
\tdescription = "${escapedReply}"
\ttype = journal
\tvisuals = scroll
\tcreator = global_var:message_second_scope_whisper
\tmodifier = artifact_monthly_minor_prestige_1_modifier
\twealth = 0
\tsave_scope_as = votc_latest_whisper
}
if = {
\tlimit = { exists = scope:votc_latest_whisper }
\tscope:votc_latest_whisper = {
\t\tset_variable = { 
\t\t\tname = votc_letter_artifact 
\t\t\tvalue = yes 
\t\t}
\t}
\tset_global_variable = {
\t\tname = votc_whisper_latest
\t\tvalue = scope:votc_latest_whisper
\t}
}
trigger_event = votc_whisper.30`;

        // Nonce guard (protocol v2): consume-once. requestId 0 (legacy v1)
        // degrades to the unguarded body - a shared 0 value would block the
        // NEXT legacy request after the first consume.
        const guardedCommand = requestId > 0
            ? `if = {
\tlimit = { 
\t\tNOT = { 
\t\t\tglobal_var:votc_whisper_consumed_id = ${requestId} 
\t\t} 
\t}
${gameCommand.replace(/^/gm, '\t')}
\tset_global_variable = { 
\t\tname = votc_whisper_consumed_id 
\t\tvalue = ${requestId} 
\t}
}`
            : gameCommand;

        const runFileManager = new RunFileManager(this.config.userFolderPath, 'votc_ce_whisper.txt');
        runFileManager.write(guardedCommand);
        console.log('[WhisperReplyGenerator] Whisper reply written to run/votc_ce_whisper.txt.');
    }
}
