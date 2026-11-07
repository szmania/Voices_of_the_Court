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
    | 'player_mismatch'
    | 'legacy_reply_unstamped';

/**
 * §44 Change E: observability-only enrichment of the verdict. Comparison
 * logic is unchanged (fail-closed stays); this just records WHICH side was
 * unknown so a player_mismatch / campaign_mismatch verdict is diagnosable
 * from the log without re-deriving the evidence chain.
 */
export interface ReplyDeliveryGateDiagnostics {
    /** Whether the reply record carried a campaign stamp. */
    replyCampaignIdPresent: boolean;
    /** Whether the current game context exposed a campaign id. */
    currentCampaignIdPresent: boolean;
    /** The current player id the gate compared the reply's recipient against. */
    currentPlayerId: string;
}

export interface ReplyDeliveryGateVerdict {
    deliverable: boolean;
    /**
     * Why this verdict was reached. A deliverable verdict only carries a reason
     * when delivery needed a documented exemption (`legacy_reply_unstamped`), so
     * callers can log the exemption instead of hiding it.
     */
    reason?: ReplyDeliveryGateCode;
    /**
     * §44 Change E (observability only — never changes the verdict): which
     * side of the comparison was unknown, and the player id actually used.
     * Populated on non-deliverable verdicts so a `player_mismatch` log line
     * immediately shows whether the reply was generated for a different
     * player or the log-derived player is stale.
     */
    diagnostics?: {
        replyCampaignIdPresent: boolean;
        currentCampaignIdPresent: boolean;
        currentPlayerId: string;
    };
}

export interface ReplyDeliveryGateReply {
    /** The reply's recipient — the player the reply was generated for. */
    recipientId: string;
    /** Lineage stamp of the reply record; legacy records may not carry one. */
    campaignId?: string;
}

export interface ReplyDeliveryGateOptions {
    /**
     * Pre-upgrade pending replies were queued before letter records carried any
     * campaign lineage, so they have none at all. Failing them closed would
     * strand every one of them forever, and back-filling a campaign id would be
     * worse: it would claim the reply for whichever campaign happens to be
     * loaded, which is the mixing this gate exists to prevent. With this option
     * an unstamped reply is delivered on the player check alone and the verdict
     * says so, leaving attribution to the explicit import path instead of
     * guessing.
     */
    allowUnstampedLegacyReplies?: boolean;
}

export function evaluateReplyDeliveryGate(
    reply: ReplyDeliveryGateReply,
    currentCampaign: { campaignId: string } | undefined,
    currentPlayerId: string,
    options: ReplyDeliveryGateOptions = {}
): ReplyDeliveryGateVerdict {
    // §44 Change E: every verdict carries the same diagnostics so the log
    // always shows which side was unknown (reply stamp, current campaign,
    // or the player id used for the comparison).
    const diagnostics: ReplyDeliveryGateDiagnostics = {
        replyCampaignIdPresent: !!reply.campaignId,
        currentCampaignIdPresent: !!currentCampaign?.campaignId,
        currentPlayerId
    };
    if (!reply.campaignId) {
        if (!options.allowUnstampedLegacyReplies) {
            return { deliverable: false, reason: 'reply_campaign_unknown', diagnostics };
        }
        if (reply.recipientId !== currentPlayerId) {
            return { deliverable: false, reason: 'player_mismatch', diagnostics };
        }
        return { deliverable: true, reason: 'legacy_reply_unstamped' };
    }
    if (!currentCampaign?.campaignId) {
        return { deliverable: false, reason: 'current_campaign_unknown', diagnostics };
    }
    if (reply.campaignId !== currentCampaign.campaignId) {
        return { deliverable: false, reason: 'campaign_mismatch', diagnostics };
    }
    if (reply.recipientId !== currentPlayerId) {
        return { deliverable: false, reason: 'player_mismatch', diagnostics };
    }
    return { deliverable: true };
}
