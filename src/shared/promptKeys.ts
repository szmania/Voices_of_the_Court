<<<<<<< HEAD
// Prompt values are owned by the preset editor and saved via save-prompt-presets,
// not by the generic config-change channel.
export const promptKeys = [
    'mainPrompt', 'selfTalkPrompt', 'summarizePrompt', 'selfTalkSummarizePrompt',
    'memoriesPrompt', 'suffixPrompt', 'narrativePrompt', 'sceneDescriptionPrompt',
    'actionPrompt', 'actionTriggeredPrompt', 'letterPrompt', 'letterSummaryPrompt',
    'whisperPrompt',
    'diaryPrompt', 'diarySummarizePrompt', 'diaryForLetterPrompt', 'suggestionPrompt'
] as const;

export function isPromptKey(key: string): boolean {
    return (promptKeys as readonly string[]).includes(key);
}
=======
// Prompt values are owned by the preset editor and saved via save-prompt-presets,
// not by the generic config-change channel.
export const promptKeys = [
    'mainPrompt', 'selfTalkPrompt', 'summarizePrompt', 'selfTalkSummarizePrompt',
    'memoriesPrompt', 'suffixPrompt', 'narrativePrompt', 'sceneDescriptionPrompt',
    'actionPrompt', 'actionTriggeredPrompt', 'letterPrompt', 'letterSummaryPrompt',
    'diaryPrompt', 'diarySummarizePrompt', 'diaryForLetterPrompt', 'suggestionPrompt',
    'incomingLetterPrompt'
] as const;

export function isPromptKey(key: string): boolean {
    return (promptKeys as readonly string[]).includes(key);
}
>>>>>>> v2.2.0-rc.1
