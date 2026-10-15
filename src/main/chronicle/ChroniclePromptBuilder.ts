import { formatCk3GameDate } from '../../shared/gameData/gameDate.js';
import type { Ck3GameDate } from '../../shared/gameData/gameDate.js';
import type {
    ChronicleSelectedSource,
    ChronicleSourceRecord
} from './chronicleTypes.js';

export const DEFAULT_CHRONICLE_PROMPT =
    '你是宫廷史官，正在为{{playerName}}撰写{{periodStart}}至{{periodEnd}}的编年史。\n' +
    '\n' +
    '请严格依据下方起居来源，将本期发生的事情整理为连贯、克制的史书正文。\n' +
    '\n' +
    '要求：\n' +
    '1. 使用第三人称，以编年体或本纪风格书写。\n' +
    '2. 优先记录重要会谈、角色记忆所确认的经历、政令、承诺、冲突、信件、战争与明确后果。\n' +
    '3. 角色记忆是背景事实，不代表该角色在本期对话中亲口讲述；不得把他人的私密记忆写成宫廷公认事实，除非其他来源也予以证实。\n' +
    '4. 可压缩寒暄和重复内容，但不得改变人物立场。\n' +
    '5. 不得编造来源中没有出现的动机、秘密、行动、数字、胜负或后果。\n' +
    '6. 来源互相矛盾时，用"据某人所言""双方各执一词"等方式保留不确定性。\n' +
    '7. 不提及 VOTC、后端、模型、prompt、数据、对话记录、角色记忆字段或摘要。\n' +
    '8. 不逐条罗列来源，不使用 Markdown 标题或项目符号。\n' +
    '9. 输出二至六段正文，不要前言、解释或写作说明。\n';

const RECENT_CHRONICLES_MAX_CHARS = 3000;
const RECENT_CHRONICLES_MAX_ENTRIES = 5;

export function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function assertMemoryFrozen(record: ChronicleSourceRecord): void {
    if (record.kind === 'character_memory' && record.memoryTextFrozen !== true) {
        throw new Error(
            `chronicle prompt builder: memory source ${record.id} is not frozen (memoryTextFrozen !== true); refusing to build prompt`
        );
    }
}

export function formatChronicleSourceTag(source: ChronicleSelectedSource): string {
    const { record, text } = source;
    const dateAttr = record.gameDate ? formatCk3GameDate(record.gameDate) : '';
    const datePart = dateAttr ? ` date="${escapeXml(dateAttr)}"` : '';
    return (
        `<chronicle_source` +
        ` kind="${escapeXml(record.kind)}"` +
        datePart +
        `>\n` +
        escapeXml(text) +
        `\n</chronicle_source>`
    );
}

export function formatCharacterMemoriesSection(
    memorySources: ChronicleSelectedSource[],
    periodStart: Ck3GameDate,
    periodEnd: Ck3GameDate
): string {
    const period = `${escapeXml(formatCk3GameDate(periodStart))}--${escapeXml(formatCk3GameDate(periodEnd))}`;
    const lines: string[] = [`<character_memories period="${period}">`];
    for (const source of memorySources) {
        assertMemoryFrozen(source.record);
        const { record, text } = source;
        const dateAttr = record.gameDate ? escapeXml(formatCk3GameDate(record.gameDate)) : '';
        const datePart = dateAttr ? ` date="${dateAttr}"` : '';
        lines.push(
            `  <memory${datePart}>` +
            escapeXml(text) +
            `</memory>`
        );
    }
    lines.push('</character_memories>');
    return lines.join('\n');
}

export interface PreviousChronicleRef {
    periodStart: Ck3GameDate;
    periodEnd: Ck3GameDate;
    content: string;
}

export interface BuildChroniclePromptParams {
    promptTemplate: string;
    playerName: string;
    periodStart: Ck3GameDate;
    periodEnd: Ck3GameDate;
    sources: ChronicleSelectedSource[];
    previousChronicleEntries?: PreviousChronicleRef[];
}

function formatRecentChronicles(entries: PreviousChronicleRef[]): string {
    const sorted = [...entries]
        .sort((a, b) => b.periodEnd.totalDays - a.periodEnd.totalDays)
        .slice(0, RECENT_CHRONICLES_MAX_ENTRIES);
    const blocks = sorted.map(entry => {
        const startStr = formatCk3GameDate(entry.periodStart);
        const endStr = formatCk3GameDate(entry.periodEnd);
        return `〔${startStr} 至 ${endStr}〕\n${entry.content}`;
    });
    let joined = blocks.join('\n\n');
    if (joined.length > RECENT_CHRONICLES_MAX_CHARS) {
        joined = joined.slice(0, RECENT_CHRONICLES_MAX_CHARS);
    }
    return (
        `<recent_chronicles>\n${escapeXml(joined)}\n</recent_chronicles>\n` +
        '（以上为近期编年史，仅作风格与连续性参考；不得重复其中已记之事。）'
    );
}

export function buildChroniclePrompt(params: BuildChroniclePromptParams): string {
    const {
        promptTemplate,
        playerName,
        periodStart,
        periodEnd,
        sources,
        previousChronicleEntries
    } = params;

    for (const source of sources) {
        assertMemoryFrozen(source.record);
    }

    const systemPrompt = promptTemplate
        .replace(/\{\{playerName\}\}/g, playerName)
        .replace(/\{\{periodStart\}\}/g, formatCk3GameDate(periodStart))
        .replace(/\{\{periodEnd\}\}/g, formatCk3GameDate(periodEnd));

    const nonMemorySources = sources.filter(s => s.record.kind !== 'character_memory');
    const memorySources = sources.filter(s => s.record.kind === 'character_memory');

    const sections: string[] = [systemPrompt];

    if (previousChronicleEntries && previousChronicleEntries.length > 0) {
        const withContent = previousChronicleEntries.filter(e => e.content && e.content.trim());
        if (withContent.length > 0) {
            sections.push(formatRecentChronicles(withContent));
        }
    }

    if (nonMemorySources.length > 0) {
        sections.push(nonMemorySources.map(formatChronicleSourceTag).join('\n\n'));
    }

    if (memorySources.length > 0) {
        sections.push(formatCharacterMemoriesSection(memorySources, periodStart, periodEnd));
    }

    return sections.join('\n\n');
}
