import {
    MAX_NODE_COMPONENT,
    TimelineRegistry,
    TimelineContext,
    TimelineNode
} from './timelineManager.js';
import type { TransitionJournalStore, TransitionJournalEntry, SourceKind } from './timelineTransitionJournal.js';
import type { MigrationManifest } from './campaignMigration.js';

function isValidCheckpointToken(token: number | undefined): token is number {
    return typeof token === 'number'
        && Number.isInteger(token)
        && token > 0
        && token <= MAX_NODE_COMPONENT;
}

export interface ResolverEvidence {
    kind:
        | 'ck3-node-self-consistent'
        | 'registry-node-has-attempt'
        | 'token-bridge'
        | 'live-attempt-unique-match'
        | 'migration-manifest';
    nodeId?: string;
    sourceNodeId?: string;
    attemptId?: string;
    reason: string;
}

export type TimelineResolution =
    | { status: 'resolved'; evidence: ResolverEvidence; context: TimelineContext }
    | { status: 'legacy-unresolved'; reason: string }
    | { status: 'ambiguous'; reason: string }
    | { status: 'missing-node'; reason: string }
    | { status: 'registry-corrupt'; reason: string };

export interface StrictResolverInput {
    registry: TimelineRegistry;
    context: TimelineContext;
    store?: TransitionJournalStore;
    requestKey?: string;
    source?: SourceKind;
    migrationManifest?: MigrationManifest;
}

function contextForRegistryNode(base: TimelineContext, nodeId: string, node: TimelineNode): TimelineContext {
    return {
        ...base,
        timelineNodeId: nodeId,
        timelineParentId: node.parentId ?? undefined
    };
}

function findNodesWithToken(registry: TimelineRegistry, checkpointToken: number): Array<[string, TimelineNode]> {
    return registry.getVisibilityNodeEntries().filter(([, node]) => node.checkpointToken === checkpointToken);
}

function hasCheckpointEpoch(ctx: TimelineContext): boolean {
    return ctx.checkpointEpoch !== undefined && Number.isFinite(ctx.checkpointEpoch);
}

function observedStateMatches(
    entry: TransitionJournalEntry,
    ctx: TimelineContext
): boolean {
    if (entry.observedEpoch !== ctx.checkpointEpoch) return false;
    if (entry.observedCk3NodeId === undefined) return false;
    if (ctx.timelineNodeId === undefined) return false;
    return entry.observedCk3NodeId === ctx.timelineNodeId;
}

function tryTokenBridge(
    registry: TimelineRegistry,
    context: TimelineContext
): TimelineResolution | undefined {
    const checkpointToken = context.checkpointToken;
    if (!isValidCheckpointToken(checkpointToken)) return undefined;
    const tokenMatches = findNodesWithToken(registry, checkpointToken);
    if (tokenMatches.length === 1) {
        const [nodeId, node] = tokenMatches[0];
        return {
            status: 'resolved',
            evidence: {
                kind: 'token-bridge',
                nodeId,
                reason: 'token uniquely identifies one registry node in the commit short window'
            },
            context: contextForRegistryNode(context, nodeId, node)
        };
    }
    if (tokenMatches.length > 1) {
        return {
            status: 'ambiguous',
            reason: `token ${context.checkpointToken} matches ${tokenMatches.length} registry nodes; no epoch fallback`
        };
    }
    return undefined;
}

function tryLiveAttempt(
    registry: TimelineRegistry,
    context: TimelineContext,
    store: TransitionJournalStore,
    requestKey: string,
    source: SourceKind
): TimelineResolution | undefined {
    const candidate = store.findLiveAttemptByRequestKey(source, requestKey);
    if (!candidate || candidate.terminalEvidence !== undefined) return undefined;
    if (!observedStateMatches(candidate, context)) return undefined;
    const targetNodeId = candidate.targetNodeId;
    const targetNode = registry.hasNode(targetNodeId) ? registry.getNode(targetNodeId) : undefined;
    if (!targetNode) {
        return {
            status: 'registry-corrupt',
            reason: `live attempt ${candidate.transitionAttemptId} targets node ${targetNodeId} not present in registry`
        };
    }
    return {
        status: 'resolved',
        evidence: {
            kind: 'live-attempt-unique-match',
            nodeId: targetNodeId,
            attemptId: candidate.transitionAttemptId,
            reason: 'no terminalEvidence journal + observed state + requestKey uniquely matches a live attempt'
        },
        context: contextForRegistryNode(context, targetNodeId, targetNode)
    };
}

/**
 * §9.5 strict resolver. Resolves a timeline context using the evidence order
 * 1-5. Never falls back to epoch heuristics or token-conflict resolution.
 * token is used only in the node-commit short window to find a unique
 * candidate; multiple candidates -> ambiguous and no further fallback.
 */
export function resolveTimelineStrict(input: StrictResolverInput): TimelineResolution {
    const { registry, context, store, requestKey, source, migrationManifest } = input;
    const checkpointEpoch = context.checkpointEpoch;
    const snapshotNodeId = context.timelineNodeId;
    const snapshotNode = snapshotNodeId !== undefined && registry.hasNode(snapshotNodeId)
        ? registry.getNode(snapshotNodeId)
        : undefined;
    const snapshotMissing = snapshotNodeId !== undefined && !snapshotNode;

    if (snapshotNode) {
        const epochOk = !hasCheckpointEpoch(context) || snapshotNode.epoch === checkpointEpoch;
        if (epochOk) {
            return {
                status: 'resolved',
                evidence: {
                    kind: 'ck3-node-self-consistent',
                    nodeId: snapshotNodeId!,
                    reason: 'CK3 node exists and registry identity/epoch/parent is self-consistent'
                },
                context: contextForRegistryNode(context, snapshotNodeId!, snapshotNode)
            };
        }
    }

    if (store && snapshotNodeId && snapshotNode) {
        const v2Node = store.getNode(snapshotNodeId);
        if (v2Node && typeof v2Node.transitionAttemptId === 'string' && v2Node.transitionAttemptId.length > 0) {
            const entry = store.getEntry(v2Node.transitionAttemptId);
            if (entry) {
                if (entry.targetNodeId !== snapshotNodeId) {
                    return {
                        status: 'registry-corrupt',
                        reason: `v2 node ${snapshotNodeId} attempt ${v2Node.transitionAttemptId} targets a different node ${entry.targetNodeId}`
                    };
                }
                return {
                    status: 'resolved',
                    evidence: {
                        kind: 'registry-node-has-attempt',
                        nodeId: snapshotNodeId,
                        attemptId: v2Node.transitionAttemptId,
                        reason: 'registry node has a transitionAttemptId with a live journal entry'
                    },
                    context: contextForRegistryNode(context, snapshotNodeId, snapshotNode)
                };
            }
            return {
                status: 'registry-corrupt',
                reason: `v2 node ${snapshotNodeId} references missing journal attempt ${v2Node.transitionAttemptId}`
            };
        }
    }

    const tokenResult = tryTokenBridge(registry, context);
    if (tokenResult) return tokenResult;

    if (store && requestKey && source) {
        const liveResult = tryLiveAttempt(registry, context, store, requestKey, source);
        if (liveResult) return liveResult;
    }

    if (migrationManifest && migrationManifest.status === 'imported' && migrationManifest.sourceNodeId) {
        const sourceNodeId = migrationManifest.sourceNodeId;
        if (registry.hasNode(sourceNodeId)) {
            const node = registry.getNode(sourceNodeId)!;
            return {
                status: 'resolved',
                evidence: {
                    kind: 'migration-manifest',
                    nodeId: sourceNodeId,
                    sourceNodeId,
                    reason: 'migration manifest maps to a registry node'
                },
                context: contextForRegistryNode(context, sourceNodeId, node)
            };
        }
    }

    if (snapshotMissing) {
        return {
            status: 'missing-node',
            reason: `CK3 reports node ${snapshotNodeId} not present in registry and no evidence matched`
        };
    }

    if (!hasCheckpointEpoch(context) && context.timelineNodeId === undefined) {
        return {
            status: 'legacy-unresolved',
            reason: 'no checkpoint epoch and no node id; strict resolver cannot identify a branch'
        };
    }

    return {
        status: 'ambiguous',
        reason: 'no evidence matched the strict resolver order (1-5)'
    };
}
