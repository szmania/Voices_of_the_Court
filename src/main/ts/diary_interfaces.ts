export interface DiaryEntry {
    id: string;
    date: string;
    location: string;
    scene: string;
    participants: string[];
    content: string;
    character_traits: { [key: string]: string };
    creationTimestamp?: Date;
}

export interface DiarySummary {
    id: string;
    diaryEntryId: string;
    date: string;
    summary: string;
    characterId?: string;
}
