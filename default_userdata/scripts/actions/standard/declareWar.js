//Made by: unknown,adjusted by patrick

/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
function sanitizeScriptKey(input) {
  return String(input || "").replace(/[^a-zA-Z0-9_]/g, "");
}

function inferTargetTitleKey(targetCharacter) {
    if (!targetCharacter || !targetCharacter.primaryTitle) return "";
    const rank = String(targetCharacter.titleRankConcept || "").toLowerCase();
    const prefix = rank.includes("emp") ? "e_" : rank.includes("king") ? "k_" : (rank.includes("duke") || rank.includes("duc")) ? "d_" : "c_";
    const base = String(targetCharacter.primaryTitle)
        .trim()
        .toLowerCase()
        .replace(/^(the|fief of|county of|duchy of|kingdom of|empire of)\s+/i, "")
        .replace(/[^a-zA-Z0-9\s_]/g, " ")
        .replace(/\s+/g, "_")
        .replace(/^_+|_+$/g, "");
    return `${prefix}${base}`;
}

const CASUS_BELLI_OPTIONS = [
  "claim_cb", "de_jure_cb", "conquest_cb", "holy_war_cb",
  "subjugation_cb", "independence_war", "liberty_war", "custom"
];

module.exports = {
  signature: "declareWar",
  isDestructive: true,
  args: [
    {
      name: "casusBelli",
      type: "enum",
      options: CASUS_BELLI_OPTIONS,
      desc: {
        en: `Casus belli for war. Defaults to 'claim_cb'. Spanish intent: "declarar la guerra", "casus belli".`,
        zh: `战争的宣战理由。默认为'claim_cb'。西班牙语意图："declarar la guerra", "casus belli"。`,
        ru: `Повод для войны. По умолчанию 'claim_cb'. Испанское намерение: "declarar la guerra", "casus belli".`,
        fr: `Casus belli pour la guerre. Par défaut 'claim_cb'. Intention espagnole : "declarar la guerra", "casus belli".`,
        es: `Casus belli para la guerra. Por defecto es 'claim_cb'. Intención en español: "declarar la guerra", "casus belli".`,
        de: `Kriegsgrund für den Krieg. Standardmäßig 'claim_cb'. Spanische Absicht: "declarar la guerra", "casus belli".`,
        ja: `戦争の大義名分。デフォルトは'claim_cb'です。スペイン語の意図：「declarar la guerra」、「casus belli」。`,
        ko: `전쟁 명분. 기본값은 'claim_cb'입니다. 스페인어 의도: "declarar la guerra", "casus belli".`,
        pl: `Casus belli dla wojny. Domyślnie 'claim_cb'. Hiszpański zamiar: "declarar la guerra", "casus belli".`,
        pt: `Casus belli para a guerra. O padrão é 'claim_cb'. Intenção em espanhol: "declarar la guerra", "casus belli".`
      }
    },
    {
      name: "targetTitle",
      type: "string",
      desc: {
        en: "Optional CK3 title key for the war goal (e.g., c_kings_landing). If omitted, a valid title is auto-picked for claim wars. Spanish intent: 'titulo objetivo', 'por el condado'.",
        zh: "战争目标的可选CK3头衔密钥（例如，c_kings_landing）。如果省略，将为宣称战争自动选择一个有效的头衔。西班牙语意图：'titulo objetivo', 'por el condado'。",
        ru: "Необязательный ключ титула CK3 для цели войны (например, c_kings_landing). Если опущен, для войн за притязания будет автоматически выбран действительный титул. Испанское намерение: 'titulo objetivo', 'por el condado'.",
        fr: "Clé de titre CK3 facultative pour l'objectif de guerre (par exemple, c_kings_landing). Si omis, un titre valide est automatiquement choisi pour les guerres de revendication. Intention espagnole : 'titulo objetivo', 'por el condado'.",
        es: "Clave de título opcional de CK3 para el objetivo de la guerra (ej., c_kings_landing). Si se omite, se auto-seleccionará un título válido para guerras de reclamación. Intención en español: 'título objetivo', 'por el condado'.",
        de: "Optionaler CK3-Titel-Schlüssel für das Kriegsziel (z. B. c_kings_landing). Wenn weggelassen, wird für Anspruchskriege automatisch ein gültiger Titel ausgewählt. Spanische Absicht: 'titulo objetivo', 'por el condado'.",
        ja: `戦争目標のオプションのCK3称号キー（例：c_kings_landing）。省略した場合、請求戦争のために有効な称号が自動的に選択されます。スペイン語の意図：「titulo objetivo」、「por el condado」。`,
        ko: `전쟁 목표에 대한 선택적 CK3 타이틀 키(예: c_kings_landing). 생략하면 청구 전쟁에 유효한 타이틀이 자동으로 선택됩니다. 스페인어 의도: 'titulo objetivo', 'por el condado'.`,
        pl: "Opcjonalny klucz tytułu CK3 dla celu wojny (np. c_kings_landing). Jeśli pominięty, dla wojen o roszczenia zostanie automatycznie wybrany prawidłowy tytuł. Hiszpański zamiar: 'titulo objetivo', 'por el condado'.",
        pt: "Chave de título opcional do CK3 para o objetivo da guerra (por exemplo, c_kings_landing). Se omitido, um título válido é escolhido automaticamente para guerras de reivindicação. Intenção em espanhol: 'titulo objetivo', 'por el condado'."
      }
    },
    {
        name: "casusBelliCustom",
        type: "string",
        desc: {
          en: "Optional custom CB key. Used only when casusBelli is set to 'custom'. Spanish examples: 'mi_cb_personalizado'.",
          zh: "可选的自定义CB密钥。仅当casusBelli设置为'custom'时使用。西班牙语示例：'mi_cb_personalizado'。",
          ru: "Необязательный пользовательский ключ CB. Используется только когда casusBelli установлен на 'custom'. Испанские примеры: 'mi_cb_personalizado'.",
          fr: "Clé CB personnalisée facultative. Utilisée uniquement lorsque casusBelli est défini sur 'custom'. Exemples en espagnol : 'mi_cb_personalizado'.",
          es: "Clave de CB personalizada opcional. Se usa solo cuando casusBelli es 'custom'. Ejemplos en español: 'mi_cb_personalizado'.",
          de: "Optionaler benutzerdefinierter CB-Schlüssel. Wird nur verwendet, wenn casusBelli auf 'custom' gesetzt ist. Spanische Beispiele: 'mi_cb_personalizado'.",
          ja: "オプションのカスタムCBキー。casusBelliが「custom」に設定されている場合にのみ使用されます。スペイン語の例：「mi_cb_personalizado」。",
          ko: "선택적 사용자 정의 CB 키. casusBelli가 'custom'으로 설정된 경우에만 사용됩니다. 스페인어 예: 'mi_cb_personalizado'.",
          pl: "Opcjonalny niestandardowy klucz CB. Używany tylko, gdy casusBelli jest ustawione na 'custom'. Hiszpańskie przykłady: 'mi_cb_personalizado'.",
          pt: "Chave de CB personalizada opcional. Usado apenas quando casusBelli é definido como 'custom'. Exemplos em espanhol: 'mi_cb_personalizado'."
        }
    }
  ],
  description: {
    en: "One ruler (character1) declares war on another (character2). This is for major military escalations. The source is the attacker, the target is the defender.",
    zh: "一位统治者（character1）向另一位统治者（character2）宣战。这适用于重大的军事升级。源是攻击方，目标是防御方。",
    ru: "Один правитель (персонаж 1) объявляет войну другому (персонаж 2). Это для крупных военных эскалаций. Источник - атакующий, цель - защищающийся.",
    fr: "Un dirigeant (personnage 1) déclare la guerre à un autre (personnage 2). Ceci est pour les escalades militaires majeures. La source est l'attaquant, la cible est le défenseur.",
    es: "Un gobernante (character1) declara la guerra a otro (character2). Esto es para escaladas militares importantes. El origen es el atacante, el objetivo es el defensor.",
    de: "Ein Herrscher (Charakter 1) erklärt einem anderen (Charakter 2) den Krieg. Dies ist für größere militärische Eskalationen. Die Quelle ist der Angreifer, das Ziel ist der Verteidiger.",
    ja: "ある支配者（キャラクター1）が別の支配者（キャラクター2）に宣戦布告します。これは大規模な軍事的エスカレーションのためのものです。ソースは攻撃側、ターゲットは防御側です。",
    ko: "한 통치자(캐릭터 1)가 다른 통치자(캐릭터 2)에게 전쟁을 선포합니다. 이것은 주요 군사적 확대를 위한 것입니다. 소스는 공격자이고 대상은 방어자입니다.",
    pl: "Jeden władca (postać 1) wypowiada wojnę drugiemu (postać 2). Dotyczy to poważnych eskalacji militarnych. Źródłem jest atakujący, celem jest obrońca.",
    pt: "Um governante (personagem 1) declara guerra a outro (personagem 2). Isso é para grandes escaladas militares. A fonte é o atacante, o alvo é o defensor."
  },

  /**
   * @param {GameData} gameData
   * @param {number} sourceId
   * @param {number} targetId
   */
  check: (gameData, sourceId, targetId) => {
    const source = gameData.getCharacterById(sourceId);
    const target = gameData.getCharacterById(targetId);
    return !!source && !!target && source.isRuler && target.isRuler && sourceId !== targetId;
  },

  /**
   * @param {GameData} gameData
   * @param {string[]} args
   * @param {number} sourceId
   * @param {number} targetId
   * @returns {{success: boolean, message?: string}}
   */
  preCheck: (gameData, args, sourceId, targetId) => {
    const source = gameData.getCharacterById(sourceId);
    const target = gameData.getCharacterById(targetId);

    if (!source || !target) {
      return { success: false, message: "Source or target character not found." };
    }
    if (sourceId === targetId) {
      return { success: false, message: "A character cannot declare war on themselves." };
    }
    if (!source.isRuler || !target.isRuler) {
      return { success: false, message: "Both characters must be rulers to declare war." };
    }
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
    const sourceCharacter = gameData.getCharacterById(sourceId);
    const targetCharacter = gameData.getCharacterById(targetId);
    if (!sourceCharacter || !targetCharacter) return;

    const selectedCb = args[0] ? String(args[0]).trim() : "claim_cb";
    const rawTargetTitle = args[1] ? String(args[1]).trim() : "";
    const customCbRaw = args[2] ? String(args[2]).trim() : "";

    const rawCb = selectedCb === "custom" ? customCbRaw : selectedCb;
    const casusBelli = sanitizeScriptKey(rawCb) || "claim_cb";

    const manualTargetTitle = sanitizeScriptKey(rawTargetTitle);
    const inferredTargetTitle = inferTargetTitleKey(targetCharacter);
    const isClaimLikeCb = casusBelli.includes("claim");
    
    // Some CBs (like independence or liberty) do not take a target_title at all and will invalidate if one is provided.
    const noTargetCbList = ["independence_war", "independence_faction_war", "liberty_war", "liberty_faction_war"];
    const isNoTargetCb = noTargetCbList.includes(casusBelli);

    const autoPickClaimTarget = isClaimLikeCb && !manualTargetTitle;
    const targetTitle = autoPickClaimTarget ? "" : (manualTargetTitle || inferredTargetTitle);
    const hasTargetTitle = !!targetTitle && !isNoTargetCb;

    const titleLine = hasTargetTitle ? `\n        target_title = title:${targetTitle}` : "";
    const claimantLine = isClaimLikeCb ? "\n        claimant = global_var:votcce_action_source" : "";

    runGameEffect(`
      global_var:votcce_action_source = {
        start_war = {
          cb = ${casusBelli}
          target = global_var:votcce_action_target${titleLine}${claimantLine}
        }
      }`);
  },

  chatMessage: (args) => {
    const cb = args[0] || "claim";
    return {
      en: `{{character1Name}} declared war on {{character2Name}} (Casus Belli: ${cb}).`,
      zh: `{{character1Name}}向{{character2Name}}宣战（宣战理由：${cb}）。`,
      ru: `{{character1Name}} объявил(а) войну {{character2Name}} (Повод для войны: ${cb}).`,
      fr: `{{character1Name}} a déclaré la guerre à {{character2Name}} (Casus Belli: ${cb}).`,
      es: `{{character1Name}} declaró la guerra a {{character2Name}} (Casus Belli: ${cb}).`,
      de: `{{character1Name}} hat {{character2Name}} den Krieg erklärt (Kriegsgrund: ${cb}).`,
      ja: `{{character1Name}}は{{character2Name}}に宣戦布告しました（開戦事由：${cb}）。`,
      ko: `{{character1Name}}이(가) {{character2Name}}에게 전쟁을 선포했습니다 (전쟁 명분: ${cb}).`,
      pl: `{{character1Name}} wypowiedział(a) wojnę {{character2Name}} (Casus Belli: ${cb}).`,
      pt: `{{character1Name}} declarou guerra a {{character2Name}} (Casus Belli: ${cb}).`
    };
  },

  chatMessageClass: "negative-action-message"
};
