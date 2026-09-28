/** @import { GameData, Character } from '../../gamedata_typedefs.js' */

const SPOUSE_STRINGS = [
  "Spouse", "Consort", "Wife", "Husband", "Conjoint", "Ehepartner",
  "Esposo", "Esposa", "配偶", "配偶者", "배우자", "Супруг", "Супруга"
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

function isMarriedTo(sourceCharacter, targetCharacter) {
  if (!sourceCharacter || !targetCharacter) return false;
  if (sourceCharacter.consort && (sourceCharacter.consort === targetCharacter.shortName || sourceCharacter.consort === targetCharacter.fullName)) return true;
  return hasRelation(sourceCharacter, targetCharacter.id, SPOUSE_STRINGS);
}

module.exports = {
  signature: "divorce",
  args: [
    {
      name: "reason",
      type: "string",
      desc: {
        en: "Reason/event that caused this divorce (past tense). Spanish examples: \"por infidelidad\", \"tras una disputa\".",
        zh: "导致此次离婚的原因/事件（过去时）。西班牙语示例：\"por infidelidad\", \"tras una disputa\"。",
        ru: "Причина/событие, вызвавшее этот развод (в прошедшем времени). Испанские примеры: \"por infidelidad\", \"tras una disputa\".",
        fr: "Raison/événement qui a causé ce divorce (au passé). Exemples en espagnol : \"por infidelidad\", \"tras una disputa\".",
        es: "Razón/evento que causó este divorcio (en tiempo pasado). Ejemplos en español: \"por infidelidad\", \"tras una disputa\".",
        de: "Grund/Ereignis, das diese Scheidung verursacht hat (Vergangenheitsform). Spanische Beispiele: \"por infidelidad\", \"tras una disputa\".",
        ja: "この離婚を引き起こした理由/出来事（過去形）。スペイン語の例：「por infidelidad」、「tras una disputa」。",
        ko: "이 이혼을 야기한 이유/사건(과거 시제). 스페인어 예: \"por infidelidad\", \"tras una disputa\".",
        pl: "Powód/wydarzenie, które spowodowało ten rozwód (w czasie przeszłym). Hiszpańskie przykłady: \"por infidelidad\", \"tras una disputa\".",
        pt: "Razão/evento que causou este divórcio (tempo passado). Exemplos em espanhol: \"por infidelidad\", \"tras una disputa\".",
        tr: "Bu boşanmaya neden olan sebep/olay (geçmiş zamanda). İspanyolca örnekler: \"por infidelidad\", \"tras una disputa\"."
      }
    }
  ],
  description: {
    en: "Execute when one character divorces another. The source (character1) divorces the target (character2). Both must be married to each other.",
    zh: "当一个角色与另一个角色离婚时执行。源（character1）与目标（character2）离婚。双方必须是夫妻。",
    ru: "Выполняется, когда один персонаж разводится с другим. Источник (персонаж 1) разводится с целью (персонаж 2). Они должны быть в браке друг с другом.",
    fr: "Exécuter lorsqu'un personnage divorce d'un autre. La source (personnage 1) divorce de la cible (personnage 2). Ils doivent être mariés l'un à l'autre.",
    es: "Ejecutar cuando un personaje se divorcia de otro. El origen (character1) se divorcia del objetivo (character2). Ambos deben estar casados entre sí.",
    de: "Wird ausgeführt, wenn ein Charakter sich von einem anderen scheiden lässt. Die Quelle (Charakter 1) lässt sich vom Ziel (Charakter 2) scheiden. Beide müssen miteinander verheiratet sein.",
    ja: "あるキャラクターが別のキャラクターと離婚したときに実行します。ソース（キャラクター1）がターゲット（キャラクター2）と離婚します。両者は互いに結婚している必要があります。",
    ko: "한 캐릭터가 다른 캐릭터와 이혼할 때 실행합니다. 소스(캐릭터 1)가 대상(캐릭터 2)과 이혼합니다. 양쪽 모두 서로 결혼한 상태여야 합니다.",
    pl: "Wykonywane, gdy jedna postać rozwodzi się z drugą. Źródło (postać 1) rozwodzi się z celem (postać 2). Muszą być małżeństwem.",
    pt: "Executar quando um personagem se divorcia de outro. A fonte (personagem 1) se divorcia do alvo (personagem 2). Ambos devem ser casados entre si.",
    tr: "Bir karakter başka bir karakterle boşandığında çalıştırılır. Kaynak (karakter 1), hedeften (karakter 2) boşanır. İkisi birbirleriyle evli olmalıdır."
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
      return { success: false, message: "A character cannot divorce themselves." };
    }

    if (!isMarriedTo(sourceCharacter, targetCharacter)) {
      return {
        success: false,
        message: `${sourceCharacter.shortName} is not married to ${targetCharacter.shortName}.`
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

    // divorce runs in the scope of the divorcing character, with their
    // spouse as the target (verified: 00_holy_order_effects.txt:13).
    runGameEffect(`
        global_var:votcce_action_source = {
            divorce = global_var:votcce_action_target
        }`);

    removeRelationFromBoth(sourceCharacter, targetCharacter, sourceId, targetId, SPOUSE_STRINGS);
    if (sourceCharacter.consort && (sourceCharacter.consort === targetCharacter.shortName || sourceCharacter.consort === targetCharacter.fullName)) {
      sourceCharacter.consort = "";
    }
    if (targetCharacter.consort && (targetCharacter.consort === sourceCharacter.shortName || targetCharacter.consort === sourceCharacter.fullName)) {
      targetCharacter.consort = "";
    }
  },

  chatMessage: (args) => {
    return {
      en: `{{character1Name}} divorced {{character2Name}}.`,
      zh: `{{character1Name}}与{{character2Name}}离婚了。`,
      ru: `{{character1Name}} развелся(лась) с {{character2Name}}.`,
      fr: `{{character1Name}} a divorcé de {{character2Name}}.`,
      es: `{{character1Name}} se divorció de {{character2Name}}.`,
      de: `{{character1Name}} hat sich von {{character2Name}} scheiden lassen.`,
      ja: `{{character1Name}}は{{character2Name}}と離婚しました。`,
      ko: `{{character1Name}}이(가) {{character2Name}}와(과) 이혼했습니다.`,
      pl: `{{character1Name}} rozwodzi się z {{character2Name}}.`,
      pt: `{{character1Name}} se divorciou de {{character2Name}}.`,
      tr: `{{character1Name}}, {{character2Name}} ile boşandı.`
    };
  },

chatMessageClass: "negative-action-message",
}