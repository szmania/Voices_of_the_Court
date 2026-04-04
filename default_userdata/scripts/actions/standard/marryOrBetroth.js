/** @import { GameData, Character } from '../../gamedata_typedefs.js' */

const SPOUSE_STRINGS = [
  "Spouse", "Consort", "Wife", "Husband", "Conjoint", "Ehepartner",
  "Esposo", "Esposa", "配偶", "配偶者", "배우자", "Супруг", "Супруга"
];

const BETROTHED_STRINGS = [
  "Betrothed", "Fiance", "Fiancee", "Fiance(e)", "Promise", "Verlobte",
  "Verlobter", "Prometido", "Prometida", "婚约者", "약혼자", "Обручен(а)"
];

function hasRelation(character, targetId, relationStrings) {
  const entry = character.relationsToCharacters?.find((r) => r.id === targetId);
  if (!entry) return false;
  const lowerStrings = relationStrings.map((s) => s.toLowerCase());
  return entry.relations.some((rel) => lowerStrings.includes(String(rel).toLowerCase()));
}

function removeRelationFromBoth(sourceChar, targetChar, sourceId, targetId, relationStrings) {
  if (!sourceChar || !targetChar) return;
  const lowerStrings = relationStrings.map((s) => s.toLowerCase());

  if (sourceChar.relationsToCharacters) {
    const sourceEntry = sourceChar.relationsToCharacters.find((r) => r.id === targetId);
    if (sourceEntry) {
      sourceEntry.relations = sourceEntry.relations.filter((rel) => !lowerStrings.includes(String(rel).toLowerCase()));
    }
  }

  if (targetChar.relationsToCharacters) {
    const targetEntry = targetChar.relationsToCharacters.find((r) => r.id === sourceId);
    if (targetEntry) {
      targetEntry.relations = targetEntry.relations.filter((rel) => !lowerStrings.includes(String(rel).toLowerCase()));
    }
  }
}

function addRelationToBoth(sourceChar, targetChar, sourceId, targetId, relationString) {
    if (!sourceChar || !targetChar) return;

    if (!sourceChar.relationsToCharacters) sourceChar.relationsToCharacters = [];
    let sourceEntry = sourceChar.relationsToCharacters.find((r) => r.id === targetId);
    if (!sourceEntry) {
        sourceEntry = { id: targetId, relations: [] };
        sourceChar.relationsToCharacters.push(sourceEntry);
    }
    if (!sourceEntry.relations.includes(relationString)) {
        sourceEntry.relations.push(relationString);
    }

    if (!targetChar.relationsToCharacters) targetChar.relationsToCharacters = [];
    let targetEntry = targetChar.relationsToCharacters.find((r) => r.id === sourceId);
    if (!targetEntry) {
        targetEntry = { id: sourceId, relations: [] };
        targetChar.relationsToCharacters.push(targetEntry);
    }
    if (!targetEntry.relations.includes(relationString)) {
        targetEntry.relations.push(relationString);
    }
}

function isAlreadyMarriedTo(sourceCharacter, targetCharacter) {
  if (!sourceCharacter || !targetCharacter) return false;
  if (sourceCharacter.consort && (sourceCharacter.consort === targetCharacter.shortName || sourceCharacter.consort === targetCharacter.fullName)) return true;
  return hasRelation(sourceCharacter, targetCharacter.id, SPOUSE_STRINGS);
}

module.exports = {
  signature: "marryOrBetroth",
  args: [
    {
      name: "unionType",
      type: "enum",
      options: ["marriage", "marriage_matrilineal", "betrothal"],
      desc: {
        en: `Choose whether {{character1Name}} marries {{character2Name}} now, marries matrilineally, or forms a betrothal. Spanish intent: "se casa con", "matrimonio matrilineal", "se compromete con".`,
        zh: `选择{{character1Name}}是现在与{{character2Name}}结婚，还是母系结婚，或者订婚。西班牙语意图："se casa con", "matrimonio matrilineal", "se compromete con"。`,
        ru: `Выберите, {{character1Name}} женится на {{character2Name}} сейчас, по материнской линии или заключает помолвку. Испанское намерение: "se casa con", "matrimonio matrilineal", "se compromete con".`,
        fr: `Choisissez si {{character1Name}} épouse {{character2Name}} maintenant, se marie matrilinéairement, ou forme des fiançailles. Intention espagnole : "se casa con", "matrimonio matrilineal", "se compromete con".`,
        es: `Elige si {{character1Name}} se casa con {{character2Name}} ahora, de forma matrilineal, o se compromete. Intención en español: "se casa con", "matrimonio matrilineal", "se compromete con".`,
        de: `Wählen Sie, ob {{character1Name}} {{character2Name}} jetzt heiratet, matrilinear heiratet oder eine Verlobung eingeht. Spanische Absicht: "se casa con", "matrimonio matrilineal", "se compromete con".`,
        ja: `{{character1Name}}が{{character2Name}}と今すぐ結婚するか、母系結婚するか、婚約するかを選択します。スペイン語の意図：「se casa con」、「matrimonio matrilineal」、「se compromete con」。`,
        ko: `{{character1Name}}이(가) {{character2Name}}와 지금 결혼할지, 모계 결혼할지, 또는 약혼할지 선택하십시오. 스페인어 의도: "se casa con", "matrimonio matrilineal", "se compromete con".`,
        pl: `Wybierz, czy {{character1Name}} poślubi {{character2Name}} teraz, matrylinearnie, czy zawrze zaręczyny. Hiszpański zamiar: "se casa con", "matrimonio matrilineal", "se compromete con".`,
        pt: `Escolha se {{character1Name}} casa com {{character2Name}} agora, casa matrilinearmente, ou forma um noivado. Intenção em espanhol: "se casa con", "matrimonio matrilineal", "se compromete con".`
      }
    },
    {
      name: "reason",
      type: "string",
      desc: {
        en: "Reason/event that caused this marriage or betrothal (past tense). Spanish examples: \"por alianza dinastica\", \"tras acuerdo entre casas\".",
        zh: "导致此次婚姻或订婚的原因/事件（过去时）。西班牙语示例：\"por alianza dinastica\", \"tras acuerdo entre casas\"。",
        ru: "Причина/событие, вызвавшее этот брак или помолвку (в прошедшем времени). Испанские примеры: \"por alianza dinastica\", \"tras acuerdo entre casas\".",
        fr: "Raison/événement qui a causé ce mariage ou ces fiançailles (au passé). Exemples en espagnol : \"por alianza dinastica\", \"tras acuerdo entre casas\".",
        es: "Razón/evento que causó este matrimonio o compromiso (en tiempo pasado). Ejemplos en español: \"por alianza dinástica\", \"tras acuerdo entre casas\".",
        de: "Grund/Ereignis, das diese Heirat oder Verlobung verursacht hat (Vergangenheitsform). Spanische Beispiele: \"por alianza dinastica\", \"tras acuerdo entre casas\".",
        ja: "この結婚または婚約を引き起こした理由/出来事（過去形）。スペイン語の例：「por alianza dinastica」、「tras acuerdo entre casas」。",
        ko: "이 결혼이나 약혼을 야기한 이유/사건(과거 시제). 스페인어 예: \"por alianza dinastica\", \"tras acuerdo entre casas\".",
        pl: "Powód/wydarzenie, które spowodowało to małżeństwo lub zaręczyny (w czasie przeszłym). Hiszpańskie przykłady: \"por alianza dinastica\", \"tras acuerdo entre casas\".",
        pt: "Razão/evento que causou este casamento ou noivado (tempo passado). Exemplos em espanhol: \"por alianza dinastica\", \"tras acuerdo entre casas\"."
      }
    }
  ],
  description: {
    en: "Execute when one character and another get married, married matrilineally, or betrothed. The source (character1) and target (character2) are the two parties involved.",
    zh: "当一个角色与另一个角色结婚、母系结婚或订婚时执行。源（character1）和目标（character2）是涉及的双方。",
    ru: "Выполняется, когда один персонаж и другой женятся, вступают в матрилинейный брак или обручаются. Источник (персонаж 1) и цель (персонаж 2) - две вовлеченные стороны.",
    fr: "Exécuter lorsqu'un personnage et un autre se marient, se marient matrilinéairement ou se fiancent. La source (personnage 1) et la cible (personnage 2) sont les deux parties concernées.",
    es: "Ejecutar cuando un personaje y otro se casan, se casan matrilinealmente o se comprometen. El origen (character1) y el objetivo (character2) son las dos partes involucradas.",
    de: "Wird ausgeführt, wenn ein Charakter und ein anderer heiraten, matrilinear heiraten oder sich verloben. Die Quelle (Charakter 1) und das Ziel (Charakter 2) sind die beiden beteiligten Parteien.",
    ja: "あるキャラクターが別のキャラクターと結婚、母系結婚、または婚約したときに実行します。ソース（キャラクター1）とターゲット（キャラクター2）が関係する2つの当事者です。",
    ko: "한 캐릭터와 다른 캐릭터가 결혼하거나, 모계 결혼하거나, 약혼할 때 실행합니다. 소스(캐릭터 1)와 대상(캐릭터 2)은 관련된 두 당사자입니다.",
    pl: "Wykonywane, gdy jedna postać i druga biorą ślub, ślub matrylinearny lub zaręczają się. Źródło (postać 1) i cel (postać 2) to dwie zaangażowane strony.",
    pt: "Executar quando um personagem e outro se casam, casam-se matrilinearmente ou ficam noivos. A fonte (personagem 1) e o alvo (personagem 2) são as duas partes envolvidas."
  },

  /**
   * @param {GameData} gameData
   * @param {number} sourceId
   * @param {number} targetId
   */
  check: (gameData, sourceId, targetId) => {
    const source = gameData.getCharacterById(sourceId);
    const target = gameData.getCharacterById(targetId);
    return !!source && !!target && sourceId !== targetId;
  },

  /**
   * @param {GameData} gameData
   * @param {string[]} args
   * @param {number} sourceId
   * @param {number} targetId
   * @returns {{success: boolean, message?: string}}
   */
  preCheck: (gameData, args, sourceId, targetId) => {
    const sourceCharacter = gameData.getCharacterById(sourceId);
    const targetCharacter = gameData.getCharacterById(targetId);

    if (!sourceCharacter || !targetCharacter) {
      return { success: false, message: "Source or target character not found." };
    }

    const unionType = args[0] || "marriage";

    if (unionType !== "betrothal" && (sourceCharacter.age < 16 || targetCharacter.age < 16)) {
      return {
        success: false,
        message: `${sourceCharacter.shortName} and ${targetCharacter.shortName} must both be adults for marriage.`
      };
    }

    if (unionType === "betrothal" && sourceCharacter.age >= 16 && targetCharacter.age >= 16) {
      return {
        success: false,
        message: "Betrothal requires at least one underage character; use marriage for two adults."
      };
    }

    if (isAlreadyMarriedTo(sourceCharacter, targetCharacter)) {
      return {
        success: false,
        message: `${sourceCharacter.shortName} is already married to ${targetCharacter.shortName}.`
      };
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

    const unionType = args[0] === "betrothal" ? "betrothal" : args[0] === "marriage_matrilineal" ? "marriage_matrilineal" : "marriage";

    if (unionType === "marriage" || unionType === "marriage_matrilineal") {
      runGameEffect(`
        global_var:votcce_action_source = {
            ${unionType === "marriage_matrilineal" ? "marry_matrilineal" : "marry"} = global_var:votcce_action_target
        }`);

      removeRelationFromBoth(sourceCharacter, targetCharacter, sourceId, targetId, BETROTHED_STRINGS);
      addRelationToBoth(sourceCharacter, targetCharacter, sourceId, targetId, "Spouse");
      sourceCharacter.consort = targetCharacter.shortName;
      targetCharacter.consort = sourceCharacter.shortName;
    } else { // betrothal
      runGameEffect(`
        global_var:votcce_action_source = {
            create_betrothal = global_var:votcce_action_target
        }`);
      addRelationToBoth(sourceCharacter, targetCharacter, sourceId, targetId, "Betrothed");
    }
  },

  chatMessage: (args) => {
    const unionType = args[0] || "marriage";
    if (unionType === "marriage") {
      return {
        en: `{{character1Name}} and {{character2Name}} got married.`,
        zh: `{{character1Name}}和{{character2Name}}结婚了。`,
        ru: `{{character1Name}} и {{character2Name}} поженились.`,
        fr: `{{character1Name}} et {{character2Name}} se sont mariés.`,
        es: `{{character1Name}} y {{character2Name}} se casaron.`,
        de: `{{character1Name}} und {{character2Name}} haben geheiratet.`,
        ja: `{{character1Name}}と{{character2Name}}は結婚しました。`,
        ko: `{{character1Name}}와(과) {{character2Name}}이(가) 결혼했습니다.`,
        pl: `{{character1Name}} i {{character2Name}} wzięli ślub.`,
        pt: `{{character1Name}} e {{character2Name}} se casaram.`
      };
    } else if (unionType === "marriage_matrilineal") {
      return {
        en: `{{character1Name}} and {{character2Name}} got married matrilineally.`,
        zh: `{{character1Name}}和{{character2Name}}母系结婚了。`,
        ru: `{{character1Name}} и {{character2Name}} вступили в матрилинейный брак.`,
        fr: `{{character1Name}} et {{character2Name}} se sont mariés matrilinéairement.`,
        es: `{{character1Name}} y {{character2Name}} se casaron de forma matrilineal.`,
        de: `{{character1Name}} und {{character2Name}} haben matrilinear geheiratet.`,
        ja: `{{character1Name}}と{{character2Name}}は母系結婚しました。`,
        ko: `{{character1Name}}와(과) {{character2Name}}이(가) 모계 결혼했습니다.`,
        pl: `{{character1Name}} i {{character2Name}} wzięli ślub matrylinearny.`,
        pt: `{{character1Name}} e {{character2Name}} se casaram matrilinearmente.`
      };
    } else { // betrothal
      return {
        en: `{{character1Name}} and {{character2Name}} became betrothed.`,
        zh: `{{character1Name}}和{{character2Name}}订婚了。`,
        ru: `{{character1Name}} и {{character2Name}} обручились.`,
        fr: `{{character1Name}} et {{character2Name}} se sont fiancés.`,
        es: `{{character1Name}} y {{character2Name}} quedaron comprometidos.`,
        de: `{{character1Name}} und {{character2Name}} haben sich verlobt.`,
        ja: `{{character1Name}}と{{character2Name}}は婚約しました。`,
        ko: `{{character1Name}}와(과) {{character2Name}}이(가) 약혼했습니다.`,
        pl: `{{character1Name}} i {{character2Name}} zaręczyli się.`,
        pt: `{{character1Name}} e {{character2Name}} ficaram noivos.`
      };
    }
  },

  chatMessageClass: "positive-action-message"
};
