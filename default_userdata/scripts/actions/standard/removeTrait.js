//Made by: VOTC-CE

/** @import { GameData, Character } from '../../gamedata_typedefs.js' */

const BASE_GAME_TRAIT_KEYS = [
  "agile",
  "ambitious",
  "arbitrary",
  "arrogant",
  "athletic",
  "beauty_bad_1",
  "beauty_bad_2",
  "beauty_bad_3",
  "beauty_good_1",
  "beauty_good_2",
  "beauty_good_3",
  "blademaster_1",
  "blademaster_2",
  "blademaster_3",
  "blind",
  "brave",
  "callous",
  "calm",
  "chaste",
  "clubfooted",
  "compassionate",
  "content",
  "contrite",
  "coward",
  "craven",
  "deceitful",
  "diligent",
  "disfigured",
  "drunkard",
  "dwarf",
  "eccentric",
  "fickle",
  "forgiving",
  "generous",
  "gluttonous",
  "greedy",
  "gregarious",
  "grieving",
  "hale",
  "herculean",
  "honest",
  "hunchbacked",
  "improvident",
  "infirm",
  "intellect_bad_1",
  "intellect_bad_2",
  "intellect_bad_3",
  "intellect_good_1",
  "intellect_good_2",
  "intellect_good_3",
  "irritable",
  "lazy",
  "leper",
  "lisping",
  "lovers_pox",
  "lustful",
  "maimed",
  "melancholic",
  "one_eyed",
  "one_legged",
  "paranoid",
  "patient",
  "physician_1",
  "physician_2",
  "physician_3",
  "pilgrim",
  "possessed_1",
  "pregnant",
  "profligate",
  "rakish",
  "reclusive",
  "sadistic",
  "scarred",
  "scholar",
  "shrewd",
  "slothful",
  "strong",
  "stubborn",
  "temperate",
  "timid",
  "trusting",
  "vengeful",
  "wounded_1",
  "wounded_2",
  "wounded_3",
  "wrathful",
  "zealous"
];

function normalizeTraitKey(value) {
  if (typeof value !== "string") return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[-\s]+/g, "_")
    .replace(/__+/g, "_");
}

module.exports = {
  signature: "removeTrait",
  args: [
    {
      name: "trait",
      type: "enum",
      options: BASE_GAME_TRAIT_KEYS,
      desc: {
        en: "Trait key to remove from the target character (e.g. 'brave', 'lustful', 'ambitious'). Spanish intent: 'perder rasgo', 'se cura de'.",
        zh: "要从目标角色身上移除的特质关键字（例如'brave'，'lustful'，'ambitious'）。西班牙语意图：'perder rasgo'，'se cura de'。",
        ru: "Ключ черты для удаления у целевого персонажа (например, 'brave', 'lustful', 'ambitious'). Испанское намерение: 'perder rasgo', 'se cura de'.",
        fr: "Clé de trait à retirer du personnage cible (par exemple, 'brave', 'lustful', 'ambitious'). Intention espagnole : 'perder rasgo', 'se cura de'.",
        es: "Clave de rasgo para quitarle al personaje objetivo (p. ej., 'valiente', 'lujurioso', 'ambicioso'). Intención en español: 'perder rasgo', 'se cura de'.",
        de: "Merkmalsschlüssel, der vom Zielcharakter entfernt werden soll (z. B. 'brave', 'lustful', 'ambitious'). Spanische Absicht: 'perder rasgo', 'se cura de'.",
        ja: "ターゲットキャラクターから削除する特性キー（例：'brave'、'lustful'、'ambitious'）。スペイン語の意図：「perder rasgo」、「se cura de」。",
        ko: "대상 캐릭터에게서 제거할 특성 키(예: 'brave', 'lustful', 'ambitious'). 스페인어 의도: 'perder rasgo', 'se cura de'.",
        pl: "Klucz cechy do usunięcia u postaci docelowej (np. 'brave', 'lustful', 'ambitious'). Hiszpański zamiar: 'perder rasgo', 'se cura de'.",
        pt: "Chave de traço para remover do personagem alvo (por exemplo, 'brave', 'lustful', 'ambitious'). Intenção em espanhol: 'perder rasgo', 'se cura de'.",
        tr: "Hedef karakterden kaldırılacak özellik anahtarı (örn. 'brave', 'lustful', 'ambitious'). İspanyolca niyet: 'perder rasgo', 'se cura de'."
      }
    },
    {
      name: "reason",
      type: "string",
      desc: {
        en: `Optional short reason from conversation context describing why this trait is being removed. Spanish examples: 'tras la cura', 'por su arrepentimiento'.`,
        zh: "可选的简短原因，描述为何移除此特质。西班牙语示例：'tras la cura'，'por su arrepentimiento'。",
        ru: "Необязательная краткая причина из контекста разговора, описывающая, почему удаляется эта черта. Примеры на испанском: 'tras la cura', 'por su arrepentimiento'.",
        fr: "Raison courte facultative du contexte de la conversation décrivant pourquoi ce trait est retiré. Exemples en espagnol : 'tras la cura', 'por su arrepentimiento'.",
        es: `Razón corta opcional del contexto de la conversación que describe por qué se quita este rasgo. Ejemplos en español: 'tras la cura', 'por su arrepentimiento'.`,
        de: "Optionale kurze Begründung aus dem Gesprächskontext, warum dieses Merkmal entfernt wird. Spanische Beispiele: 'tras la cura', 'por su arrepentimiento'.",
        ja: "この特性が削除される理由を説明する、会話の文脈からのオプションの短い理由。スペイン語の例：「tras la cura」、「por su arrepentimiento」。",
        ko: "이 특성이 제거되는 이유를 설명하는 대화 컨텍스트의 선택적 짧은 이유. 스페인어 예: 'tras la cura', 'por su arrepentimiento'.",
        pl: "Opcjonalny krótki powód z kontekstu rozmowy opisujący, dlaczego ta cecha jest usuwana. Hiszpańskie przykłady: 'tras la cura', 'por su arrepentimiento'.",
        pt: "Razão curta opcional do contexto da conversa descrevendo por que este traço está sendo removido. Exemplos em espanhol: 'tras la cura', 'por su arrepentimiento'.",
        tr: "İsteğe bağlı kısa sebep, konuşma bağlamında bu özelliğin neden kaldırıldığını açıklar. İspanyolca örnekler: 'tras la cura', 'por su arrepentimiento'."
      }
    }
  ],
  description: {
    en: "Removes a trait from a character. The source (character1) provides context, while the target (character2) loses the trait.",
    zh: "从一个角色身上移除一个特质。源（character1）提供背景，而目标（character2）失去该特质。",
    ru: "Удаляет черту у персонажа. Источник (персонаж 1) предоставляет контекст, а цель (персонаж 2) теряет черту.",
    fr: "Retire un trait d'un personnage. La source (personnage 1) fournit le contexte, tandis que la cible (personnage 2) perd le trait.",
    es: "Quita un rasgo de un personaje. El origen (character1) proporciona el contexto, mientras que el objetivo (character2) pierde el rasgo.",
    de: "Entfernt ein Merkmal von einem Charakter. Die Quelle (Charakter 1) liefert den Kontext, während das Ziel (Charakter 2) das Merkmal verliert.",
    ja: "キャラクターから特性を削除します。ソース（キャラクター1）がコンテキストを提供し、ターゲット（キャラクター2）が特性を失います。",
    ko: "캐릭터에게서 특성을 제거합니다. 소스(캐릭터 1)는 컨텍스트를 제공하고 대상(캐릭터 2)은 특성을 잃습니다.",
    pl: "Usuwa cechę postaci. Źródło (postać 1) dostarcza kontekstu, a cel (postać 2) traci cechę.",
    pt: "Remove um traço de um personagem. A fonte (personagem 1) fornece o contexto, enquanto o alvo (personagem 2) perde o traço.",
    tr: "Bir karakterden bir özelliği kaldırır. Kaynak (character1) bağlam sağlar, hedef (character2) ise özelliği kaybeder."
  },

  /**
   * @param {GameData} gameData
   * @param {number} sourceId
   * @param {number} targetId
   */
  check: (gameData, sourceId, targetId) => {
    return true;
  },

  /**
   * @param {GameData} gameData
   * @param {string[]} args
   * @param {number} sourceId
   * @param {number} targetId
   * @returns {{success: boolean, message?: string}}
   */
  preCheck: (gameData, args, sourceId, targetId) => {
    const target = gameData.getCharacterById(targetId);
    if (!target) {
      return { success: false, message: "Target character not found." };
    }

    const rawTrait = args[0] ? String(args[0]) : "";
    if (!rawTrait.trim()) {
        return { success: false, message: "Please specify a trait key (e.g. 'brave')." };
    }

    const traitKey = normalizeTraitKey(rawTrait);
    const isValidTraitKey = /^[a-z0-9_]{2,64}$/.test(traitKey);

    if (!isValidTraitKey) {
      return {
        success: false,
        message: `Invalid trait key "${rawTrait}". Could not normalize to a valid key.`
      };
    }
    
    args[0] = traitKey; // Update with normalized key
    return { success: true };
  },

  /**
   * @param {GameData} gameData
   * @param {Function} runGameEffect
   * @param {string[]} args
   * @param {number} sourceId
   * @param {number} targetId
   */
  run: (gameData, runGameEffect, args, sourceId, targetId) => {
    const target = gameData.getCharacterById(targetId);
    if (!target) {
      return;
    }

    const traitKey = args[0];
    if (!traitKey) return;

    runGameEffect(`
        global_var:votcce_action_target = {
            remove_trait = ${traitKey}
        }`);

    try {
      if (target.hasTrait(traitKey)) {
        target.removeTrait(traitKey);
      }
    } catch (e) {
      console.error(`Error removing trait '${traitKey}' from character ${targetId} in local game data: ${e}`);
    }
  },

  chatMessage: (args) => {
    const traitKey = args[0];
    return {
      en: `{{character2Name}} lost trait ${traitKey}.`,
      zh: `{{character2Name}}失去了特质${traitKey}。`,
      ru: `{{character2Name}} потерял(а) черту ${traitKey}.`,
      fr: `{{character2Name}} a perdu le trait ${traitKey}.`,
      es: `{{character2Name}} perdió el rasgo ${traitKey}.`,
      de: `{{character2Name}} hat das Merkmal ${traitKey} verloren.`,
      ja: `{{character2Name}}は特性${traitKey}を失いました。`,
      ko: `{{character2Name}}님이 ${traitKey} 특성을 잃었습니다.`,
      pl: `{{character2Name}} stracił(a) cechę ${traitKey}.`,
      pt: `{{character2Name}} perdeu o traço ${traitKey}.`,
      tr: `{{character2Name}}, ${traitKey} özelliğini kaybetti.`
    };
  },

  chatMessageClass: "neutral-action-message",
  canPerformAtDistance: true
};