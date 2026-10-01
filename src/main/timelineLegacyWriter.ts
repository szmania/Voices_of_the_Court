import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { TimelineRegistry } from './timelineManager.js';

/**
 * Test/setup-only helper for writing a legacy player-only registry file at
 * `votc_data/timeline_registry/player_<playerId>.json`. This bypasses the
 * §4.2 invariant enforced by FsTimelinePersistence.saveRegistry (which now
 * refuses to *create* new player-only files) so tests can simulate legacy
 * data, recovery, and repair scenarios without invoking the production
 * save path.
 *
 * NOT for production callers. Production writes MUST use
 * FsTimelinePersistence.saveStoreWithIdentity with a captured
 * CampaignPlayerIdentity. This helper exists solely to stage legacy data for
 * the recovery/repair tests and the migration ExactCandidate tests.
 */
export function writeLegacyPlayerRegistry(userDataDir: string, registry: TimelineRegistry): void {
    const primaryPath = path.join(userDataDir, 'votc_data', 'timeline_registry', `player_${registry.playerId}.json`);
    const dir = path.dirname(primaryPath);
    fs.mkdirSync(dir, { recursive: true });

    const snapshot = registry.snapshot();
    const envelope = {
        revision: registry.getRevision() + 1,
        transactionId: randomUUID(),
        store: snapshot
    };
    fs.writeFileSync(primaryPath, JSON.stringify(envelope, null, '\t'), 'utf8');
    registry.setRevision(envelope.revision);
    registry.markClean();
}

/**
 * Test/setup-only helper that writes a legacy player-only registry file with
 * an explicit revision (to simulate old multi-revision files for backup
 * rotation tests). The registry is left dirty so the caller may re-read it.
 */
export function writeLegacyPlayerRegistryAtRevision(
    userDataDir: string,
    registry: TimelineRegistry,
    revision: number
): void {
    const primaryPath = path.join(userDataDir, 'votc_data', 'timeline_registry', `player_${registry.playerId}.json`);
    const dir = path.dirname(primaryPath);
    fs.mkdirSync(dir, { recursive: true });

    const snapshot = registry.snapshot();
    const envelope = {
        revision,
        transactionId: randomUUID(),
        store: snapshot
    };
    fs.writeFileSync(primaryPath, JSON.stringify(envelope, null, '\t'), 'utf8');
    registry.setRevision(revision);
    registry.markClean();
}
