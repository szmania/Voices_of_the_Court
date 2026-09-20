// Prompt values are owned by the preset editor and saved via save-prompt-presets,
// not by the generic config-change channel.
export const promptKeys = [
    'mainPrompt', 'selfTalkPrompt', 'summarizePrompt', 'selfTalkSummarizePrompt',
    'memoriesPrompt', 'suffixPrompt', 'narrativePrompt', 'sceneDescriptionPrompt',
    'actionPrompt', 'actionTriggeredPrompt', 'letterPrompt', 'letterSummaryPrompt',
    'diaryPrompt', 'diarySummarizePrompt', 'diaryForLetterPrompt', 'suggestionPrompt'
] as const;

export function isPromptKey(key: string): boolean {
    return (promptKeys as readonly string[]).includes(key);
}
