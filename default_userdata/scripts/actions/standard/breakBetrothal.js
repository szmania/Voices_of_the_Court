/** @import { GameData, Character } from '../../gamedata_typedefs.js' */

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

module.exports = {
  signature: "breakBetrothal",
  args: [
    {
      name: "reason",
      type: "string",
      desc: {
        en: "Reason/event that caused this betrothal to be broken (past tense). Spanish examples: \"por traicion\", \"tras una disputa\".",
        zh: "导致此次婚约解除的原因/事件（过去时）。西班牙语示例：\"por traicion\", \"tras una disputa\"。",
        ru: "Причина/событие, из-за которого помолвка была расторгнута (в прошедшем времени). Испанские примеры: \"por traicion\", \"tras una disputa\".",
        fr: "Raison/événement qui a causé la rupture de ces fiançailles (au passé). Exemples en espagnol : \"por traicion\", \"tras una disputa\".",
        es: "Razón/evento que causó la ruptura de este compromiso (en tiempo pasado). Ejemplos en español: \"por traición\", \"tras una disputa\".",
        de: "Grund/Ereignis, das zur Aufhebung dieser Verlobung führte (Vergangenheitsform). Spanische Beispiele: \"por traicion\", \"tras una disputa\".",
        ja: "この婚約が破棄された理由/出来事（過去形）。スペイン語の例：「por traicion」、「tras una disputa」。",
        ko: "이 약혼이 파기된 이유/사건(과거 시제). 스페인어 예: \"por traicion\", \"tras una disputa\".",
        pl: "Powód/wydarzenie, które spowodowało zerwanie tych zaręczyn (w czasie przeszłym). Hiszpańskie przykłady: \"por traicion\", \"tras una disputa\".",
        pt: "Razão/evento que causou o rompimento deste noivado (tempo passado). Exemplos em espanhol: \"por traicion\", \"tras una disputa\".",
        tr: "Bu nişanın bozulmasına neden olan sebep/olay (geçmiş zamanda). İspanyolca örnekler: \"por traicion\", \"tras una disputa\"."
      }
    }
  ],
  description: {
    en: "Execute when a betrothal between two characters is broken off. The source (character1) breaks the betrothal with the target (character2).",
    zh: "当两个角色之间的婚约被解除时执行。源（character1）解除与目标（character2）的婚约。",
    ru: "Выполняется, когда помолвка между двумя персонажами расторгается. Источник (персонаж 1) расторгает помолвку с целью (персонаж 2).",
    fr: "Exécuter lorsque des fiançailles entre deux personnages sont rompues. La source (personnage 1) rompt les fiançailles avec la cible (personnage 2).",
    es: "Ejecutar cuando un compromiso entre dos personajes se rompe. El origen (character1) rompe el compromiso con el objetivo (character2).",
    de: "Wird ausgeführt, wenn eine Verlobung zwischen zwei Charakteren aufgelöst wird. Die Quelle (Charakter 1) löst die Verlobung mit dem Ziel (Charakter 2) auf.",
    ja: "2人のキャラクター間の婚約が破棄されたときに実行します。ソース（キャラクター1）がターゲット（キャラクター2）との婚約を破棄します。",
    ko: "두 캐릭터 간의 약혼이 파기될 때 실행합니다. 소스(캐릭터 1)가 대상(캐릭터 2)과의 약혼을 파기합니다.",
    pl: "Wykonywane, gdy zaręczyny między dwiema postaciami są zrywane. Źródło (postać 1) zrywa zaręczyny z celem (postać 2).",
    pt: "Executar quando um noivado entre dois personagens é rompido. A fonte (personagem 1) rompe o noivado com o alvo (personagem 2).",
    tr: "İki karakter arasındaki bir nişan bozulduğunda çalıştırılır. Kaynak (karakter 1), hedefle (karakter 2) nişanı bozar."
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
      return { success: false, message: "A character cannot break a betrothal with themselves." };
    }

    if (!hasRelation(sourceCharacter, targetCharacter.id, BETROTHED_STRINGS)) {
      return {
        success: false,
        message: `${sourceCharacter.shortName} is not betrothed to ${targetCharacter.shortName}.`
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

    // break_betrothal runs in the scope of the character breaking it, with
    // their betrothed as the target (verified: 00_marriage_interaction_effects.txt:555).
    runGameEffect(`
        global_var:votcce_action_source = {
            break_betrothal = global_var:votcce_action_target
        }`);

    removeRelationFromBoth(sourceCharacter, targetCharacter, sourceId, targetId, BETROTHED_STRINGS);
  },

  chatMessage: (args) => {
    return {
      en: `{{character1Name}} broke off the betrothal with {{character2Name}}.`,
      zh: `{{character1Name}}解除了与{{character2Name}}的婚约。`,
      ru: `{{character1Name}} расторг(ла) помолвку с {{character2Name}}.`,
      fr: `{{character1Name}} a rompu les fiançailles avec {{character2Name}}.`,
      es: `{{character1Name}} rompió el compromiso con {{character2Name}}.`,
      de: `{{character1Name}} hat die Verlobung mit {{character2Name}} aufgelöst.`,
      ja: `{{character1Name}}は{{character2Name}}との婚約を破棄しました。`,
      ko: `{{character1Name}}이(가) {{character2Name}}와(과)의 약혼을 파기했습니다.`,
      pl: `{{character1Name}} zrywa zaręczyny z {{character2Name}}.`,
      pt: `{{character1Name}} rompeu o noivado com {{character2Name}}.`,
      tr: `{{character1Name}}, {{character2Name}} ile nişanı bozdu.`
    };
  },

chatMessageClass: "negative-action-message",
}