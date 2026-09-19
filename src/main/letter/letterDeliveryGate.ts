/**
 * R2: fail-closed identity gate for writing a pending reply into the live
 * game. The pending queue can hold replies recovered from other campaigns
 * (startup rehydration scans every campaign store) or produced by generation
 * that finished after a campaign switch; delivering one into the wrong
 * campaign would consume the current campaign's letter slot for a foreign
 * letter. The reply's immutable campaign identity must match the game
 * context we are about to write into — when either side is unknown, the
 * reply stays pending and the current slot is not consumed.
 */

export type ReplyDeliveryGateCode =
    | 'reply_campaign_unknown'
    | 'current_campaign_unknown'
    | 'campaign_mismatch'
    | 'player_mismatch';

export interface ReplyDeliveryGateVerdict {
    deliverable: boolean;
    reason?: ReplyDeliveryGateCode;
}

export interface ReplyDeliveryGateReply {
    /** The reply's recipient — the player the reply was generated for. */
    recipientId: string;
    /** Lineage stamp of the reply record; legacy records may not carry one. */
    campaignId?: string;
}

export function evaluateReplyDeliveryGate(
    reply: ReplyDeliveryGateReply,
    currentCampaign: { campaignId: string } | undefined,
    currentPlayerId: string
): ReplyDeliveryGateVerdict {
    if (!reply.campaignId) {
        return { deliverable: false, reason: 'reply_campaign_unknown' };
    }
    if (!currentCampaign?.campaignId) {
        return { deliverable: false, reason: 'current_campaign_unknown' };
    }
    if (reply.campaignId !== currentCampaign.campaignId) {
        return { deliverable: false, reason: 'campaign_mismatch' };
    }
    if (reply.recipientId !== currentPlayerId) {
        return { deliverable: false, reason: 'player_mismatch' };
    }
    return { deliverable: true };
}
