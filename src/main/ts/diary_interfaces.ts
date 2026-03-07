export interface DiaryEntry {
    date: string;
    location: string;
    scene: string;
    participants: string[];
    content: string;
    character_traits: { [key: string]: string };
}
