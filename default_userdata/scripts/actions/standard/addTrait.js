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
  signature: "addTrait",
  args: [
    {
      name: "trait",
      type: "enum",
      options: BASE_GAME_TRAIT_KEYS,
      desc: {
        en: "Trait key to add to the target character (e.g. 'brave', 'lustful', 'ambitious'). Spanish intent: 'ganar rasgo', 'adquirir rasgo', 'se vuelve'.",
        zh: "要添加到目标角色的特质关键字（例如'brave'，'lustful'，'ambitious'）。西班牙语意图：'ganar rasgo'，'adquirir rasgo'，'se vuelve'。",
        ru: "Ключ черты для добавления целевому персонажу (например, 'brave', 'lustful', 'ambitious'). Испанское намерение: 'ganar rasgo', 'adquirir rasgo', 'se vuelve'.",
        fr: "Clé de trait à ajouter au personnage cible (par exemple, 'brave', 'lustful', 'ambitious'). Intention espagnole : 'ganar rasgo', 'adquirir rasgo', 'se vuelve'.",
        es: "Clave de rasgo para agregar al personaje objetivo (p. ej., 'valiente', 'lujurioso', 'ambicioso'). Intención en español: 'ganar rasgo', 'adquirir rasgo', 'se vuelve'.",
        de: "Merkmalsschlüssel, der dem Zielcharakter hinzugefügt werden soll (z. B. 'brave', 'lustful', 'ambitious'). Spanische Absicht: 'ganar rasgo', 'adquirir rasgo', 'se vuelve'.",
        ja: "ターゲットキャラクターに追加する特性キー（例：'brave'、'lustful'、'ambitious'）。スペイン語の意図：「ganar rasgo」、「adquirir rasgo」、「se vuelve」。",
        ko: "대상 캐릭터에 추가할 특성 키(예: 'brave', 'lustful', 'ambitious'). 스페인어 의도: 'ganar rasgo', 'adquirir rasgo', 'se vuelve'.",
        pl: "Klucz cechy do dodania postaci docelowej (np. 'brave', 'lustful', 'ambitious'). Hiszpański zamiar: 'ganar rasgo', 'adquirir rasgo', 'se vuelve'.",
        pt: "Chave de traço para adicionar ao personagem alvo (por exemplo, 'brave', 'lustful', 'ambitious'). Intenção em espanhol: 'ganar rasgo', 'adquirir rasgo', 'se vuelve'."
      }
    },
    {
      name: "reason",
      type: "string",
      desc: {
        en: `Optional short reason from conversation context describing why this trait is being added. Spanish examples: 'tras la batalla', 'por su conducta'.`,
        zh: "可选的简短原因，描述为何添加此特质。西班牙语示例：'tras la batalla'，'por su conducta'。",
        ru: "Необязательная краткая причина из контекста разговора, описывающая, почему добавляется эта черта. Примеры на испанском: 'tras la batalla', 'por su conducta'.",
        fr: "Raison courte facultative du contexte de la conversation décrivant pourquoi ce trait est ajouté. Exemples en espagnol : 'tras la batalla', 'por su conducta'.",
        es: `Razón corta opcional del contexto de la conversación que describe por qué se agrega este rasgo. Ejemplos en español: 'tras la batalla', 'por su conducta'.`,
        de: "Optionale kurze Begründung aus dem Gesprächskontext, warum dieses Merkmal hinzugefügt wird. Spanische Beispiele: 'tras la batalla', 'por su conducta'.",
        ja: "この特性が追加される理由を説明する、会話の文脈からのオプションの短い理由。スペイン語の例：「tras la batalla」、「por su conducta」。",
        ko: "이 특성이 추가되는 이유를 설명하는 대화 컨텍스트의 선택적 짧은 이유. 스페인어 예: 'tras la batalla', 'por su conducta'.",
        pl: "Opcjonalny krótki powód z kontekstu rozmowy opisujący, dlaczego ta cecha jest dodawana. Hiszpańskie przykłady: 'tras la batalla', 'por su conducta'.",
        pt: "Razão curta opcional do contexto da conversa descrevendo por que este traço está sendo adicionado. Exemplos em espanhol: 'tras la batalla', 'por su conducta'."
      }
    }
  ],
  description: {
    en: "Adds a trait to a character. The source (character1) provides context, while the target (character2) receives the trait.",
    zh: "为一个角色添加一个特质。源（character1）提供背景，而目标（character2）接收该特质。",
    ru: "Добавляет черту персонажу. Источник (персонаж 1) предоставляет контекст, а цель (персонаж 2) получает черту.",
    fr: "Ajoute un trait à un personnage. La source (personnage 1) fournit le contexte, tandis que la cible (personnage 2) reçoit le trait.",
    es: "Añade un rasgo a un personaje. El origen (character1) proporciona el contexto, mientras que el objetivo (character2) recibe el rasgo.",
    de: "Fügt einem Charakter ein Merkmal hinzu. Die Quelle (Charakter 1) liefert den Kontext, während das Ziel (Charakter 2) das Merkmal erhält.",
    ja: "キャラクターに特性を追加します。ソース（キャラクター1）がコンテキストを提供し、ターゲット（キャラクター2）が特性を受け取ります。",
    ko: "캐릭터에 특성을 추가합니다. 소스(캐릭터 1)는 컨텍스트를 제공하고 대상(캐릭터 2)은 특성을 받습니다.",
    pl: "Dodaje cechę postaci. Źródło (postać 1) dostarcza kontekstu, a cel (postać 2) otrzymuje cechę.",
    pt: "Adiciona um traço a um personagem. A fonte (personagem 1) fornece o contexto, enquanto o alvo (personagem 2) recebe o traço."
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
            add_trait = ${traitKey}
        }`);

    try {
      if (!target.hasTrait(traitKey)) {
        target.addTrait({
          category: "personality",
          name: traitKey,
          desc: `${target.shortName} gained trait ${traitKey}`
        });
      }
    } catch (e) {
        console.error(`Error adding trait '${traitKey}' to character ${targetId} in local game data: ${e}`);
    }
  },

  chatMessage: (args) => {
    const traitKey = args[0];
    return {
      en: `{{character2Name}} gained trait ${traitKey}.`,
      zh: `{{character2Name}}获得了特质${traitKey}。`,
      ru: `{{character2Name}} получил(а) черту ${traitKey}.`,
      fr: `{{character2Name}} a obtenu le trait ${traitKey}.`,
      es: `{{character2Name}} obtuvo el rasgo ${traitKey}.`,
      de: `{{character2Name}} hat das Merkmal ${traitKey} erhalten.`,
      ja: `{{character2Name}}は特性${traitKey}を獲得しました。`,
      ko: `{{character2Name}}님이 ${traitKey} 특성을 획득했습니다.`,
      pl: `{{character2Name}} zyskał(a) cechę ${traitKey}.`,
      pt: `{{character2Name}} ganhou o traço ${traitKey}.`
    };
  },

  chatMessageClass: "neutral-action-message"
};
