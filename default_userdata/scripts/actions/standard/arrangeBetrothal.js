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
  signature: "arrangeBetrothal",
  args: [
    {
      name: "reason",
      type: "string",
      desc: {
        en: "Reason/event that caused this betrothal (past tense). Spanish examples: \"por alianza dinastica\", \"tras acuerdo entre casas\".",
        zh: "导致此次订婚的原因/事件（过去时）。西班牙语示例：\"por alianza dinastica\", \"tras acuerdo entre casas\"。",
        ru: "Причина/событие, вызвавшее эту помолвку (в прошедшем времени). Испанские примеры: \"por alianza dinastica\", \"tras acuerdo entre casas\".",
        fr: "Raison/événement qui a causé ces fiançailles (au passé). Exemples en espagnol : \"por alianza dinastica\", \"tras acuerdo entre casas\".",
        es: "Razón/evento que causó este compromiso (en tiempo pasado). Ejemplos en español: \"por alianza dinástica\", \"tras acuerdo entre casas\".",
        de: "Grund/Ereignis, das diese Verlobung verursacht hat (Vergangenheitsform). Spanische Beispiele: \"por alianza dinastica\", \"tras acuerdo entre casas\".",
        ja: "この婚約を引き起こした理由/出来事（過去形）。スペイン語の例：「por alianza dinastica」、「tras acuerdo entre casas」。",
        ko: "이 약혼을 야기한 이유/사건(과거 시제). 스페인어 예: \"por alianza dinastica\", \"tras acuerdo entre casas\".",
        pl: "Powód/wydarzenie, które spowodowało te zaręczyny (w czasie przeszłym). Hiszpańskie przykłady: \"por alianza dinastica\", \"tras acuerdo entre casas\".",
        pt: "Razão/evento que causou este noivado (tempo passado). Exemplos em espanhol: \"por alianza dinastica\", \"tras acuerdo entre casas\".",
        tr: "Bu nişanlanmaya neden olan sebep/olay (geçmiş zamanda). İspanyolca örnekler: \"por alianza dinastica\", \"tras acuerdo entre casas\"."
      }
    }
  ],
  description: {
    en: "Execute when one character arranges a betrothal between two characters. The source (character1) and target (character2) are the two parties being betrothed.",
    zh: "当一个角色为两个角色安排婚约时执行。源（character1）和目标（character2）是被订婚的双方。",
    ru: "Выполняется, когда один персонаж устраивает помолвку между двумя персонажами. Источник (персонаж 1) и цель (персонаж 2) - две стороны помолвки.",
    fr: "Exécuter lorsqu'un personnage organise des fiançailles entre deux personnages. La source (personnage 1) et la cible (personnage 2) sont les deux parties fiancées.",
    es: "Ejecutar cuando un personaje organiza un compromiso entre dos personajes. El origen (character1) y el objetivo (character2) son las dos partes que se comprometen.",
    de: "Wird ausgeführt, wenn ein Charakter eine Verlobung zwischen zwei Charakteren arrangiert. Die Quelle (Charakter 1) und das Ziel (Charakter 2) sind die beiden verlobten Parteien.",
    ja: "あるキャラクターが2人のキャラクターの間に婚約を取り決めたときに実行します。ソース（キャラクター1）とターゲット（キャラクター2）が婚約する2人の当事者です。",
    ko: "한 캐릭터가 두 캐릭터 사이에 약혼을 주선할 때 실행합니다. 소스(캐릭터 1)와 대상(캐릭터 2)은 약혼하는 두 당사자입니다.",
    pl: "Wykonywane, gdy jedna postać aranżuje zaręczyny między dwiema postaciami. Źródło (postać 1) i cel (postać 2) to dwie strony zaręczyn.",
    pt: "Executar quando um personagem organiza um noivado entre dois personagens. A fonte (personagem 1) e o alvo (personagem 2) são as duas partes que ficam noivas.",
    tr: "Bir karakter iki karakter arasında nişan düzenlediğinde çalıştırılır. Kaynak (karakter 1) ve hedef (karakter 2) nişanlanan iki taraftır."
  },
  canPerformAtDistance: true,
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

    if (sourceId === targetId) {
      return { success: false, message: "A character cannot be betrothed to themselves." };
    }

    if (isAlreadyMarriedTo(sourceCharacter, targetCharacter)) {
      return {
        success: false,
        message: `${sourceCharacter.shortName} is already married to ${targetCharacter.shortName}.`
      };
    }

    if (hasRelation(sourceCharacter, targetCharacter.id, BETROTHED_STRINGS)) {
      return {
        success: false,
        message: `${sourceCharacter.shortName} is already betrothed to ${targetCharacter.shortName}.`
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

    runGameEffect(`
        global_var:votcce_action_source = {
            create_betrothal = global_var:votcce_action_target
        }`);

    addRelationToBoth(sourceCharacter, targetCharacter, sourceId, targetId, "Betrothed");
  },

  chatMessage: (args) => {
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
      pt: `{{character1Name}} e {{character2Name}} ficaram noivos.`,
      tr: `{{character1Name}} ve {{character2Name}} nişanlandı.`
    };
  },

chatMessageClass: "positive-action-message",
}