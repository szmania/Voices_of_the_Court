# PR #15 Timeline System: Full Implementation and Cross-Subsystem Coupling

> Version baseline: `pr15-legacy-compat` @ `44edf99a` (i.e., `fork/feat/p6-timeline-v2`, head of PR #15, after the round-6 review fixes).
> App-side repository: `F:\github\votc\pr15-legacy-compat` (Voices of the Court 2CE, Electron + native TS).
> Companion mod: `F:\github\votc\voices_of_the_court_mod2 ce`.
> The `§n` references in this document come from the 1.x design-document section numbers preserved in code comments (the system was ported from VOTC 1.x; comments in `src/main/ipc/timelineIpc.ts` and elsewhere annotate the corresponding line numbers in the 1.x `main.ts`).

## 1. System Positioning and Design Goals

PR #15 ports the 1.x **timeline v2** system into 2CE: using the triple of "campaign identity + checkpoint epoch + timeline node", it adds **branch-aware archival coordinates** to all cross-session data — conversations, letters, battle reports, summaries, and so on. The core problems to solve:

1. **Consistency across save loading / rollback**: CK3 players can load old saves and can return to branch points within the same campaign. Records must be visible only on their own branch; after loading a save, "future" records must not be visible, and records must not be written onto abandoned branches.
2. **Cross-campaign isolation**: data from different saves (campaigns) must be mutually invisible and must not overwrite each other; legacy player-only data can be migrated.
3. **App↔game two-way confirmation**: the app's "advance checkpoint" script only counts once the game has actually executed it; save loads, crashes, and retries can interleave in the meantime.
4. **Fail-closed**: when identity cannot be trusted, prefer not writing over writing wrongly.

Non-goals: the timeline system does not change LLM conversation content itself; it only handles data ownership, visibility, and consistency.

## 2. Core Concepts and Glossary

| Term | Definition | Carrier |
|---|---|---|
| `CampaignPlayerIdentity` | `{protocolSchema:2, campaignSchema:1, campaignId:"a-b-c-d", campaignParts, playerId}`; campaignId consists of 4 segments of 28-bit non-zero positive integers | in-save global variables + tail of init/loaded log lines; construction in `src/shared/gameData/CampaignIdentity.ts:100-158` |
| checkpoint epoch | monotonically increasing in-save integer, +1 on each conversation close / letter / battle report advance | mod character variable `votc_checkpoint_epoch` (persisted with the save) |
| timeline node | `"a-b"` random node id, forming a parent-chain branch graph | `TimelineNode {parentId, epoch, checkpointToken?, source, eventKey, createdAt}` (`timelineManager.ts:47-58`) |
| checkpoint token / pending token | 29-bit random correlation token generated CK3-side; pending is pre-allocated for the next epoch and promoted on bump | character variables `votc_checkpoint_token` / `votc_checkpoint_pending_token` |
| v1 store / registry | writable branch graph (player view) | `store` field of the `timeline_registry.json` envelope |
| v2 journal | log of transition attempts (attempt state machine + nodes) | `nodes`/`transitions` fields of the same envelope |
| `TimelineContext` | state snapshot observed/targeted by one operation `{playerId, checkpointEpoch, checkpointToken, pendingCheckpointToken, timelineNodeId, timelineParentId, identity?}` (`timelineManager.ts:66-84`) | in-memory object |
| evidence snapshot (evidence) | compares freshness of `loaded` lines / `init` blocks / `CHECKPOINT set` receipts by debug.log file offset, taking the newest carrier field by field | `scanDeliverySnapshotEvidence` (`campaignLoadObserver.ts`) |
| bootstrapKind | 1 = brand-new campaign, 2 = save carries old checkpoint state, 3 = legacy VOTC traces (the app shows a "save upgraded" prompt based on this) | 8th field of the `VOTC:CAMPAIGN/;/loaded` line |
| SourceKind | `'conversation' \| 'letter_reply' \| 'incoming_letter' \| 'battle' \| 'summary_manual'` (`timelineManager.ts:86`) | journal entry.source |

**Key invariants**:
- checkpoint *epoch/token/day* advancement is always performed by the **mod-side bump primitive** (two-phase: prepare snapshot → init snapshot → bump);
- timeline *node/parent* writes are always performed by **app-generated run scripts** (guarded; out-of-order arrivals are skipped);
- the mod never proactively sets non-zero node variables.

## 3. Global Architecture Layers

```
┌─ CK3 游戏（mod: voices_of_the_court_mod2 ce）──────────────────────────┐
│  global 变量: votc_campaign_schema/id_a..d/bootstrap_kind              │
│  玩家角色变量: votc_checkpoint_epoch/day/token/pending_token            │
│               votc_timeline_node_a/b/parent_a/b/schema                  │
│  on_action 转发: on_game_start_after_lobby → votc_game_start_init_relay │
│  剪贴板桥:  clipboard_transfer 事件 widget (CopyToClipboard)            │
│  轮询执行器:  letters_runner (~2s, 对话时暂停) / talk_window_counter    │
│               (~0.4s, run votc.txt) / battle_report widgets             │
└──────────────▲──────────────────────────────┬──────────────────────────┘
               │ debug.log 数据行              │ run 目录脚本
               │ (init/loaded/CHECKPOINT/      │ (votc.txt / letters.txt /
               │  DATE/LETTER/FALLBACK/...)     │  battle_report<N>.txt)
┌──────────────┴──────────────────────────────▼──────────────────────────┐
│ 应用侧（2CE main 进程）                                                  │
│  ① 协议层  src/shared/gameData/: parseLog / GameData /                  │
│     timelineProtocol / CampaignIdentity / saveSnapshotProtocol          │
│  ② 事件总线 ClipboardListener (100ms 轮询) + debug.log fs.watchFile     │
│     (2s 增量 tail)                                                      │
│  ③ 身份层  campaignIdentityResolver(§4.1/§9) / campaignLoadObserver     │
│  ④ 存储层  campaignDataPaths / timelineManager(registry+persistence)    │
│  ⑤ 解析层  timelineResolver(strict) / timelineTransitionJournal /       │
│     timelineJournalApi(§9.2)                                            │
│  ⑥ 接线层  timelineBusinessWire(6 sources) / campaignBusiness(§2/§8) /  │
│     campaignMigration                                                   │
│  ⑦ 并发恢复 timelineLock / timelineRegistryRecovery                     │
│  ⑧ 子系统  Conversation / letters / history+archive 窗口 / summaries /  │
│     battle reports (未接线)                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

## 4. App ↔ Mod Contract: Log Protocol, Clipboard Commands, Run Files

### 4.1 debug.log Data Lines

All lines carry the CK3 engine prefix (`[time][level][source]: `) and **must be matched by substring and split on `/;/`**; the last segment carries a trailing `\r` (CRLF). Core lines:

| Line | Producer | Key fields | App consumption point |
|---|---|---|---|
| `VOTC:IN/;/init/;/…` | mod (`log_gamedata_v3*` effect, immediate of conversation/letter events) | 15 core fields + 8-field timeline protocol tail + date extras + save snapshot extras (detailed below) | `parseLog.ts` → `GameData` construction (`GameData.ts:358-403`) |
| `VOTC:CAMPAIGN/;/loaded/;/pid/;/schema/;/a/;/b/;/c/;/d/;/kind/;/epoch/;/nodeA/;/nodeB` | mod on_action `votc_game_start_init_relay` (save load / game start) | identity + bootstrapKind + the save's current epoch/node | `parseCampaignLoadedLine` (`parseLog.ts:781-813`) → `campaignLoadObserver` |
| `VOTC:CHECKPOINT/;/set/;/pid/;/epoch/;/nodeA/;/nodeB/;/parentA/;/parentB[/;/date]` | **when an app-written run script executes** (`buildCheckpointSetEffect` `timelineManager.ts:1895`, conversation-close effect `Conversation.ts:1938`, battle report scripts) | receipt after the game applies a transition | evidence scan (`campaignLoadObserver.ts`; round 6 added the `parseTimelineCheckpointSetLine` parser) |
| `VOTC:CHECKPOINT/;/bump/;/pid/;/epoch/;/date` | mod `votc_bump_checkpoint_effect` | epoch-advance primitive | diagnostics |
| `VOTC:TIMELINE/;/snapshot/…`, `/;/bump/…` | mod prepare/bump effects | pre-bump snapshot (includes pendingToken) | diagnostics/testing |
| `VOTC:TIMELINE/;/commit_result/…` | app-written battle report guard script | guard commit result (applied / already_applied / skipped_advanced / ambiguous_* / skip_delivery_mismatch) | battle report parsing (battle snapshot layout, `timelineProtocol.ts:100-112`) |
| `VOTC:DATE/;/<totalDays>` | heartbeat line expansion in letters.txt | game-date heartbeat (~2s) | `processLogLine` (`main.ts:716-736`) → `updateCurrentDate` |
| `VOTC:LETTER/;/<body>/;/letterId/;/totalDays/;/delay/;/…` | mod `message_text` localization expansion | incoming player letter | `parseLettersFromLog` (last 1MB, `parseLogForLetters.ts:35-92`) |
| `VOTC:FALLBACK/;/applied\|skipped/;/letter_N/;/deliveryId` | app fallback run file | generation-failure receipt | log tail → `clearLettersFile` (`main.ts:729-735`) |
| `VOTC:conversation_history/;/pid/;/epoch` | mod history-window decision | player/epoch with no payload | `parseConversationHistoryIdsFromLog` (`conversationHistory.ts:323-363`) |

**init line layout** (`timelineProtocol.ts:6-11`, `INIT_LAYOUT` :81-94): core 0-14 (playerId/playerName/aiId/aiName/date/scene/location/locationController/**epoch(8)**/nodeA(9)/nodeB(10)/parentA(11)/parentB(12)/token(13)/pendingToken(14)), protocol tail 15-22 (`2/1/campA/campB/campC/campD/bootstrapKind/playerTimelineSchema`), date extras 23-27, save snapshot extras 28-30 (protocol/sequence/slot, `saveSnapshotProtocol.ts`). `parseTimelineSnapshot` (`timelineProtocol.ts:231-291`) yields `valid` (with protocol tail) / `legacy` / `unsupported-schema` / `truncated` / `invalid`; CK3 persists uninitialized variables as 0, so **0 is a sentinel, not an id**.

### 4.2 Clipboard Command Channel

On the mod side, a nearly UI-less `character_event` (theme `clipboard_transfer_event_theme`) is used: the desc is `VOTC:<command>` text, and the widget `on_finish = "[EventWindowData.CopyToClipboard]"` copies it to the clipboard. On the app side, `ClipboardListener` (`src/main/ClipboardListener.ts:43-86`) polls every 100 ms; after recognizing the `VOTC:` prefix it splits on `/;/` and emits an event with `segments[0]` as the command, then **writes the previous clipboard value back after consuming**.

| Command | mod event | app handler (main.ts) |
|---|---|---|
| `VOTC:IN` | `mcc_event_v2.8999/9000/9001` (three conversation variants) | :1319 open conversation window |
| `VOTC:CONVERSATION_HISTORY` (bare command in 2CE, no payload) | `votc_checkpoint_event.9001` | :1530 open window + record `conversationHistoryContext` |
| `VOTC:LETTER` / `VOTC:LETTER_ACCEPTED` | `message_event.361/362` | :1567 / :1444 |
| `VOTC:EFFECT_ACCEPTED` | `mcc_event_v2.9003` (triggered by app script) | action confirmation |
| `VOTC:BOOKMARK` / `VOTC:SUMMARY_MANAGER` | not ported in the 2CE mod (mod1's 9-field manager payload from `hmd_event.9004` does not exist in 2CE) | :1479 / :1515 |

### 4.3 Run File Channel (app → game)

The app overwrites `<CK3 user folder>/run/*.txt` whole-file; mod-side polling widgets execute it with `ExecuteConsoleCommand('run …')`:

| File | Executor | Purpose |
|---|---|---|
| `run/votc.txt` | `talk_window_counter` (~0.4s polling, `talk_window_v2.gui:134-148`) | conversation-close checkpoint commit, ACTION/SUMMARY commands; `RunFileManager` clears the file ~500 ms after writing |
| `run/letters.txt` | `letters_runner` (~2s polling, paused while a conversation holds `talk_scene`, `letters_runner.gui:22-30`) | letter delivery; **the first line must be the VOTC:DATE heartbeat line** (the `clearLettersFile` restore placeholder also uses it, `LetterManager.ts:460-483`), because the mod runner unconditionally executes the file and the app syncs the date from the heartbeat line — clearing the file would freeze date tracking. Single-channel whole-file overwrite; two writes in the same window overwrite each other (`LetterManager.ts:365-369`) |
| `run/letter<N>.txt` | triggered by the write-letter interaction | generation-failure fallback block (clears the thread + applies the journal node), receipt `VOTC:FALLBACK` |
| `run/battle_report<N>.txt` | battle report event widget `on_start` | battle report display + (once wired) guard commit |

**Commit script template generated by `buildCheckpointSetEffect(nodeId, parentId, epoch, scopeVar, token?)`** (`timelineManager.ts:1859-1898`):

```
scope:<scopeVar> = {                       # global_var: 前缀则原样保留（延迟执行用持久 scope）
    set_variable = { name = votc_checkpoint_epoch value = <epoch> }   # epoch 非 undefined 时
    set_variable = { name = votc_checkpoint_token value = <token> }   # token 合法时
    remove_variable ?= votc_checkpoint_pending_token                  # 同上（?= 容忍不存在）
    set_variable = { name = votc_timeline_node_a value = <a> }
    set_variable = { name = votc_timeline_node_b value = <b> }
    set_variable = { name = votc_timeline_parent_a value = <pa> }
    set_variable = { name = votc_timeline_parent_b value = <pb> }
    set_variable = { name = votc_timeline_schema value = 1 }
    debug_log = "VOTC:CHECKPOINT/;/set/;/[GetPlayer.GetID]/;/<epoch|''>/;/<a>/;/<b>/;/<pa>/;/<pb>"
}
```

Conversation close goes through `Conversation.buildCloseConversationEffect` (`Conversation.ts:1911-1942`): `global_var:talk_first_scope` wraps the same variables + the receipt line (`[THIS.Char.GetID]`, date at line end) + `trigger_event = mcc_event_v2.9002/9003` (release scene + confirmation event).

## 5. Identity Subsystem

### 5.1 Construction and Validation

`src/shared/gameData/CampaignIdentity.ts`: `buildIdentityFromParts(parts, playerId)` (:100-124, validates each segment is non-zero and ≤28-bit, double `Object.freeze`), `buildIdentityFromSnapshot(snapshot, playerId)` (:126-158, validates the protocol-tail schema; error codes `missing_protocol_tail` / `unsupported_protocol_schema` / `unsupported_campaign_schema`), `isCampaignPlayerIdentity` (:169-201, includes defense-in-depth that campaignId matches the value recomputed from parts).

### 5.2 Capture Points and the fail-closed Boundary (§4.1 / §9)

`requireCampaignIdentity` (`campaignIdentityResolver.ts:94-116`) is **the single identity entry point at the start of a business operation**: snapshot `valid` → identity; `legacy` / `undefined` → `CampaignIdentityUnavailableError('legacy-mod')` (new app + old mod; silently falling back to the player-only write path is forbidden); `unsupported-schema` → error per schema; `truncated/invalid` → fail-closed. There are only four production call sites:

- `Conversation` constructor (`Conversation.ts:213-226`): captures but does not report; **fail-closed is deferred to the close-time write** (the conversation still opens);
- `Conversation.saveHistoryAndTriggerSummarization` (:1965-1970): missing identity throws → catch falls back to the "close conversation only" effect (`trigger_event = mcc_event_v2.9002`);
- `LetterReplyGenerator.generateLetterReply` (:301-311): missing identity → `return null` directly;
- `timelineIpc.resolveTimelineWindowRequest` (around :226): when a payload-less/derived context takes the campaign path.

`reportCampaignIdentityUnavailable` (`timelineRegistryRecovery.ts:72-98`) shows one dialog per error.code per process.

### 5.3 Save-Load Observation (`campaignLoadObserver.ts`)

- `observeCampaignLoadLine(line)` (:57-83): parses the loaded line → constructs `observedLoad {campaignId, playerId, bootstrapKind, checkpointEpoch, nodeId}`; when `bootstrapKind ∈ {2,3}`, `announceAdoptedSave` shows the "save upgraded" dialog once per campaign.
- At app startup the last loaded line is read to backfill the observation (`main.ts:840-852`); during log tail it is fed line by line (`processLogLine`).

### 5.4 Evidence Snapshot Scanning (the core of the round-6 fix)

`scanDeliverySnapshotEvidence(logPath)` (`campaignLoadObserver.ts:127-215`): scans backwards from the log tail in 512KB chunks for the **last occurrence** of three markers (1KB overlap to prevent cross-boundary misses), taking the "newest carrier" field by field:

- **campaignId**: only a load line can beat an init block (`loadOffset > initOffset`); if the load line wins but fails to parse (or identity construction fails) → return `{source:'load'}` **fail-closed** (no fallback to the old init identity); checkpoint receipts do not carry a campaign.
- **playerId / nodeId / checkpointEpoch**: supplied by the newest marker (checkpoint > load > init). A checkpoint receipt reflects the state after the game applied the transition, so it is naturally later than the load/init that scheduled it — **this is the key round-6 fix**: previously only load/init were considered, so node drift after a conversation completed (the save had already left the branch point of the letter-reply pre-allocation node) was entirely invisible, causing delivery to misdirect the game from the completed-conversation node to a sibling node.
- When init wins, these fields are left empty and the caller uses the just-parsed `gameData` (the same init snapshot).
- If none of the three markers exists → the observer's in-memory fallback → `{source:'none'}`.

Consumers:
- `main.ts resolveDeliveryIdentity` (region :365-384): campaign and player **come from the same scan** (fixes round-6 P2: previously campaign came from B/loaded and player from A/init, so cross-save replies were rejected as `player_mismatch`);
- `main.ts resolveCurrentTimelineNodeId` (region :393-404): the load/checkpoint evidence node takes priority, else `gameData.votcTimelineNodeA-B`, else the observer;
- `LetterReplyGenerator.fallbackDeliveryGate` (:528-599): the same evidence provides cross-campaign slot-clearing protection + branch-drift script dropping;
- `timelineIpc.deriveLegacyWindowContext`: legacy context derivation for the history window (§10.3).

## 6. Storage Subsystem

### 6.1 Disk Layout (`campaignDataPaths.ts`; everything passes `validatePathSafeName` against path traversal)

```
<userData>/votc_data/
├─ campaigns/<a-b-c-d>/                        # campaignId = 4 段 28-bit
│  ├─ campaign.json
│  └─ players/<playerId>/
│     ├─ timeline_registry.json               # envelope（见 6.3），附 .tmp/.swap.json/.bak.0..2
│     ├─ timeline_transactions/
│     ├─ conversation_summaries/              # 读取合并端（写入侧仍在 legacy 平铺目录）
│     ├─ conversation_history/<nodeId>/{transcript.json, conversation.json}
│     ├─ letter_history/  letter_history_archived/
│     ├─ battle_report_history.json  battle_report_history_archived.json
│     ├─ summary_overrides.json  migration.json
│     ├─ chronicle/{entries,attempts,memory_observations,source_digests}.json
│     ├─ save_facts/{current.json,snapshots/,diagnostics.json,entity_names.json}
│     └─ agency/{events,attempts,sources/<enc>/<digest>.json}
├─ .lock/campaign_<cid>_player_<pid>.lock     # 文件锁（timelineLock.ts:49-62）
├─ timeline_registry/player_<pid>.json        # legacy player-only registry（迁移源）
├─ conversation_history/<pid>/                # legacy 对话历史 .txt
├─ conversation_summaries/<pid>/              # 摘要实际写入处（Conversation.ts:2234-2235）
└─ legacy_backups/<时间戳>/…                   # 迁移前一次性备份（createFirstMigrationBackup）
```

### 6.2 TimelineRegistry (v1 graph, `timelineManager.ts:289-573`)

- Data: `TimelineRegistryData {version:1, playerId, nodes: Record<nodeId, TimelineNode>}`; `dedupIndex` (`parentId␟source␟eventKey` → nodeId) is rebuilt at construction.
- `getOrCreateChild` (:452-499): **already @deprecated** (since §9.3 P5.4, all new writes must go through the journal API); used only by legacy read paths / migration staging; a dedup hit returns the existing node (the token can be backfilled); a missing parent throws `TimelineParentNotFoundError`.
- Visibility: `getAncestors` (:501-511, includes self, cycle-guarded); `isRecordVisible(record, current)` (:517-531, lenient version — missing/invalid on either side → true, current not in graph → false, otherwise record ∈ the ancestor set of current); `isV2RecordVisibleFromObservedContext` (:539-572, strict version — missing parameters → false immediately, requires the record to be in the v2 visibility graph and `record.epoch ≤ observedEpoch`; the comment stresses that an un-persisted CK3 parent is not sufficient evidence and strict resolution must first complete via the unique token).
- `isRecordVisibleForContext` (:1956-1975): unified business entry — for records carrying a nodeId: `isRecordVisible || isV2RecordVisibleFromObservedContext`; for records without a nodeId it degrades to epoch comparison (`recordEpoch ≤ checkpointEpoch`).
- `repairLegacyContinuity` (:396-440): migration preview only, not called in production.

### 6.3 Envelope and v2 Projection (`timelineManager.ts:142-287, 650-670`)

The disk envelope = `{revision, transactionId, store(v1), campaign{…}, player{…}, nodes?(v2), transitions?(v2 journal)}`; the `campaign`/`player` headers are the **identity authority** since Phase 4. The relationship between v2 and v1:

- `projectV2NodesIntoRegistryData` (:148-201): journal nodes are projected into the writable v1 graph, but **only the connected subgraph** (nodes whose parent is not persisted locally are skipped, otherwise the next atomic rewrite would break); rollback edges (parent edges with regressed epochs, :130-136) stay in the journal and are not projected.
- `V2VisibilityGraph` (:203-287): an independent read-only visibility graph. Rollback edges are treated as roots inside the graph; when a parent is an un-persisted CK3 node, the parent edge is only added if the journal proves a **unique token handoff** (indexing the whole journal by `checkpointCorrelationToken` yields exactly 1 candidate and the epoch matches transition.observedEpoch) — after a rollback, a new sibling observing the old token stays detached, preventing sibling branches from being misidentified.

### 6.4 Atomic Persistence (`FsTimelinePersistence`, :787-1809)

**Load chain** (`loadStore` :815-883 / `loadStoreWithIdentity` :1380-1431):
1. valid primary → use it, and quarantine orphan tmps (tmp is never promoted while primary exists);
2. tmp promotion (`tryPromoteTmp` :930-1028): requires a complete `.swap.json` manifest with matching sourcePath/targetPath, tmp SHA-256 == manifest, parse+validate passing, revision == manifest.revision, and `revision > max(parseable backup revisions)` (prevents a stale tmp from bypassing continuity) → `renameSync` atomic promotion;
3. legacy nested-path migration (from the historical `votc_data/votc_data/...` bug);
4. backup fallback (`.bak.0..2`, `MAX_BACKUPS=3`);
5. total failure: residue on disk → `corrupt` (quarantine + **write blocking**, preventing silent rebuild); never existed → `missing`.

**Write chain** (`saveStoreWithIdentity` :1682-1808): revision+1 → new transactionId → snapshot → **fail-closed validation before writing** (v1 `validateV1RegistryData` + v2 `validateV2Payload` + envelope headers matching the requested identity, :1440-1519) → write `.tmp` → **re-read and re-validate tmp** → write the manifest (with SHA-256) → rotate backups → `renameSync` promotion → **post-commit re-validation**; on failure it throws `TimelineRegistryCorruptError` (the manifest is left for diagnostics, the most recent backup is intact). `saveRegistry` (the player-only version, :1170-1284) additionally has the §4.2 invariant: **it refuses to create a new player-only registry when primary does not exist**.

corrupt files are quarantined to `quarantine/<name>.corrupt.<timestamp>.json` (content-addressed dedup copies); orphan tmps are quarantined as `*.orphan-tmp.<ts>.json`.

### 6.5 TimelineContext Construction Family (`timelineManager.ts:1904-2101`)

| Function | Semantics |
|---|---|
| `buildTimelineContextFromParts` (:1904-1938) | parts → context; missing/≤0/invalid node components → degraded epoch+token context |
| `buildContextFromSnapshot` (:1993-2008) | snapshot → adapter of the above |
| `buildContextFromGameData` (:2010-2070) | **business observation entry**: `timelineSnapshotResult` is `unsupported-schema` → throw; `valid/legacy` → construct context, and only `valid` attempts to fill `identity` (construction failure only warns, letting business entries fail-closed); other statuses → warn then degrade to epoch-only; with no snapshot result, reads gameData top-level variables directly |
| `buildContextFromBattleCheckpoint` (:2080-2101) | battle-report specific: checkpoint exists but is corrupt → degrade to an epoch-only context only, **never inherit node/token from an unrelated earlier init block**; checkpoint has no fields and the gameData player matches → fall back to `buildContextFromGameData` (old saves where the battle precedes checkpoint emission) |

## 7. Resolution and Commit

### 7.1 `resolveTimelineStrict` (`timelineResolver.ts:136-232`, §9.5)

Never falls back to epoch heuristics (heuristics survive only in `resolveTimelineContextLegacy` :2162-2219, **migration preview only**). Evidence order:

1. **CK3 node self-consistency**: snapshotNode is in the registry and epochs match (or there is no epoch) → resolved;
2. **registry node carries an attempt**: the v2 node has a `transitionAttemptId` and the journal entry is alive (an entry pointing to another node, or missing → `registry-corrupt`) → resolved (epoch not validated);
3. **token bridge**: `checkpointToken` uniquely hits a node in the visibility graph → resolved; >1 → `ambiguous` (token conflicts do not fall back to epoch);
4. **live attempt**: `store.findLiveAttemptByRequestKey(source, requestKey)` hits, `terminalEvidence` not written, `observedStateMatches` (observedEpoch equal and observedCk3NodeId == context.node) → resolved;
5. **migration manifest**: `manifest.status==='imported'` and sourceNodeId in the registry → resolved.

Finale: snapshotNode missing → `missing-node`; no epoch and no node → `legacy-unresolved`; everything else → `ambiguous`.
`resolveTimelineContext` (:2147-2153) is the production wrapper that flattens resolution into a single context: only `resolved` uses the new context, everything else **returns the input unchanged** (callers needing status distinction use strict).

### 7.2 transition journal (`timelineTransitionJournal.ts` / `timelineJournalApi.ts`)

- **State machine**: phases `preparing → store-committed → business-committed → artifact-written` (legal transition table :179-190); any non-aborted phase can → `aborted`; terminal result status ∈ `{applied, already-applied, skipped-advanced}` (:17-25).
- **entry** (:100-122): attemptId, source, requestKey, `observedCk3NodeId/observedEpoch/observedCurrentToken/observedPendingToken` (formatted from the snapshot at operation start), `graphParentNodeId`, `targetNodeId/targetEpoch/targetCorrelationToken`, commitMode, recordIds, artifact, phase, commitResults, `terminalEvidence`, timestamps.
- **§9.2 reconciliation** (`classifyReconciliation` :501-537): no existing entry / different source / already aborted → `new-attempt`; has terminalEvidence: target matches → `idempotent-update` (idempotent), observed matches → `new-attempt` (rollback replay), neither matches → `new-attempt`; no terminalEvidence: observed matches and phase ∈ {artifact-written, business-committed} → `replay-artifact` (crash-replayed artifact), observed matches → `reuse` (reuse the existing attempt and targetNodeId), otherwise → **`ambiguous` (refuse to guess; throws `ambiguous_reconciliation`)**.
- **commitResults append-only asymmetry** (rule 7, :619-669): conflicting results are also pushed as evidence; `terminalEvidence` is written once and immutable; a second, different qualifying result is recorded as a conflict (store corrupt); replaying the same resultId with the same content is idempotent. `computeV2ResultId` = the first 16 hex of sha256(attemptId|status|canonicalObserved).
- **API** (`timelineJournalApi.ts:130-454`): `beginTransition` (reconcile decision: reuse/replay-artifact/idempotent-update return the existing attempt with `reused:true` and create no new node; new-attempt creates the entry + `TimelineNodeV2` and persists); phase-advance functions all validate the prerequisite phase and **rewrite the whole envelope on every change** (a crash cannot leave memory ahead of disk); `reconcileAttemptFromSnapshot` (rule 6 + rule 3: an existing terminal and snapshot==observed(≠target) → `reloadRedoDetected`, prompting the caller to open a new attempt; no terminal and snapshot==target → synthesize a `synthetic already-applied` to repair missing evidence, **never overwriting real terminalEvidence**); `abortTransition`.
- The journal has no separate file — it is serialized into the envelope's `nodes`/`transitions` and persisted in the same transaction as the v1 store (`SerializedJournalStore`, :124-127).

### 7.3 Two Commit Modes (`timelineBusinessWire.ts:96-174`)

- `post-bump-node-only` (**the mod has already bumped** the epoch; the app only fills in the node): the guard validates that targetEpoch is non-negative finite and targetNodeId is valid; idempotency is delegated to the journal's `idempotent-update`. Used by `letter_reply` / `incoming_letter` / `battle`.
- `atomic-advance` (**the app commits everything in one step**): on top of the base guard, it requires observed.epoch to exist (proving CK3 is in the pre-bump state) and targetCorrelationToken (if present) to be a positive integer (the mod-preallocated pending token). Only used by `conversation`.
- Companion concept: the mod's **two-phase bump** — `votc_prepare_checkpoint_advance_effect` (pre-bump snapshot letting the app obtain the pendingToken early) → init snapshot → `votc_bump_checkpoint_effect` (pending promoted, epoch+1); on the app side, `targetCorrelationToken = observedContext.pendingCheckpointToken`.

### 7.4 `runSourceTransition` Main Flow (`timelineBusinessWire.ts:189-315`)

Common path for all sources (inside `withTimelineLock`, :202):

1. `buildContextFromGameData(gameData)` → observedContext (identity embedded);
2. `observedStateFromContext` → `loadCampaignStoreWithMigration(userDataDir, identity, {observedState})` (missing → empty registry; corrupt → throw);
3. `resolveTimelineContext(registry, observedContext)` determines graphParent (non-resolved keeps the snapshot node; downstream fail-closed);
4. Assemble `ObservedSnapshot`; rehydrate `TransitionJournalStore` from the envelope; **targetNodeId stabilization** — a live attempt reuses its targetNodeId, otherwise `generateNodeId()` (:252, :317-321);
5. guard validation → `beginTransition` (reconcile) → `commitTimelineStoreAttempt` (phase → store-committed, atomic persistence of v1+v2);
6. `buildCheckpointSetEffect(targetNodeId, graphParentNodeId, targetEpoch, scopeVar, targetCorrelationToken)` generates the bump script (reused attempts still get one; the bump is idempotent);
7. Returns `SourceTransitionResult {attemptId, source, requestKey, commitMode, targetNodeId, reused, phase, script, context}` — `context` points at the target, for battle report batch chaining.

**Per-source signatures and requestKeys**:
- `runConversationTimelineTransition` (:346): requestKey = a per-close UUID `conv:<uuid>` (reused by retries; after terminal, `clearCloseRequestKey` replaces it, Conversation.ts:1895-1909); `eventSignature = conv:<player>_<ai>_<date>_<epoch>` is audit-only; atomic-advance. **Wired** (Conversation.ts:1973).
- `runLetterReplyTimelineTransition` (:391): requestKey = `slot|deliveryId(|sha256(eventSignature)[0:16])` — the delivery id is stored in the CK3 save, and slot reuse after rollback needs occurrence distinction, so eventSignature includes the letter content hash (:322-334, :378-389); post-bump-node-only. **Wired** (LetterReplyGenerator.ts:337).
- `runIncomingLetterTimelineTransition` (:430): requestKey = `slot|type|deliveryId(|sig)`. **Not wired** (tests only).
- `runBattleTimelineBatchTransition` (:484): loops entries under a single lock; adjacent entries with the same snapshotKey (node␟epoch␟token␟pendingToken) chain parents (epoch takes `max(entry.nextEpoch, parentEpoch+1)`); scopeVar is fixed to `votc_battle_report_player`. **Not wired**.
- `recordBookmarkImport` (:647): record-only, creates no attempt; idempotency relies on scanning v2 nodes for the `eventSignature === 'bookmark:<importId>'` sentinel. **Not wired** (the VOTC:BOOKMARK handler only takes the legacy summary path).

## 8. Concurrency, Locking, and Error Reporting

Three layers of concurrency control (`timelineLock.ts`):
1. Electron single-instance lock (`ensureSingleInstanceLock` :393-414);
2. Inter-process file lock `TimelineFileLock` (:108-274): O_EXCL-creates a `.lock/` file with contents `{pid, startedAt, host}`; deadlock recovery = PID probe (`process.kill(pid,0)`) + a 60s timeout backstop; **TOCTOU protection** — recovery first atomically claims the file via `renameSync`, then re-validates staleness on the renamed file before unlink;
3. In-process `TimelineMutex` (:287-310) serializing by `campaign:<cid>|player:<pid>`.

`withTimelineLock(userDataDir, identity, fn)` (:326-349) = mutex → file lock → fn → finally release; **not reentrant** (nesting the same identity deadlocks). All `run*Transition`/`recordBookmarkImport`/`runCampaignTimelineOperation` follow the same order — "lock first, then load-migration, then beginTransition"; journal beginTransition never executes outside the lock.

Error reporting (`timelineRegistryRecovery.ts`): corrupt registry / unsupported schema / parent-not-found / identity-unavailable each show **one dialog per process per filePath/code** (console + structured log line + i18n dialog); physical quarantine happens in the persistence layer.

`timelineCoordinator.ts` (§10.1 multi-battle-report sequencer): when the arrival order of multiple battle reports in the same batch is untrustworthy, it groups them by their respective pre-bump snapshots → ascending epoch across groups → **gap detection** (epochs must be contiguous +1; the gapped group and all groups after it are dropped rather than guessing the order) → within a group, stable sort by `slotId|battleDeliveryId` for chained numbering (chainIndex 0's parent is the observed node itself, `resolvedNextEpoch = max(callerFloor, epoch+1+i)`, :123-218).

## 9. Legacy Data Migration (§2 / §8 / §9.5, `campaignMigration.ts`)

- Migration source: `votc_data/timeline_registry/player_<id>.json` (including variants with the historical nested-path bug); target: the campaign envelope (the staging file `players/<pid>/migration.json` records decisions).
- `isExactCandidate` (:122-158): playerId matches + v1 validation clean + **must have observed.timelineNodeId** (epoch-only counts as ambiguous), and that node must be in the legacy store + no epoch conflict + when observed carries a token, the node must have the same token (a token-less legacy node cannot vouch for itself).
- `stageCampaignMigration` decision tree: manifest already imported → idempotent skip; no legacy → `skipped/no-legacy-data`; parse failure or candidate not exact → `skipped/ambiguous` (the manifest records quarantinedRecordCount = all nodes); exact → back up to `legacy_backups/<stamp>/` (**the original file is neither deleted nor modified**) → take only the sourceNodeId ancestor subgraph → brand-new envelope (revision:1, random transactionId, stamped campaign/player headers; deliberately bypasses saveStoreWithIdentity) persisted atomically → manifest `decision=current-branch-only`.
- `loadCampaignStoreWithMigration` (`campaignBusiness.ts:52-88`): if the campaign store is anything other than missing, return it directly; **only when missing** does it trigger staging (§2 mid-game enablement); imported counts as migrated and is reloaded.
- `resolveMigrationPreviewContext` (:512-564, §9.5): the only place allowed to use the `resolveTimelineContextLegacy` epoch heuristic; evidence is graded proven (snapshot self-consistency / token bridge) / non-proven (epoch heuristic, with a warning); the return value is for display only and must not be used for writes.

## 10. Subsystem Coupling

### 10.1 Conversation (`src/main/conversation/Conversation.ts`)

**Opening** (clipboard `VOTC:IN` → `main.ts:1319` handler): sleep 250 ms for the log to flush → `parseLog(debug.log)` → `new Conversation(gameData, …)`; the constructor immediately calls `requireCampaignIdentity` to capture `campaignIdentity` (failure is only logged; the conversation still opens). The read-side context is built **lazily**: `resolveTimelineReadContext()` (:471-498) runs `buildContextFromGameData` + `loadCampaignStore` on first read; the result (including `null` for legacy) is cached.

**Read-side branch filtering** (when assembling conversation prompts):
- `getBranchVisibleSummaries` (:442-461): `filterSummariesForCheckpoint(all, votcCheckpointEpoch)` + `isRecordVisibleForContext(registry, currentNodeId, summary, epoch)`;
- `loadHistory` (:500-567): `listPromptTranscriptFiles(playerId, participating-character set, limit, epoch, identity, registry, currentNodeId)` (`conversationHistory.ts:383-479`) — legacy+campaign directories merged by filename (legacy wins); the `_tl_<node>` segment must pass graph visibility (hidden when there is no registry); the `_ckptN` segment is epoch-filtered; character ID sets must match exactly.

**Closing** (`saveHistoryAndTriggerSummarization`, :1944-2041; trigger points: the renderer Leave button `chat-stop`, `leaveConversation`/`killCharacter` actions hitting the player):
1. `isOpen=false`; `nextCheckpointEpoch = votcCheckpointEpoch + 1`;
2. No identity → throw `CampaignIdentityUnavailableError` → catch, report, and fall back to `CLOSE_CONVERSATION_ONLY_EFFECT` (only triggers the 9002 release scene, does not advance the checkpoint);
3. `runConversationTimelineTransition` (atomic-advance, requestKey is the UUID of this close) → `buildCloseConversationEffect(epoch, timeline)` writes `run/votc.txt` → mod `talk_window_counter` executes: set variables + `VOTC:CHECKPOINT/;/set` receipt + trigger 9002 (deletes the `talk_scene` global, clears the mcc roster = release) and 9003;
4. `closeStamp = {checkpointEpoch, timelineNodeId}` is set only when the transition succeeds (:2016-2018); finally `clearCloseRequestKey` ensures the next close gets a new UUID (§9.3 fix C1).

**History/summary writing** (`_saveHistoryToFile` :2043-2149, `_generateSummariesAndDiariesInBackground` :2151-2254):
- Conversation history txt: `<userData>/votc_data/conversation_history/<playerId>/<character-ID-string>[_tl_<nodeA>-<nodeB>|_ckpt<N>]_<millisecond-timestamp>.txt` — a node present stamps `_tl_`; a v2 failure falls back to `_ckpt<N>`; legacy has no suffix; the content header records the `VOTC checkpoint: <epoch>` / `VOTC timeline node: <id>` text (`conversationHistoryHeader.ts:22`); **when identity exists, a mirror copy is written to the campaign directory** (:2135-2145).
- Summaries: `Summary` is stamped with `votcCheckpointEpoch/votcTimelineNodeId` (:2222-2231), but writing still lands in the **legacy flat directory** `conversation_summaries/<playerId>/<charId>.json` (the campaign directory currently only appears in read-side merging, `summaryManager.ts:283-287`); a missing closeStamp (legacy/failure) means no stamping → visible on all branches.
- `summaryFileWatcher.pauseWatcher` before writing to avoid self-triggering (:2237-2249).

### 10.2 Letters (Full Lifecycle)

**Storage**: `votc_data/letter_history/<playerId>/<characterId>.json` (`ILetter[]`; `ILetter` carries the timeline five-tuple `timelineScript/timelineEpoch/timelineCampaignId/timelinePlayerId/timelineNodeId`, `letterInterfaces.ts:28-36`). The pending-delivery queue `storedLetters: Map<originalLetterId, StoredLetter>` is an **in-memory Map in main.ts** (:286).

**Letter writing (game side)**: character interaction → `message_event.360` allocates a free thread global from `votc_letter_1..9` → **two-phase**: `votc_prepare_checkpoint_advance_effect` (pre-bump snapshot) → `log_gamedata_v3l` (the letter init variant, the app gets the pendingToken) → `votc_bump_checkpoint_effect` (epoch+1, pending promoted) → `debug_log` expands `message_text`, producing the `VOTC:LETTER/;/<body>/;/letterId/;/totalDays/;/delay/;/` data line → `message_event.361` after a 1-day delay (copies the `VOTC:LETTER` clipboard).

**App receives → generates reply** (`main.ts:1567-1736`): `clearLettersFile` → `parseLog` after 250 ms → `parseLettersFromLog` (last 1MB) → `saveLetter` persists → the original letter is marked `generating` → `LetterReplyGenerator.generateLetterReply`:
1. `requireCampaignIdentity` (no identity → `return null`);
2. `nextCheckpointEpoch = epoch+1`; eventSignature includes the **letter content sha256-16** (so journal attempts from an old branch are not reused when a slot is reused after rollback);
3. **Before the LLM call**, `runLetterReplyTimelineTransition` (post-bump-node-only) creates the reply node + script, and `writeLetterReplyFallbackRunFile` writes `run/letter<N>.txt` (ensures the thread is cleared and the node applied even if retries are exhausted; receipt `VOTC:FALLBACK`);
4. LLM → `saveLetterHistory` persists the reply letter + timeline five-tuple → returns and enqueues into `storedLetters` (`expectedDeliveryDay = totalDays + delay`).

**Delivery** (`checkAndDeliverLetters`, `main.ts:410-561`, triggered by `updateCurrentDate`/rehydrate/generation completion):
1. `currentTotalDays===0` returns immediately; in-memory pre-scan (`campaignMismatchSkips` prevents rescanning the whole log on every 2s heartbeat);
2. `parseLog` (falls back to gameDataCache on failure); `conversationOpenChecker()` (when a conversation holds talk_scene, the mod runner is paused and a written reply cannot be executed for confirmation → defer);
3. 60s without `VOTC:LETTER_ACCEPTED` → clear lastLetterSent + `clearLettersFile` (prevents an old reply from replaying on the next letter write);
4. Per letter: `resolveDeliveryIdentity` (the evidence snapshot unifies campaign+player) → `evaluateReplyDeliveryGate` (`letterDeliveryGate.ts:50-75`: a reply without a campaign stamp and `allowUnstampedLegacyReplies` → check player only; unknown/mismatched campaign or mismatched player → reject and record `campaignMismatchSkips`) → `resolveCurrentTimelineNodeId` → `letterManager.deliverLetter(storedLetter, config, date, currentTimelineNodeId)`;
5. `deliverLetter` (`LetterManager.ts:347-434`) overwrites `run/letters.txt` whole-file: VOTC:DATE heartbeat first line + `remove_global_variable ?= votc_<letterId>` (release thread) + `create_artifact` (scroll reply artifact, body escaped) + `set_global_variable votc_latest_letter` + `trigger_event = message_event.362` + **timeline script (re-validated at delivery: the current node must equal the reply node or its graph parent, otherwise the script is dropped and only the letter is sent; falls back to registry head when there is no evidence)**.

**Confirmation and fallback**:
- `VOTC:LETTER_ACCEPTED` (copied by mod-side `message_event.362` when opening the letter window): `clearLettersFile` + `markAsDelivered` + release lastLetterSent (:1444-1477);
- `VOTC:FALLBACK/;/applied|skipped` (log tail): `clearLettersFile` (:729-735);
- **Generation-failure fallback**: `deliverFallbackRunBlockToGame` → `fallbackDeliveryGate` (no transition identity → let through directly; otherwise evidence scan + `evaluateReplyDeliveryGate` + node-drift script drop) → `deliverLetterFallback` takes the same letters.txt channel.

**Startup / boundary behavior**: at app startup `letters.txt` is reset to the heartbeat placeholder (prevents replay of leftovers from the previous session, `main.ts:854-877`); `initCurrentDateFromLog` restores `currentTotalDays` from the last 512KB; `rehydratePendingReplyLetters` scans all campaign stores to re-enqueue replies that are `pending && !delivered && replyToId` (letters from other campaigns are blocked by the delivery gate); `updateCurrentDate` with time going backwards / jumping >120 days clears out-of-range letters; a player switch clears the cache and the queue; `storedLetters.clear()` when the VOTC:IN player changes (:1367-1373).

### 10.3 History and Archive Windows

**Window opening**: mod decision `votc_conversation_history_decision` → `votc_init_checkpoint_effect` + `debug_log VOTC:conversation_history/;/pid/;/epoch` + `trigger_event votc_checkpoint_event.9001` (copies the bare `VOTC:CONVERSATION_HISTORY`) → app handler (`main.ts:1521-1556`): with a payload, `decideManagerWindowContext` parses it into `conversationHistoryContext`; **the 2CE mod has no payload** → `conversationHistoryContext = undefined` → the history channel takes the legacy derivation path.

**5 IPC channels** (`timelineIpc.ts`; the renderer `public/historyWindow/conversationHistoryRenderer.js` uses ipcRenderer directly, bypassing preload):

| channel | renderer call | behavior |
|---|---|---|
| `get-conversation-history-ids` | :114 | with window context → `resolveTimelineWindowRequest` + `archiveFutureArchiveHistoryForPlayer` (future archiving) returns the merged context; without → `parseConversationHistoryIdsFromLog` (returns only playerId/epoch) |
| `get-conversation-history-files` | :160 `(playerId, epoch)` | viewer list (three-state reading below) |
| `read-conversation-history-file` | :250 | single file content (branch/epoch/campaign triple check) |
| `get-archive-history-entries` | :146 | letter/battle archive aggregation (silently degrades to an empty list on "No handler registered") |
| `close-conversation-history` | :96 send | close window |

**`resolveTimelineWindowRequest` (with the round-6 fix)**:
- With a window context and matching playerId → used as source; `source.protocol` present → `requireCampaignIdentity` + `loadCampaignStoreWithMigration` (campaign registry), otherwise `loadRegistryForContext` (legacy player-only, display-only);
- **Without a window context but with debugLogPath** (legacy mod flow): `deriveLegacyWindowContext` derives an equivalent context from the latest trustworthy log state — a valid init snapshot is the base; if the evidence has a campaignId (a load line beats init, regardless of any later checkpoint) → rebuild the protocol tail from the load line; if the fresher load fails to parse → fail-closed returns undefined (does not resurrect the old init campaign); if a checkpoint is newer → overwrite node/epoch/player. The result is cached by `logPath+playerId+size+mtime` and reused by all channels of the same window (`_private_resetLegacyWindowContext` is a test seam);
- **registry head fallback** (derivation path only): if parsing still yields no node but identity exists → take the campaign registry node with the newest `createdAt` as `timelineNodeId` (otherwise all new `_tl_` records would be filtered out — this is exactly the empty list reproduced in round-6 P1).

**`conversationHistory.ts` three-state reading**:
- Directory candidates: `[campaign dir, legacy dir]` (when identity exists, campaign first), dedup by filename;
- **Cross-campaign claim filtering**: transcripts by filename (`collectHistoryNamesClaimedByOtherCampaigns` :90-109 — filenames held by another campaign's conversation_history directory are hidden from this campaign's legacy copies); letter/battle report JSON by record-level stableKeys+fingerprint (`collectRecordsClaimedByOtherCampaigns` :125-146);
- `getConversationHistoryFiles` (:485-532): `_tl_` files require `registry && currentNodeId && isRecordVisible`; files without node markers are epoch-filtered by `_ckpt(\d+)_`;
- `readConversationHistoryFile` (:537-584): basename validation; an invisible `_tl_` throws "does not belong to the current branch"; an `_ckptN` ahead throws "belongs to a later point in time"; records claimed by another campaign return `''`;
- Archive: `getLetterHistoryEntries` (:657-727, including `getChatLetterEntries` reading LetterManager's actual storage), `getBattleReportHistoryEntries` (:784-850) — campaign+legacy JSON merge + claim filtering + classify (tolerant promotion of the v1 schema) + `isRecordVisibleForContext`;
- **future archiving**: `archiveFuture*` (:857-987) annotates future records with `{archivedAt, archiveReason, archivedFromCheckpointEpoch}` and moves them into `_archived`; the archive is written before the source file is atomically rewritten (re-read before writing to prevent concurrent loss); records with `votcTimelineNodeId` are **never** archived by epoch (graph visibility has the final say); the only production trigger is the ids channel's `archive_viewer_checkpoint_filter`.

### 10.4 Summaries (`summaryManager.ts`)

Summary writing is in the legacy flat directory (see 10.1); reading merges the campaign directory. Checkpoint-related utilities: `getSummaryCheckpointEpoch` (:12), merge key `getSummaryIdentityKey` (includes the nodeId dimension, :33-41), `splitSummariesForCheckpoint` (:43), `filterSummariesForCheckpoint` (:57), `archiveFutureSummariesForCheckpoint` (:61, archived to `conversation_summaries_archived/<playerId>/`), `readSummaryFile` (:268) first epoch-filters then branch-filters via `isRecordVisibleForContext` (:343-350). The `read-summary-file` IPC (`main.ts:2334-2366`) goes through `resolveTimelineWindowRequest` (no log path → legacy parts-only behavior; unchanged by round 6).

### 10.5 Battle Reports (code ready, unwired on this branch)

`src/main/battleReport/`: `buildBattleReportRunScript` (`battleReportRunScript.ts:224-230`) generates a **guard commit script** when there is a commit — `if exists global_var:votc_battle_report_<slot>` (+deliveryId guard) → `VOTC:TIMELINE/;/commit/;/<attemptId>/…` → a two-level decision on live in-save variables (`[THIS.Var(...).GetValue|0]`): epoch/token match observed → set node variables + `VOTC:CHECKPOINT/;/set` receipt + `applied`; epoch already ahead → `skipped_advanced`; node mismatch → `ambiguous_node`; nothing matches → `skip_delivery_mismatch`. The result line `VOTC:TIMELINE/;/commit_result/…` is parsed by the app. `runBattleTimelineBatchTransition` + `timelineCoordinator` gap-detection ordering are ready. **But on this branch `generateBattleReport` has no production caller, and `BattleReportGenerator.writeBattleReport` still writes the old `run/battle_report<N>.txt` without timeline fields** — the "ready but unwired" state aligned with the 1.x port.

### 10.6 incoming_letter / bookmark (unwired)

`runIncomingLetterTimelineTransition` (wire :430) has no production caller. `recordBookmarkImport` (:647) has no production caller; the `VOTC:BOOKMARK` handler only takes `parseLogForBookmarks` + `processBookmarkToSummary` (legacy summary path, does not touch the timeline).

### 10.7 Game Log Listener Bus

Two complementary channels:
- **ClipboardListener** (100 ms polling): one-shot event triggers (open conversation / open window / incoming letter / confirmation);
- **debug.log tail** (`fs.watchFile` 2s incremental, `main.ts:772-807`): continuous data (`VOTC:DATE` heartbeat → `updateCurrentDate` → triggers delivery checks; `VOTC:CAMPAIGN loaded` → observer; `VOTC:FALLBACK` → clear letters.txt).

Note the CK3 log subsystem has a **~17MB per-session cumulative write limit** (debug/error shared; external truncation does not reset the counter), and the mod resets it with `log.clearAll` executed when the scene-selection widget is created — this slot must not be omitted (see the AGENTS.md hard rule).

## 11. Mod-side Companions (`voices_of_the_court_mod2 ce`)

### 11.1 Checkpoint/Campaign Primitives (`common/scripted_effects/votc_checkpoint_effects.txt`)

| effect | purpose |
|---|---|
| `votc_generate_pending_checkpoint_token_effect` | 1+28 random bits → 29-bit non-zero pending token (∈[2^28,2^29-1]) |
| `votc_generate_campaign_id_segment_effect` ×4 + `votc_generate_campaign_id_effect` | generate and commit the 4-segment campaign id to globals, **schema=1 written last** (a crash in the half-committed state is judged corrupt rather than silently swapping keys) |
| `votc_validate_campaign_id_effect` | detect corruption of the committed id → global `votc_campaign_corrupt`; never silently rebuilds |
| `votc_init_campaign_id_effect` | idempotent bootstrap with three branches (complete → clear flags; corrupt → log `VOTC:CAMPAIGN/;/corrupt`; none → set bootstrapKind, generate, commit, log `/created`) |
| `votc_init_checkpoint_effect` | fill missing player checkpoint variables with zeros + generate a pending token if none |
| `votc_prepare_checkpoint_advance_effect { SOURCE = … }` | pre-bump snapshot `VOTC:TIMELINE/;/snapshot/…` (the token column is the pendingToken) — must be called **before** the init snapshot that will subsequently bump |
| `votc_bump_checkpoint_effect { SOURCE = … }` | promote pending, epoch+1, refresh day, log `/bump` + `/timeline/bump` |

Variable persistence: campaign variables are all global (retained with the save); checkpoint variables are player character variables; the mod **never proactively writes non-zero node/parent**.

### 11.2 Save-Load Identity Line

`common/on_action/votc_game_start_init_on_actions.txt`: appends `on_actions = { votc_game_start_init_relay }` to the vanilla `on_game_start_after_lobby` (the official relay pattern — that vanilla on_action already has an effect block, and appending an effect directly would be silently ignored by the engine). The relay runs `votc_init_checkpoint_effect` for each human player and then emits the `VOTC:CAMPAIGN/;/loaded` line. bootstrapKind: 1 new / 2 with old checkpoint state / 3 legacy VOTC global traces (detection deliberately narrowed; on a miss it degrades to reporting 1).

### 11.3 Clipboard Bridge and Decisions

`common/decisions/votc_decisions.txt`: `votc_conversation_history_decision` (init_checkpoint + `VOTC:conversation_history` log line + trigger 9001), `votc_relaese_letter_decision` / `votc_relaese_battle_report_decision` (manual thread/slot clearing; "relaese" is a historical spelling). The copy widget template `gui/event_window_widgets/event_window_widget_talk_clear.gui:12` (`on_finish = CopyToClipboard`). The three conversation entries `mcc_event_v2.8999/9000/9001` (desc `VOTC:IN`), action confirmation 9003 (desc `VOTC:EFFECT_ACCEPTED`), close conversation 9002 (**the widget does not copy to the clipboard**; closing actually relies on the votc.txt written by the app). `votc_open_summary_manager_effect` is a stub annotated "[2CE] no caller" (mod1's `hmd_event.9004` was not ported).

### 11.4 Letters Channel

`message_event.360` writes a letter → allocate thread + two-phase bump + `VOTC:LETTER` data line → `mcc_event_v2.9998` creates the `letters_runner` (the `_show` state's create immediately does `run letters.txt`; `_show2` recreates itself after 2s, forming the poll; gated by `Not(talk_scene IsSet)` — paused during conversations; `mcc_event_v2.9999`'s clear widget stops it). `message_event.362` (widget `message_open`) first copies `VOTC:LETTER_ACCEPTED` and then opens the votc_letter window.

### 11.5 Conversation Scene hold/release

The `talk_scene` global existing = the conversation holds the scene (both letters_runner and the votc.txt polling pause); `mcc_event_v2.1003` sets the scene flag (60+ scenes), the `log_backgrounds` effect picks a background texture by scene+location and sends it to the app via the `mcc_event_v2.7001` clipboard `VOTC:BACKGROUND/;/<flag>`; 9002 deletes `talk_scene` = release.

### 11.6 Test Scripts (`run_test_scripts/`)

`votc_test_campaign_id.txt` (full created/idempotent/corrupt-detection flow, expected outputs listed in the file header), `votc_test_checkpoint_token.txt` (uniqueness across 16 generations), `votc_checkpoint_bump/read.txt` (independent test variables verifying cross-session persistence), `votc_test_battle_checkpoint_bump.txt` (bump primitive + Phase 9 out-of-order replay manual steps).

## 12. End-to-End Walkthrough

### 12.1 New Campaign Start

`on_game_start_after_lobby` → relay → per human player: `votc_init_campaign_id_effect` (bootstrapKind=1, generates the 4-segment id, `votc_campaign_schema=1` committed last) + `votc_init_checkpoint_effect` (zero-fill + generate pending token) → `VOTC:CAMPAIGN/;/loaded/;/…/;/1/;/0/…`. `observeCampaignLoadLine` records observedLoad at app startup/tail (kind=1 does not pop a dialog).

### 12.2 Loading a Save (Including Upgrading an Old Save)

The same relay fires; campaign variables are read back from the save; kind=2/3 → the app shows "save upgraded to campaign <id>" once per campaign. At this point the log may not contain any init block yet — **the loaded line is the only identity evidence after a bare save load**, so the load-line-over-old-init priority in evidence scanning is existential.

### 12.3 Conversation Open → Close (One Full Epoch)

1. mod conversation event: `set_global_variable talk_first/second_scope` + init_checkpoint + `log_gamedata_v3*` (the init block carries the trailing timeline/campaign/save snapshot fields) → the widget copies `VOTC:IN`;
2. app: parseLog → Conversation (captures identity) → chat window;
3. during the conversation: app actions write votc.txt → executed by the 0.4s poll → 9003 receipt; letters_runner paused;
4. close: `epoch+1` → `runConversationTimelineTransition` (lock → campaign store → strict parent resolution → journal beginTransition/commit → script) → votc.txt;
5. mod executes: set variables + `VOTC:CHECKPOINT/;/set` receipt + 9002/9003;
6. app: the tail sees the receipt (the evidence snapshot refreshes — subsequent deliveries/history windows all see this new node); background summaries are stamped with closeStamp; the history txt `_tl_<node>` is written to both legacy and campaign directories.

### 12.4 Letter Full Chain

See 10.2. Key points: the mod's two-phase bump precedes app generation; the app creates the journal attempt + fallback file before calling the LLM; delivery is a gate-driven loop powered by the DATE heartbeat; letters.txt is a single-channel overwrite, and the timeline script is re-validated at delivery.

### 12.5 History Window (2CE No-Payload Path)

Decision → bare `VOTC:CONVERSATION_HISTORY` → `conversationHistoryContext=undefined` → the renderer calls ids (the log line provides playerId/epoch) → files/read/archive go through `resolveTimelineWindowRequest` **log-derived context** (init snapshot + load/checkpoint overrides + caching + registry head fallback) → campaign registry loading → three-state visibility + cross-campaign claim filtering → future records archived immediately.

### 12.6 Rollback / Save-Switch Protection Chain

| Scenario | Protection |
|---|---|
| loading a save to an earlier point | the loaded line refreshes the evidence → the delivery gate rejects cross-campaign/player replies; the history window future-archives; conversation summaries get epoch+graph double filtering |
| replaying an old transition after save rollback | journal `classifyReconciliation` observed match → new-attempt; `reconcileAttemptFromSnapshot` detects reloadRedo |
| branch drifted by delivery time (node moves after a conversation completes) | round 6: the checkpoint receipt node > the init snapshot node; LetterManager's current node ≠ reply node/its parent → drop the script and send only the letter |
| cross-campaign data bleed | campaign directory isolation + filename/record-level claim filtering + identity header validation (`identity_mismatch` = corrupt) |
| crash mid-write | tmp+manifest+sha256+revision continuity; 3-level backups; corrupt quarantine + write blocking + user reporting |

## 13. Key Invariants and Failure Modes Checklist

**Protocol/format**
- Log lines are always substring-matched + split on `/;/`; strip `\r` from the CRLF last segment; `0` is a sentinel, not an id.
- The init line tail layout is invariant: new fields may only be inserted between `timeline_schema` and the save snapshot placeholders (comment in `log_gamedata_v3_effect.txt:3-5`).
- The first line of letters.txt must be the VOTC:DATE heartbeat; `clearLettersFile` restores the placeholder instead of emptying.
- Single-channel whole-file overwrite: concurrent writes to letters.txt / votc.txt in the same window overwrite each other.

**Identity/writes**
- `requireCampaignIdentity` is the sole identity entry for business writes; legacy-mod / unsupported-schema / invalid are all fail-closed + reported.
- Campaign and player delivery validation must come from **the same evidence snapshot** (the round-6 P2 fix point).
- saveStoreWithIdentity validates twice, before and after writing; an envelope identity-header mismatch = corrupt.

**Concurrency/recovery**
- Lock first, then load-migration, then beginTransition; the journal never executes outside the lock; `withTimelineLock` is not reentrant.
- Token conflicts → ambiguous, no epoch fallback; reconciliation ambiguous → throw and refuse to guess.
- terminalEvidence is written once and immutable; synthetic already-applied never overwrites real evidence.

**Known external constraints**
- CK3's 17MB per-session cumulative log limit → can only be reset by the mod-side `log.clearAll` slot (scene-selection widget).
- The 2CE mod does not emit a manager payload (the 9 fields belong to mod1); the history window relies on app-side log derivation; the `SUMMARY_MANAGER`/`BOOKMARK` clipboard commands are supported by the app but the mod has no corresponding events.

## 14. Differences from 1.x: Memo

- 2CE has no 1.x Rust save-facts sidecar / SaveSnapshotWaiter; conversation snapshot identity determination uses the init-line timeline protocol tail (`requireCampaignIdentity`); save snapshot sequence/slot only serves as components of the agency fingerprint (`agencyTypes.ts:126-131`).
- 1.x's `hmd_event.9004` manager-window flow was not ported; the 2CE history window context comes from the clipboard bare command + log derivation.
- The battle report / incoming_letter / bookmark sources are ported but unwired in 2CE (productionized in 1.x).
- Summary writing still lands in the legacy flat directory (same as 1.x); the campaign directory is read-merge only.

## 15. Test Map (`pr15-legacy-compat/tests/`)

| Suite | Coverage |
|---|---|
| `timelineManager` / `timelineResolver` / `timelineProtocol` / `timelineJournalApi` / `timelineTransitionJournal` / `timelineLock` / `timelineRecovery` / `timelineCommitResult` / `timelineCoordinator` / `timelineAtomicWrite` / `timelineRegistryFailClosed` / `timelineRegistryValidatorLoad` / `timelineStoreLoad` / `timelineBusinessWire` / `timelineJournalApi` | Core: registry/resolver/journal state machine/reconciliation/locking/atomic writes/corrupt recovery/batch ordering |
| `pr15Review` / `pr15Second~FourthReview` / `pr15CurrentReviewRepro` | Regression from the review rounds (repro tests for fixes in rounds R2-R5) |
| `reviewEntryPoints.test.ts` | **Round 6**: checkpoint receipt anti-sibling-branch-hijack, loaded line supplying player, payload-less history IPC listing (3 repros + 1 skipped baseline known issue) |
| `compat/campaignLoadIdentity` | loaded line parsing/observation/CRLF |
| `compat/pendingReplyDelivery` | cross-campaign delivery gating (campaignMismatchSkips etc.) |
| `compat/legacyDataCompat` | §8 migration/staging |
| `compat/pr15AcceptanceReview` | acceptance baseline |
| `gameData/parseLogP0` / `gameData/characterFacts` | init block parsing/character facts |
| `tests/unit/conversation/*compaction*`, `apiConnection`, `localization/compaction*`, `resilience/compaction*`, `tests/main.test.ts`, `tests/votc146.test.ts` | **failing at baseline** (compaction-related TS compile errors / references to non-exported symbols), unrelated to this system; exclude when running the full suite |

Verification entry points: `npm run build` (tsc); `npx jest tests/unit/timeline tests/unit/gameData tests/unit/compat tests/unit/pr15 tests/unit/reviewEntryPoints --silent` (27 suites / 573 tests green, baseline @ `44edf99a`).
