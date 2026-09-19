import { dialog } from 'electron';
import { t } from '../shared/i18n.js';
import type { TimelineParentNotFoundError, TimelineRegistryCorruptError } from './timelineManager.js';
import { formatRegistryRecoveryLine } from './timelineCommitResult.js';
import { summarizeRegistryErrors } from './registryValidator.js';
import { CampaignIdentityUnavailableError } from './campaignIdentityResolver.js';

const reportedPaths = new Set<string>();
const reportedMissingParents = new Set<string>();
const reportedUnsupportedSchemas = new Set<number>();
const reportedCampaignErrors = new Set<string>();

export function reportCorruptTimelineRegistry(error: TimelineRegistryCorruptError): void {
    console.error(`[timeline] ${error.message}${error.quarantinePath ? ` Quarantine copy: ${error.quarantinePath}` : ''}`);
    console.error(formatRegistryRecoveryLine('corrupt', error.filePath, error.quarantinePath));
    if (reportedPaths.has(error.filePath)) {
        return;
    }
    reportedPaths.add(error.filePath);
    const errorSummary = error.errors.length > 0 ? summarizeRegistryErrors(error.errors) : error.detail;
    void dialog.showMessageBox({
        type: 'error',
        title: t('dialog.timelineRegistryCorruptTitle'),
        message: t('dialog.timelineRegistryCorruptMessage'),
        detail: t('dialog.timelineRegistryCorruptDetail', {
            filePath: error.filePath,
            quarantinePath: error.quarantinePath ?? t('dialog.timelineRegistryCorruptNoQuarantine')
        }) + (errorSummary ? `\n\n${errorSummary}` : '')
    });
}

export function reportUnsupportedTimelineSchema(schema: number): void {
    console.error(`[timeline] Unsupported timeline protocol schema ${schema}. Timeline writing is blocked for this data; update the app and the mod to matching versions.`);
    console.error(formatRegistryRecoveryLine('unsupported_schema', schema));
    if (reportedUnsupportedSchemas.has(schema)) {
        return;
    }
    reportedUnsupportedSchemas.add(schema);
    void dialog.showMessageBox({
        type: 'error',
        title: t('dialog.timelineProtocolUnsupportedTitle'),
        message: t('dialog.timelineProtocolUnsupportedMessage', { schema: String(schema) }),
        detail: t('dialog.timelineProtocolUnsupportedDetail', { schema: String(schema) })
    });
}

export function reportTimelineParentNotFound(error: TimelineParentNotFoundError): void {
    console.error(`[timeline] ${error.message}`);
    console.error(formatRegistryRecoveryLine('parent_not_found', error.parentId));
    if (reportedMissingParents.has(error.parentId)) {
        return;
    }
    reportedMissingParents.add(error.parentId);
    void dialog.showMessageBox({
        type: 'error',
        title: t('dialog.timelineParentMissingTitle'),
        message: t('dialog.timelineParentMissingMessage'),
        detail: t('dialog.timelineParentMissingDetail', { parentId: error.parentId })
    });
}

/**
 * §9 compat boundary: report a CampaignIdentityUnavailableError to the user.
 * Used by business entry points (Conversation, LetterReply, IncomingLetter,
 * BattleReport) when the parsed snapshot does not carry a valid v2 campaign
 * identity, so the operation fails closed instead of silently falling back
 * to the player-only namespace.
 *
 * Each distinct error code is reported at most once per process to avoid
 * spamming dialogs on repeated triggers.
 */
export function reportCampaignIdentityUnavailable(error: CampaignIdentityUnavailableError): void {
    const dedupKey = error.code;
    if (reportedCampaignErrors.has(dedupKey)) {
        return;
    }
    reportedCampaignErrors.add(dedupKey);
    console.error(`[timeline] Campaign identity unavailable (code=${error.code}): ${error.message}`);
    if (error.code === 'legacy-mod') {
        void dialog.showMessageBox({
            type: 'error',
            title: t('error.campaignIdentityLegacyMod'),
            message: t('error.campaignIdentityLegacyMod')
        });
    } else if (error.code === 'unsupported-schema') {
        void dialog.showMessageBox({
            type: 'error',
            title: t('error.campaignIdentityUnsupported'),
            message: t('error.campaignIdentityUnsupported', { schema: String(error.schema ?? '?') })
        });
    } else {
        void dialog.showMessageBox({
            type: 'error',
            title: t('error.campaignIdentityInvalid'),
            message: t('error.campaignIdentityInvalid', { reason: error.message })
        });
    }
}
