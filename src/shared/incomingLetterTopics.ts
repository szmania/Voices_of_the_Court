// 25 letter topic types (matching VALID_TYPES in IncomingLetterGenerator)
export type IncomingLetterType = 
  | 'vassal_memorial' 
  | 'siege_report' 
  | 'lost_holding' 
  | 'family_letter' 
  | 'poetry_letter' 
  | 'courtier_petition' 
  | 'rival_taunt' 
  | 'dear_friend_greeting' 
  | 'letter_to_travelling_player' 
  | 'ally_call_for_aid' 
  | 'revolt_urgent' 
  | 'deathbed_letter' 
  | 'pilgrimage_tales' 
  | 'tour_tales' 
  | 'wedding_tales' 
  | 'hunt_tales' 
  | 'tournament_tales' 
  | 'travel_tales' 
  | 'faction_warning' 
  | 'scheme_exposed' 
  | 'natural_disaster' 
  | 'tributary_letter' 
  | 'liege_overlord_letter' 
  | 'great_work_notice' 
  | 'great_project_report';

// 25 letter topic types array
export const INCOMING_LETTER_TOPICS = [
  'vassal_memorial',
  'siege_report',
  'lost_holding',
  'family_letter',
  'poetry_letter',
  'courtier_petition',
  'rival_taunt',
  'dear_friend_greeting',
  'letter_to_travelling_player',
  'ally_call_for_aid',
  'revolt_urgent',
  'deathbed_letter',
  'pilgrimage_tales',
  'tour_tales',
  'wedding_tales',
  'hunt_tales',
  'tournament_tales',
  'travel_tales',
  'faction_warning',
  'scheme_exposed',
  'natural_disaster',
  'tributary_letter',
  'liege_overlord_letter',
  'great_work_notice',
  'great_project_report'
] as const;

export type IncomingLetterTopic = typeof INCOMING_LETTER_TOPICS[number];

export const INCOMING_LETTER_TOPIC_MAP: Record<IncomingLetterTopic, string> = {
  vassal_memorial: 'vassal memorial',
  siege_report: 'siege report',
  lost_holding: 'lost holding',
  family_letter: 'family letter',
  poetry_letter: 'poetry letter',
  courtier_petition: 'courtier petition',
  rival_taunt: 'rival taunt',
  dear_friend_greeting: 'dear friend greeting',
  letter_to_travelling_player: 'letter to travelling player',
  ally_call_for_aid: 'ally call for aid',
  revolt_urgent: 'revolt urgent',
  deathbed_letter: 'deathbed letter',
  pilgrimage_tales: 'pilgrimage tales',
  tour_tales: 'tour tales',
  wedding_tales: 'wedding tales',
  hunt_tales: 'hunt tales',
  tournament_tales: 'tournament tales',
  travel_tales: 'travel tales',
  faction_warning: 'faction warning',
  scheme_exposed: 'scheme exposed',
  natural_disaster: 'natural disaster',
  tributary_letter: 'tributary letter',
  liege_overlord_letter: 'liege overlord letter',
  great_work_notice: 'great work notice',
  great_project_report: 'great project report'
};

// Union type combining IncomingLetterType and IncomingLetterTopic
export type LetterTypeOrTopic = IncomingLetterType | IncomingLetterTopic;