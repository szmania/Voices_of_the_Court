# Court Chronicle (P2)

The court historian collects visible conversations, incoming and outgoing letters, character memories, and existing battle reports in the current campaign/player namespace. Manual generation, quarterly or yearly generation, failed-attempt retry and entry regeneration use the existing summarization provider. Automatic generation can be disabled without disabling the manager.

Open **Court Chronicle** from the paired CK3 mod's decisions. Configure frequency, source-character budget, output-token limit and the historian prompt in Settings. The new controls use the existing configuration and localization system. English and Simplified Chinese are translated; other app languages initially use English for the new namespace.

Entries, generation attempts, frozen memory observations and digest caches live under `votc_data/campaigns/<campaignId>/players/<playerId>/chronicle/`. Timeline visibility and numeric game dates filter the sources. Late material can request a revision; regenerating an entry increments its revision number. A corrupt store fails closed instead of replacing existing history. Chronicle observation failures do not interrupt conversations or letter delivery.

The paired mod emits a 25-field `CHRONICLE_TICK` / `CHRONICLE_MANAGER` payload and a request-matched memory block. Both clipboard and debug-log transports are supported. Ordinary snapshots include the numeric game-date five-tuple, while legacy display-only records are adapted into the CK3 calendar. Its year-zero, 365-day count was checked against actual game-log tuples (`1066.11.21 = 389415`, `1067.2.12 = 389498`). Existing generic date helpers retain their behavior for other features.

This port reuses the completed source-line chronicle modules, adapts provider results and token counting to the current release API, and keeps internal purpose metadata out of provider requests. It adds canonical outgoing-letter sources alongside the existing letter UI history. Timeline export belongs to a later roadmap step and has no button or IPC channel in this PR. New battle-report capture remains in P3.

## Validation

- `npm run build`
- Run the `tests/unit/chronicle*.test.ts` suites and `tests/unit/clipboardListener.chronicle.test.ts` with `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath <explicit paths>`.
- Run the paired mod's `python tools/check_chronicle_protocol.py --mod-root <mod> --app-root <app>` and its existing P1 protocol check.
- Full Jest must be compared with the pristine release baseline; that baseline already has 27 failing suites and one failing test.
- Electron smoke validation uses an isolated profile, a workspace-only CK3 directory and a local OpenAI-compatible endpoint. It checks app/SQLite startup, the real log bridge, window IPC, source collection, generation, sanitized Markdown and live language switching.

Game acceptance: load the paired test mod, open the decision, generate from an actual conversation/letter/memory, retry a failed generation, verify disabled/quarterly/yearly behavior, and confirm that loading a sibling save hides abandoned-branch material. Static checks and the isolated Electron test do not replace this CK3 session check.
