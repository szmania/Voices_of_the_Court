import { parseCampaignId } from '../../shared/gameData/CampaignIdentity.js';

export const LETTER_DATE_HEARTBEAT = `debug_log = "[Localize('talk_event.9999.desc')]"`;

/** Keep the heartbeat outside the guard so rejected payloads still update time. */
export function guardLetterRunPayload(payload: string, input: {
    slotId: string;
    playerId: string;
    campaignId?: string;
    deliveryId: number;
    fallback?: boolean;
}): string {
    if (!/^letter_[1-9]$/.test(input.slotId) || !/^[1-9]\d*$/.test(input.playerId)) {
        throw new Error('Invalid letter execution identity');
    }
    const parts = input.campaignId === undefined ? undefined : parseCampaignId(input.campaignId);
    const lines = payload.split(/\r?\n/);
    if (lines.shift() !== LETTER_DATE_HEARTBEAT) throw new Error('Letter payload is missing its date heartbeat');
    const campaign = parts ? Object.entries(parts)
        .map(([key, value]) => `\t\tglobal_var:votc_campaign_id_${key} = ${value}`) : [];
    const marker = input.fallback ? 'VOTC:FALLBACK' : 'VOTC:DELIVERY';
    return [
        LETTER_DATE_HEARTBEAT,
        'if = {',
        '\tlimit = {',
        `\t\texists = global_var:votc_${input.slotId}`,
        `\t\tthis = character:${input.playerId}`,
        ...campaign,
        '\t}',
        ...lines.map(line => line ? `\t${line}` : ''),
        '}',
        'else = {',
        `\tdebug_log = "${marker}/;/skipped/;/${input.slotId}/;/${input.deliveryId}"`,
        '}',
        ''
    ].join('\n');
}
