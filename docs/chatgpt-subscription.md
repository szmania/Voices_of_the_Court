# ChatGPT subscription provider

In Connection settings select **OpenAI (ChatGPT subscription)**, click **Continue with ChatGPT**, and complete authorization in your system browser. Choose an available model and use **Test Connection**. No API key or Codex installation is required.

One active ChatGPT account supplies all subscription connections. Summaries and actions can inherit the main connection or select this provider separately. Letters, diaries, battle reports, suggestions, and scene descriptions use their existing text-provider settings. Embeddings still require a separate embedding provider. This change does not wire the existing unfinished LLM memory-compaction method.

Eligible requests use your ChatGPT plan under OpenAI's account, workspace, and app limits. **Manage usage** opens ChatGPT settings. A limit pauses new subscription requests; review your allowance and explicitly use **Test Connection** to retry. VOTC never automatically switches to API-key billing.

This is a preview integration. Sampling controls, penalties, stop sequences, and the configured maximum output tokens are not supported by this route. VOTC always receives a stream, even when streaming display is disabled. Only completed responses are saved; failed or interrupted responses do not produce actions. Available models come from your signed-in account, and an unavailable saved model is visibly replaced with the first listed model in settings.

Tokens are stored outside campaign/configuration exports, encrypted with Electron's OS storage. If secure storage is unavailable, credentials last only for the current VOTC session. On sign-out VOTC clears local credentials and attempts remote revocation. If revocation cannot be confirmed, disconnect VOTC in ChatGPT settings. To switch accounts or workspaces choose **Use a different account or workspace**. Do not share the `chatgpt-auth` directory, authorization URLs, or credentials.

Provider controls are localized; recovery messages use English defaults where translations have not yet been supplied. VOTC's existing Node-enabled renderer architecture remains unchanged; encryption at rest is not isolation from other applications running as the same OS user.

## Release verification

Development checks: the TypeScript build and 58 focused Jest tests pass across OAuth, transport, credential storage, settings UI, configuration, and letter regressions. The settings fixture also executes four DOM checks against the real component and provider-selector code. These checks use synthetic credentials. Packaged Windows startup and native module loading were checked, and a player confirmed live browser sign-in. Live game generation, restart persistence, and background features remain release checks.

The broader existing provider and compaction suites were attempted but cannot run as written: `apiConnection.test.ts` and `api-connections.test.ts` contain outdated constructor calls (and duplicate imports), `deepseek-model-config.test.ts` requires an absent Jest DOM environment, and the compaction configuration/prompt fixtures reference outdated exports and fields. Those unrelated test repairs are outside this change. The entire repository test suite has not been validated.

Automated tests use synthetic accounts and a local callback server, never a real user's credentials. Before public release, exercise login, reconnect after restart, Test Connection, streaming chat, and background summarization in a packaged Windows build with an eligible account. Verify macOS/Linux callback and storage behavior before claiming support. A passing build or mocked test does not establish live subscription eligibility or packaged behavior.

References: [OAuth registration](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference), [limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations), [sessions](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions).
