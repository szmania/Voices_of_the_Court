# Configuration Guide: Prompt Resolution Hierarchy for Incoming Letters

## Prompt Resolution Hierarchy

When generating incoming letters, the system follows this precedence chain to determine which prompt content to use:

### 1. Per-Type Override (Highest Priority)
- **Location**: User-editable in the Prompts tab
- **File**: `default_userdata/configs/prompts/incoming_letters/<locale>.json`
- **Key**: `categorizedIncomingLetterPrompts[<IncomingLetterType>]`
- **Purpose**: Allows users to customize prompts for specific letter types (e.g., siege_report, poetry_letter, etc.)

### 2. Shared Incoming Letter Prompt
- **Location**: `default_userdata/configs/prompts/incoming_letters/<locale>.json`
- **Key**: `incomingLetterPrompt`
- **Purpose**: Provides a general prompt template used when no per-type override is set

### 3. Per-Type Default Prompt
- **Location**: `default_userdata/configs/prompts/incoming_letters/<locale>.json`
- **Key**: `defaultPrompts[<IncomingLetterType>]`
- **Purpose**: Provides type-specific default prompts when no user override exists

### 4. General Default Prompt (Lowest Priority)
- **Location**: `default_userdata/configs/prompts/incoming_letters/<locale>.json`
- **Key**: `defaultPrompt`
- **Purpose**: Fallback prompt used when no other prompt definitions exist

### Resolution Chain
1. **Per-Type Override** (`categorizedIncomingLetterPrompts[<type>]`) — User-set per type → takes highest priority
2. **Shared Prompt** (`incomingLetterPrompt`) — Used if no per-type override exists
3. **Per-Type Default** (`defaultPrompts[<type>]`) — Fallback for specific types
4. **General Default** (`defaultPrompt`) — Final fallback

### Example Flow
For a `siege_report` letter:
1. Check `categorizedIncomingLetterPrompts[siege_report]` (user override)
2. If empty, check `incomingLetterPrompt` (shared prompt)
3. If still empty, check `defaultPrompts[siege_report]` (per-type default)
4. If still empty, use `defaultPrompt` (general default)

### Important Notes
- **Placeholders**: Prompt content uses `{{placeholder}}` syntax substituted at runtime (e.g., `{{playerName}}`, `{{topicLabel}}`)
- **Localization**: All prompt strings are translated via `public/locales/*.json` files
- **Preservation**: The `STABLE_INCOMING_LETTER_POLICY` string remains byte-identical across requests to maintain KV-cache stability
- **Validation**: The system validates placeholders against known valid placeholders for the selected letter type

### Implementation Notes
- `IncomingLetterGenerator` uses `resolveInstructionPrompt()` to handle the resolution chain
- Placeholder substitution occurs after resolution using the `substitute()` function
- All prompt strings are loaded through `loadIncomingLetterPrompts()` which handles locale fallbacks (config.language → en → zh)

### Verification
Tested with:
- Multiple locales (en, zh, de, fr, es, ja, ko, pl, pt, ru, etc.)
- All 25 letter types
- Various placeholder combinations
- Locale fallback behavior
- User-edited overrides

This documentation should be reviewed and updated as needed during future localization or prompt customization changes.