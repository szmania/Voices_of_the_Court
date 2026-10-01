import { ApiConnection } from "../../shared/apiConnection";
import { Character } from "../../shared/gameData/Character";
import { Config } from "../../shared/Config";
import { GameData } from "../../shared/gameData/GameData";
import { Message } from "../ts/conversation_interfaces";
import { getEffectivePrompts } from "../conversation/promptBuilder";
import * as fs from "fs";
import * as path from "path";

export type BattleOutcome = "victory" | "defeat";
export type BattleSide = "attacker" | "defender";
type CommanderSide = "winner" | "loser";
type NotableBattleCharacterType = "slain_loser_side" | "slain_winner_side" | "captured_loser_side";

export interface BattleCommander {
    side: CommanderSide;
    id: string;
    name: string;
}

export interface NotableBattleCharacter {
    type: NotableBattleCharacterType;
    id: string;
    name: string;
}

export interface BattleSideResult {
    participantId: string;
    initialTroops: number;
    lostTroops: number;
    survivingTroops: number;
}

interface BattleReportData {
    slotId: string;
    legacySingleSlot?: boolean;
    playerId: string;
    date: string;
    location: string;
    terrain?: string;
    winter?: string;
    winnerId: string;
    winnerName: string;
    loserId: string;
    loserName: string;
    delayDays: number;
    percentEnemiesKilled?: number;
    totalTroops?: number;
    troopsRatio?: number;
    enemiesKilled?: number;
    result?: BattleOutcome;
    winningSide?: BattleSide;
    commanders: BattleCommander[];
    notableCharacters: NotableBattleCharacter[];
    tags: Set<string>;
}

const TAG_LABELS: Record<string, { zh: string; en: string }> = {
    wipe: {
        zh: "敌军被歼灭",
        en: "the defeated side was wiped out"
    },
    outnumbered_victory: {
        zh: "寡众取胜",
        en: "the winner prevailed while outnumbered"
    },
    devastating_losses: {
        zh: "败方损失惨重",
        en: "the defeated side suffered devastating losses"
    },
    heavy_enemy_losses: {
        zh: "胜方造成大量杀伤",
        en: "the winner inflicted heavy losses"
    },
    massive_battle: {
        zh: "大规模会战",
        en: "a massive battle"
    },
    major_battle: {
        zh: "重要战斗",
        en: "a major battle"
    },
    decisive_warscore: {
        zh: "对战争分数影响显著",
        en: "the battle strongly shifted the war score"
    },
    important_death: {
        zh: "重要人物阵亡",
        en: "an important character died"
    },
    important_capture: {
        zh: "重要人物被俘",
        en: "an important character was captured"
    }
};

const NOTABLE_CHARACTER_LABELS: Record<NotableBattleCharacterType, { zh: string; en: string }> = {
    slain_loser_side: {
        zh: "败方重要人物阵亡",
        en: "important figure slain on the losing side"
    },
    slain_winner_side: {
        zh: "胜方重要人物阵亡",
        en: "important figure slain on the winning side"
    },
    captured_loser_side: {
        zh: "败方重要人物被俘",
        en: "important figure captured from the losing side"
    }
};

export type BattleReportStatusType = 'pending' | 'fallback_written' | 'llm_completed' | 'error';

export interface BattleReportStatus {
    slotId: string;
    date: string;
    location: string;
    winnerName: string;
    loserName: string;
    result?: string;
    status: BattleReportStatusType;
    error?: string;
    timestamp: number;
}

const battleReportStatuses = new Map<string, BattleReportStatus>();

const battleReportInFlightSignatures = new Set<string>();
const battleReportCompletedSignatures = new Set<string>();
const latestBattleReportSignatureBySlot = new Map<string, string>();

export class BattleReportGenerator {
    private apiConnection: ApiConnection;
    private config: Config;
    private userDataPath: string;

    constructor(config: Config, userDataPath: string) {
        this.config = config;
        this.userDataPath = userDataPath;
        this.apiConnection = new ApiConnection(
            config.textGenerationApiConnectionConfig.connection,
            config.textGenerationApiConnectionConfig.parameters,
            null
        );
    }

    public getStatuses(): BattleReportStatus[] {
        return Array.from(battleReportStatuses.values());
    }

    public async generateBattleReport(gameData: GameData | undefined, debugLogPath: string, userFolderPath: string): Promise<string | null> {
        try {
            const latestBattlesBySlot = this.extractBattleReportData(debugLogPath);
            if (!latestBattlesBySlot.length) {
                console.error("Failed to extract battle report data");
                return null;
            }

            const pending = latestBattlesBySlot.filter(battleData => {
                const signature = this.getBattleSignature(battleData);
                return !battleReportCompletedSignatures.has(signature)
                    && !battleReportInFlightSignatures.has(signature);
            });

            if (!pending.length) {
                console.log("No new battle report data to process");
                return null;
            }

            for (const battleData of pending) {
                const signature = this.getBattleSignature(battleData);
                battleReportInFlightSignatures.add(signature);
                latestBattleReportSignatureBySlot.set(battleData.slotId, signature);
                battleReportStatuses.set(battleData.slotId, {
                    slotId: battleData.slotId, date: battleData.date, location: battleData.location,
                    winnerName: battleData.winnerName, loserName: battleData.loserName, result: battleData.result,
                    status: 'pending', timestamp: Date.now()
                });
            }

            let lastReport: string | null = null;

            try {
                for (const battleData of pending) {
                    const signature = this.getBattleSignature(battleData);
                    const fallbackReport = this.buildFallbackReport(battleData, gameData);
                    this.writeBattleReport(fallbackReport, userFolderPath, battleData);
                    battleReportStatuses.set(battleData.slotId, {
                        slotId: battleData.slotId, date: battleData.date, location: battleData.location,
                        winnerName: battleData.winnerName, loserName: battleData.loserName, result: battleData.result,
                        status: 'fallback_written', timestamp: Date.now()
                    });
                    battleReportCompletedSignatures.add(signature);
                    lastReport = fallbackReport;
                }
            } catch (error) {
                for (const battleData of pending) {
                    const signature = this.getBattleSignature(battleData);
                    if (!battleReportCompletedSignatures.has(signature)) {
                        battleReportInFlightSignatures.delete(signature);
                        if (latestBattleReportSignatureBySlot.get(battleData.slotId) === signature) {
                            latestBattleReportSignatureBySlot.delete(battleData.slotId);
                        }
                    }
                }
                throw error;
            } finally {
                for (const battleData of pending) {
                    battleReportInFlightSignatures.delete(this.getBattleSignature(battleData));
                }
            }

            for (const battleData of pending) {
                const signature = this.getBattleSignature(battleData);
                try {
                    const promptText = this.buildBattleReportPrompt(battleData, gameData);
                    console.log(`Generated battle report prompt for ${battleData.slotId}: ${promptText.substring(0, 200)}...`);

                    const messages: Message[] = [
                        {
                            role: "user",
                            content: promptText
                        }
                    ];

                    const response = await this.apiConnection.complete(messages, false, {
                        max_tokens: Math.min(this.config.maxTokens || 800, 900),
                        temperature: this.config.textGenerationApiConnectionConfig.parameters.temperature
                    });

                    const responseText = typeof response === 'string' ? response : (response?.content ?? '');
                    if (!responseText || responseText.trim() === "") {
                        console.warn(`Empty response from LLM for ${battleData.slotId}; keeping fallback report`);
                        continue;
                    }

                    if (latestBattleReportSignatureBySlot.get(battleData.slotId) !== signature) {
                        console.warn(`Skipping stale battle report overwrite for ${battleData.slotId}`);
                        continue;
                    }

                    const report = this.normalizeReport(responseText);
                    this.writeBattleReport(report, userFolderPath, battleData);
                    const existing = battleReportStatuses.get(battleData.slotId);
                    battleReportStatuses.set(battleData.slotId, {
                        ...existing, slotId: battleData.slotId, date: battleData.date, location: battleData.location,
                        winnerName: battleData.winnerName, loserName: battleData.loserName, result: battleData.result,
                        status: 'llm_completed', timestamp: Date.now()
                    });
                    console.log(`Generated battle report for ${battleData.slotId}: ${report.substring(0, 100)}...`);
                    lastReport = report;
                } catch (error) {
                    console.error(`Error improving battle report for ${battleData.slotId}: ${error}`);
                    const existingErr = battleReportStatuses.get(battleData.slotId);
                    battleReportStatuses.set(battleData.slotId, {
                        ...existingErr, slotId: battleData.slotId, date: battleData.date, location: battleData.location,
                        winnerName: battleData.winnerName, loserName: battleData.loserName, result: battleData.result,
                        status: 'error', error: String(error), timestamp: Date.now()
                    });
                }
            }

            return lastReport;
        } catch (error) {
            console.error(`Error generating battle report: ${error}`);
            return null;
        }
    }

    private extractBattleReportData(debugLogPath: string): BattleReportData[] {
        if (!fs.existsSync(debugLogPath)) {
            console.error(`Debug log file not found at: ${debugLogPath}`);
            return [];
        }

        const fileContent = fs.readFileSync(debugLogPath, "utf8");
        const lines = fileContent.split(/\r?\n/);
        const battles: BattleReportData[] = [];
        let currentBattleData: BattleReportData | null = null;

        for (const line of lines) {
            const commandIndex = line.indexOf("VOTC:BATTLE_REPORT/;/");
            if (commandIndex === -1) continue;

            const parts = line.substring(commandIndex).split("/;/").map(part => part.trim());
            const dataType = parts[1];

            switch (dataType) {
                case "init": {
                    if (currentBattleData) {
                        battles.push(currentBattleData);
                    }

                    const delayDays = this.parseNumber(parts[4]) ?? 30;
                    const slotId = parts[5] || "battle_report_1";
                    currentBattleData = {
                        slotId,
                        legacySingleSlot: !parts[5],
                        playerId: parts[2] || "",
                        date: parts[3] || "",
                        location: "",
                        winnerId: "",
                        winnerName: "",
                        loserId: "",
                        loserName: "",
                        delayDays,
                        commanders: [],
                        notableCharacters: [],
                        tags: new Set<string>()
                    };
                    break;
                }
                case "init_location":
                    if (!currentBattleData) break;
                    currentBattleData.location = this.cleanBattleLogText(parts[2]);
                    currentBattleData.terrain = this.cleanBattleLogText(parts[3]);
                    currentBattleData.winter = this.cleanBattleLogText(parts[4]);
                    break;
                case "init_winner":
                    if (!currentBattleData) break;
                    currentBattleData.winnerId = parts[2] || "";
                    currentBattleData.winnerName = this.cleanBattleLogText(parts[3]);
                    break;
                case "init_loser":
                    if (!currentBattleData) break;
                    currentBattleData.loserId = parts[2] || "";
                    currentBattleData.loserName = this.cleanBattleLogText(parts[3]);
                    break;
                case "stats":
                    if (!currentBattleData) break;
                    currentBattleData.percentEnemiesKilled = this.parseNumber(parts[2]);
                    currentBattleData.delayDays = this.parseNumber(parts[3]) ?? currentBattleData.delayDays;
                    break;
                case "troops":
                    if (!currentBattleData) break;
                    currentBattleData.totalTroops = this.parseNumber(parts[2]);
                    currentBattleData.troopsRatio = this.parseNumber(parts[3]);
                    currentBattleData.enemiesKilled = this.parseNumber(parts[4]);
                    break;
                case "result":
                    if (!currentBattleData) break;
                    if (parts[2] === "victory" || parts[2] === "defeat") {
                        currentBattleData.result = parts[2];
                    }
                    break;
                case "winning_side":
                    if (!currentBattleData) break;
                    if (parts[2] === "attacker" || parts[2] === "defender") {
                        currentBattleData.winningSide = parts[2];
                    }
                    break;
                case "commander":
                    if (!currentBattleData) break;
                    if ((parts[2] === "winner" || parts[2] === "loser") && parts[4]) {
                        currentBattleData.commanders.push({
                            side: parts[2],
                            id: parts[3] || "",
                            name: this.cleanBattleLogText(parts[4])
                        });
                    }
                    break;
                case "notable":
                    if (!currentBattleData) break;
                    if (this.isNotableBattleCharacterType(parts[2]) && parts[4]) {
                        currentBattleData.notableCharacters.push({
                            type: parts[2],
                            id: parts[3] || "",
                            name: this.cleanBattleLogText(parts[4])
                        });
                    }
                    break;
                case "tag":
                    if (!currentBattleData || !parts[2]) break;
                    currentBattleData.tags.add(parts[2]);
                    break;
            }
        }

        if (currentBattleData) {
            battles.push(currentBattleData);
        }

        if (!battles.length) {
            console.log("No VOTC:BATTLE_REPORT init entries found in debug.log");
            return [];
        }

        const latestBySlot = new Map<string, BattleReportData>();
        for (const battleData of battles) {
            latestBySlot.set(battleData.slotId, battleData);
        }

        const latestBattles = Array.from(latestBySlot.values());
        console.log(`Extracted ${latestBattles.length} latest battle report block(s) from ${battles.length} init block(s)`);
        return latestBattles;
    }

    private buildBattleReportPrompt(battleData: BattleReportData, gameData: GameData | undefined): string {
        const language = this.getOutputLanguage();
        const player = gameData?.characters.get(Number(battleData.playerId)) || gameData?.getPlayer();
        const playerName = this.getPlayerName(battleData, gameData, player);
        const winner = gameData?.characters.get(Number(battleData.winnerId));
        const loser = gameData?.characters.get(Number(battleData.loserId));
        const battlefield = this.getBattlefieldName(battleData);
        const winnerName = this.cleanBattleLogText(battleData.winnerName) || "unknown";
        const loserName = this.cleanBattleLogText(battleData.loserName) || "unknown";
        const tags = this.describeTags(battleData);
        const commanders = this.describeCommanders(battleData, this.config.language, gameData);
        const notableCharacters = this.describeNotableCharacters(battleData, this.config.language, gameData);
        const worldContext = this.describeWorldContext(gameData);
        const worldContextFact = worldContext ? `- Current broader game context: ${worldContext}\n` : "";
        const result = battleData.result === "victory"
            ? "This was a victory for the player."
            : battleData.result === "defeat"
                ? "This was a defeat for the player."
                : "The player's side is unknown.";
        const winningSide = battleData.winningSide ? `The winning side was the ${battleData.winningSide}.` : "The attacker/defender side is unknown.";
        const percentKilled = battleData.percentEnemiesKilled !== undefined
            ? `Game statistic: percent_enemies_killed from the winning side's perspective is about ${battleData.percentEnemiesKilled}%.`
            : "No exact casualty percentage was provided.";
        const troopsStat = this.describeTroops(battleData);
        const terrain = this.cleanBattleLogText(battleData.terrain) || "";
        const winter = this.cleanBattleLogText(battleData.winter) || "";
        const environmentFact = terrain || winter
            ? `- Terrain: ${terrain || "unknown"}${winter ? `; Winter: ${winter}` : ""}\n`
            : "";

        return `You are writing an in-game battle report for Crusader Kings III.

Output language: ${language}.

Facts:
- Player ruler: ${playerName}
- Battle date: ${battleData.date || gameData?.date || "unknown"}
- Battlefield: ${battlefield}
${environmentFact}- Winner: ${winnerName} (${battleData.winnerId || "unknown"})
- Loser: ${loserName} (${battleData.loserId || "unknown"})
- ${result}
- ${winningSide}
- ${percentKilled}
- ${troopsStat}
- Commanders: ${commanders}
- Important deaths or captures: ${notableCharacters}
- Notable tags: ${tags}
${worldContextFact}

Known character context:
- Player ruler: ${this.describeCharacterForPrompt(player, playerName)}
- Winner profile: ${this.describeCharacterForPrompt(winner, winnerName)}
- Loser profile: ${this.describeCharacterForPrompt(loser, loserName)}

${getEffectivePrompts(this.config, this.userDataPath, gameData!)?.battleReportPrompt || ""}`;
    }

    private buildFallbackReport(battleData: BattleReportData, gameData: GameData | undefined): string {
        const player = gameData?.characters.get(Number(battleData.playerId)) || gameData?.getPlayer();
        const playerName = this.getPlayerName(battleData, gameData, player);
        const battlefield = this.getBattlefieldName(battleData);
        const winnerName = this.cleanBattleLogText(battleData.winnerName) || (this.config.language === "en" ? "the winning host" : "胜方军队");
        const loserName = this.cleanBattleLogText(battleData.loserName) || (this.config.language === "en" ? "the opposing host" : "敌方军队");
        const playerClauseZh = playerName ? `${playerName}的宫廷收到军情：` : "宫廷收到军情：";
        const playerClauseEn = playerName ? `${playerName}'s court has received a military dispatch: ` : "A military dispatch has reached the court: ";
        const commanderTextZh = this.describeCommanders(battleData, "zh");
        const commanderTextEn = this.describeCommanders(battleData, "en");
        const tagsZh = this.describeTags(battleData, "zh");
        const tagsEn = this.describeTags(battleData, "en");

        if (this.config.language === "en") {
            const outcome = battleData.result === "victory" ? "This is counted as a victory for the player" : battleData.result === "defeat" ? "This is counted as a defeat for the player" : "The player's result is unclear";
            return `${playerClauseEn}at ${battlefield}, ${winnerName} defeated ${loserName}. ${outcome}. Commanders: ${commanderTextEn}. Notable circumstances: ${tagsEn}.`;
        }

        const outcome = battleData.result === "victory" ? "此战计为玩家一方的胜利" : battleData.result === "defeat" ? "此战计为玩家一方的失败" : "玩家一方的战果尚不明朗";
        return `${playerClauseZh}在${battlefield}，${winnerName}击败了${loserName}。${outcome}。统帅：${commanderTextZh}。战况要点：${tagsZh}。`;
    }

    private describeCommanders(battleData: BattleReportData, language = this.config.language, gameData?: GameData): string {
        if (battleData.commanders.length === 0) {
            return language === "en" ? "unknown" : "不明";
        }

        return battleData.commanders
            .map(commander => {
                const commanderProfile = this.describeCharacterForPrompt(
                    gameData?.characters.get(Number(commander.id)),
                    commander.name
                );
                if (language === "en") {
                    return commander.side === "winner"
                        ? `winner commander ${commanderProfile}`
                        : `loser commander ${commanderProfile}`;
                }
                return commander.side === "winner"
                    ? `胜方统帅${commanderProfile}`
                    : `败方统帅${commanderProfile}`;
            })
            .join(language === "en" ? "; " : "；");
    }

    private describeNotableCharacters(battleData: BattleReportData, language = this.config.language, gameData?: GameData): string {
        if (battleData.notableCharacters.length === 0) {
            return language === "en" ? "none reported" : "未报告";
        }

        return battleData.notableCharacters
            .map(character => {
                const label = NOTABLE_CHARACTER_LABELS[character.type]?.[language === "en" ? "en" : (language === "zh" ? "zh" : "en")] || character.type;
                const profile = this.describeCharacterForPrompt(
                    gameData?.characters.get(Number(character.id)),
                    character.name
                );

                return language === "en"
                    ? `${label}: ${profile}`
                    : `${label}：${profile}`;
            })
            .join(language === "en" ? "; " : "；");
    }

    private describeCharacterForPrompt(character: Character | undefined, fallbackName: string): string {
        const name = character?.fullName || fallbackName || "unknown";
        if (!character) {
            return name;
        }

        const details: string[] = [];
        if (character.primaryTitle) details.push(`title: ${character.primaryTitle}`);
        if (Number.isFinite(character.age) && character.age > 0) details.push(`age: ${character.age}`);
        if (character.culture) details.push(`culture: ${character.culture}`);
        if (character.faith) details.push(`faith: ${character.faith}`);
        if (character.house) details.push(`house: ${character.house}`);
        if (character.capitalLocation) details.push(`capital: ${character.capitalLocation}`);
        if (character.titleRankConcept) details.push(`rank: ${character.titleRankConcept}`);
        if (character.personality) details.push(`personality: ${character.personality}`);
        if (Number.isFinite(character.prowess) && character.prowess > 0) details.push(`prowess: ${character.prowess}`);
        if (character.isIndependentRuler) details.push("independent ruler");
        else if (character.liege) details.push(`liege: ${character.liege}`);
        if (character.topLiege && character.topLiege !== character.liege) details.push(`top liege: ${character.topLiege}`);

        const traits = character.traits
            .map(trait => trait.name)
            .filter(Boolean)
            .slice(0, 8);
        if (traits.length) details.push(`traits: ${traits.join(", ")}`);

        return details.length ? `${name} (${details.join("; ")})` : name;
    }

    private describeWorldContext(gameData: GameData | undefined): string | undefined {
        if (!gameData) {
            return undefined;
        }

        const details: string[] = [];
        if (this.cleanBattleLogText(gameData.date)) details.push(`current date: ${gameData.date}`);
        if (this.cleanBattleLogText(gameData.location)) details.push(`current player/scene location: ${gameData.location}`);
        if (this.cleanBattleLogText(gameData.locationController)) details.push(`location controller: ${gameData.locationController}`);
        if (this.cleanBattleLogText(gameData.scene)) details.push(`current scene: ${gameData.scene}`);

        return details.length ? details.join("; ") : undefined;
    }

    private describeTags(battleData: BattleReportData, language = this.config.language): string {
        if (battleData.tags.size === 0) {
            return language === "en" ? "none" : "无";
        }

        return Array.from(battleData.tags)
            .map(tag => TAG_LABELS[tag]?.[language === "en" ? "en" : (language === "zh" ? "zh" : "en")] || tag)
            .join(language === "en" ? "; " : "；");
    }

    private writeBattleReport(reportContent: string, userFolderPath: string, battleData: BattleReportData): void {
        const runFolderPath = path.join(userFolderPath, "run");
        if (!fs.existsSync(runFolderPath)) {
            fs.mkdirSync(runFolderPath, { recursive: true });
            console.log(`Created run folder at: ${runFolderPath}`);
        }

        const slotNumber = this.getSlotNumber(battleData.slotId);
        const battleReportFilePath = path.join(runFolderPath, `battle_report${slotNumber}.txt`);
        const escapedReport = this.escapeForCk3Script(reportContent);
        const gameCommand = `send_interface_message = {
	type = votc_message_popup
	title = votc_battle_report_message_title
	desc = "${escapedReport}"
}
create_artifact = {
	name = votc_battle_report_message_title
	description = "${escapedReport}"
	type = journal
	visuals = scroll
	creator = root
	modifier = artifact_monthly_minor_prestige_1_modifier
}
remove_global_variable ?= votc_battle_report_${slotNumber}
remove_variable ?= votc_battle_report_${slotNumber}_timer
remove_variable ?= votc_battle_report_${slotNumber}_sent_day
remove_global_variable ?= votc_battle_report_pending
remove_global_variable ?= votc_battle_report_pending_valid`;

        fs.writeFileSync(battleReportFilePath, gameCommand, "utf8");
        console.log(`Battle report written to: ${battleReportFilePath}`);

        if (battleData.legacySingleSlot) {
            const legacyBattleReportFilePath = path.join(runFolderPath, "battle_report.txt");
            fs.writeFileSync(legacyBattleReportFilePath, gameCommand, "utf8");
            console.log(`Legacy battle report written to: ${legacyBattleReportFilePath}`);
        }
    }

    private normalizeReport(text: string): string {
        return text.trim()
            .replace(/^["“”]+/, "")
            .replace(/["“”]+$/, "")
            .replace(/\\n|\/n|\r?\n/g, " ")
            .replace(/\s{2,}/g, " ");
    }

    private escapeForCk3Script(text: string): string {
        return text
            .replace(/\\(?!n)/g, "/")
            .replace(/"/g, "“")
            .replace(/'/g, "’")
            .replace(/#/g, "＃")
            .replace(/\r?\n/g, "\\n");
    }

    private getOutputLanguage(): string {
        const map: Record<string, string> = {
            en: "English", zh: "Simplified Chinese", ru: "Russian",
            fr: "French", es: "Spanish", de: "German",
            ja: "Japanese", ko: "Korean", pl: "Polish",
            pt: "Portuguese", tr: "Turkish"
        };
        return map[this.config.language] || "English";
    }

    private getBattleSignature(battleData: BattleReportData): string {
        return [
            battleData.slotId,
            battleData.playerId,
            battleData.date,
            battleData.location,
            battleData.winnerId,
            battleData.loserId,
            Array.from(battleData.tags).sort().join(","),
            battleData.notableCharacters
                .map(character => `${character.type}:${character.id}:${character.name}`)
                .sort()
                .join(",")
        ].join("|");
    }

    private getSlotNumber(slotId: string): string {
        const slotNumber = slotId.replace("battle_report_", "");
        return /^\d+$/.test(slotNumber) ? slotNumber : "1";
    }

    private describeTroops(battleData: BattleReportData): string {
        const { totalTroops, troopsRatio, enemiesKilled } = battleData;
        const parts: string[] = [];
        if (totalTroops !== undefined) {
            parts.push(`Total troops engaged: ~${totalTroops}`);
        }
        if (totalTroops !== undefined && troopsRatio !== undefined && troopsRatio > 0) {
            const winnerTroops = Math.round(totalTroops * troopsRatio / (1 + troopsRatio));
            const loserTroops = Math.round(totalTroops / (1 + troopsRatio));
            parts.push(`Winner troops (estimated): ~${winnerTroops}`);
            parts.push(`Loser troops (estimated): ~${loserTroops}`);
            parts.push(`Troops ratio (winner/loser): ${troopsRatio}`);
        }
        if (enemiesKilled !== undefined) {
            parts.push(`Enemy troops killed: ~${enemiesKilled}`);
        }
        return parts.length ? parts.join("; ") : "No exact troop figures were provided.";
    }

    private parseNumber(value: string | undefined): number | undefined {
        if (value === undefined) return undefined;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }

    private getPlayerName(battleData: BattleReportData, gameData: GameData | undefined, player: Character | undefined): string {
        const gameName = this.cleanBattleLogText(player?.fullName)
            || this.cleanBattleLogText(player?.shortName)
            || this.cleanBattleLogText(gameData?.playerName);
        if (gameName) {
            return gameName;
        }

        const winnerName = this.cleanBattleLogText(battleData.winnerName);
        const loserName = this.cleanBattleLogText(battleData.loserName);
        if (battleData.playerId && battleData.playerId === battleData.winnerId && winnerName) {
            return winnerName;
        }
        if (battleData.playerId && battleData.playerId === battleData.loserId && loserName) {
            return loserName;
        }
        if (battleData.result === "victory" && winnerName) {
            return winnerName;
        }
        if (battleData.result === "defeat" && loserName) {
            return loserName;
        }

        return battleData.playerId ? `character ${battleData.playerId}` : "unknown";
    }

    private getBattlefieldName(battleData: BattleReportData): string {
        return this.cleanBattleLogText(battleData.location)
            || (this.config.language === "en" ? "an unknown battlefield" : "未知战场");
    }

    private cleanBattleLogText(value: string | undefined): string {
        if (!value) return "";

        const cleaned = value.trim();
        if (!cleaned || /^(none|null|undefined)$/i.test(cleaned)) {
            return "";
        }

        return cleaned;
    }

    private isNotableBattleCharacterType(value: string | undefined): value is NotableBattleCharacterType {
        return value === "slain_loser_side"
            || value === "slain_winner_side"
            || value === "captured_loser_side";
    }
}
