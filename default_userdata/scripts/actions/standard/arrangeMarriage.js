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
  signature: "arrangeMarriage",
  args: [
    {
      name: "marriageType",
      type: "enum",
      options: ["patrilineal", "matrilineal"],
      desc: {
        en: `Choose whether {{character1Name}} marries {{character2Name}} patrilineally (children of the source's house) or matrilineally (children of the target's house). Spanish intent: "matrimonio matrilineal".`,
        zh: `选择{{character1Name}}与{{character2Name}}是父系结婚（子女属于源家族）还是母系结婚（子女属于目标家族）。西班牙语意图："matrimonio matrilineal"。`,
        ru: `Выберите, {{character1Name}} женится на {{character2Name}} по отцовской линии (дети дома источника) или по материнской линии (дети дома цели). Испанское намерение: "matrimonio matrilineal".`,
        fr: `Choisissez si {{character1Name}} épouse {{character2Name}} patrilinéairement (enfants de la maison de la source) ou matrilinéairement (enfants de la maison de la cible). Intention espagnole : "matrimonio matrilineal".`,
        es: `Elige si {{character1Name}} se casa con {{character2Name}} de forma patrilineal (hijos de la casa del origen) o matrilineal (hijos de la casa del objetivo). Intención en español: "matrimonio matrilineal".`,
        de: `Wählen Sie, ob {{character1Name}} {{character2Name}} patrilinear (Kinder des Hauses der Quelle) oder matrilinear (Kinder des Hauses des Ziels) heiratet. Spanische Absicht: "matrimonio matrilineal".`,
        ja: `{{character1Name}}が{{character2Name}}と父系的に結婚するか（子供はソースの家系）、母系的に結婚するか（子供はターゲットの家系）を選択します。スペイン語の意図：「matrimonio matrilineal」。`,
        ko: `{{character1Name}}이(가) {{character2Name}}와 부계 결혼할지(자녀는 소스 가문 소속), 모계 결혼할지(자녀는 대상 가문 소속) 선택하십시오. 스페인어 의도: "matrimonio matrilineal".`,
        pl: `Wybierz, czy {{character1Name}} poślubi {{character2Name}} patrylinearnie (dzieci domu źródła) czy matrylinearnie (dzieci domu celu). Hiszpański zamiar: "matrimonio matrilineal".`,
        pt: `Escolha se {{character1Name}} casa com {{character2Name}} patrilinearmente (filhos da casa da fonte) ou matrilinearmente (filhos da casa do alvo). Intenção em espanhol: "matrimonio matrilineal".`,
        tr: `{{character1Name}}'in {{character2Name}} ile patrilinial (kaynağın evinin çocukları) mi yoksa matrilinial (hedefin evinin çocukları) mı evleneceğini seçin. İspanyolca niyet: "matrimonio matrilineal".`
      }
    },
    {
      name: "reason",
      type: "string",
      desc: {
        en: "Reason/event that caused this marriage (past tense). Spanish examples: \"por alianza dinastica\", \"tras acuerdo entre casas\".",
        zh: "导致此次结婚的原因/事件（过去时）。西班牙语示例：\"por alianza dinastica\", \"tras acuerdo entre casas\"。",
        ru: "Причина/событие, вызвавшее этот брак (в прошедшем времени). Испанские примеры: \"por alianza dinastica\", \"tras acuerdo entre casas\".",
        fr: "Raison/événement qui a causé ce mariage (au passé). Exemples en espagnol : \"por alianza dinastica\", \"tras acuerdo entre casas\".",
        es: "Razón/evento que causó este matrimonio (en tiempo pasado). Ejemplos en español: \"por alianza dinástica\", \"tras acuerdo entre casas\".",
        de: "Grund/Ereignis, das diese Heirat verursacht hat (Vergangenheitsform). Spanische Beispiele: \"por alianza dinastica\", \"tras acuerdo entre casas\".",
        ja: "この結婚を引き起こした理由/出来事（過去形）。スペイン語の例：「por alianza dinastica」、「tras acuerdo entre casas」。",
        ko: "이 결혼을 야기한 이유/사건(과거 시제). 스페인어 예: \"por alianza dinastica\", \"tras acuerdo entre casas\".",
        pl: "Powód/wydarzenie, które spowodowało to małżeństwo (w czasie przeszłym). Hiszpańskie przykłady: \"por alianza dinastica\", \"tras acuerdo entre casas\".",
        pt: "Razão/evento que causou este casamento (tempo passado). Exemplos em espanhol: \"por alianza dinastica\", \"tras acuerdo entre casas\".",
        tr: "Bu evliliğe neden olan sebep/olay (geçmiş zamanda). İspanyolca örnekler: \"por alianza dinastica\", \"tras acuerdo entre casas\"."
      }
    }
  ],
  description: {
    en: "Execute when one character arranges a marriage between two characters. The source (character1) and target (character2) are the two parties getting married.",
    zh: "当一个角色为两个角色安排结婚时执行。源（character1）和目标（character2）是结婚的双方。",
    ru: "Выполняется, когда один персонаж устраивает брак между двумя персонажами. Источник (персонаж 1) и цель (персонаж 2) - две стороны брака.",
    fr: "Exécuter lorsqu'un personnage organise un mariage entre deux personnages. La source (personnage 1) et la cible (personnage 2) sont les deux parties qui se marient.",
    es: "Ejecutar cuando un personaje organiza un matrimonio entre dos personajes. El origen (character1) y el objetivo (character2) son las dos partes que se casan.",
    de: "Wird ausgeführt, wenn ein Charakter eine Heirat zwischen zwei Charakteren arrangiert. Die Quelle (Charakter 1) und das Ziel (Charakter 2) sind die beiden Parteien, die heiraten.",
    ja: "あるキャラクターが2人のキャラクターの間に結婚を取り決めたときに実行します。ソース（キャラクター1）とターゲット（キャラクター2）が結婚する2人の当事者です。",
    ko: "한 캐릭터가 두 캐릭터 사이에 결혼을 주선할 때 실행합니다. 소스(캐릭터 1)와 대상(캐릭터 2)은 결혼하는 두 당사자입니다.",
    pl: "Wykonywane, gdy jedna postać aranżuje małżeństwo między dwiema postaciami. Źródło (postać 1) i cel (postać 2) to dwie strony, które biorą ślub.",
    pt: "Executar quando um personagem organiza um casamento entre dois personagens. A fonte (personagem 1) e o alvo (personagem 2) são as duas partes que se casam.",
    tr: "Bir karakter iki karakter arasında bir evlilik düzenlediğinde çalıştırılır. Kaynak (karakter 1) ve hedef (karakter 2) evlenen iki taraftır."
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
      return { success: false, message: "A character cannot marry themselves." };
    }

    if (sourceCharacter.age < 16 || targetCharacter.age < 16) {
      return {
        success: false,
        message: `${sourceCharacter.shortName} and ${targetCharacter.shortName} must both be adults for marriage.`
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

    const marriageType = args[0] === "matrilineal" ? "matrilineal" : "patrilineal";

    runGameEffect(`
        global_var:votcce_action_source = {
            ${marriageType === "matrilineal" ? "marry_matrilineal" : "marry"} = global_var:votcce_action_target
        }`);

    removeRelationFromBoth(sourceCharacter, targetCharacter, sourceId, targetId, BETROTHED_STRINGS);
    addRelationToBoth(sourceCharacter, targetCharacter, sourceId, targetId, "Spouse");
    sourceCharacter.consort = targetCharacter.shortName;
    targetCharacter.consort = sourceCharacter.shortName;
  },

  chatMessage: (args) => {
    const marriageType = args[0] || "patrilineal";
    if (marriageType === "matrilineal") {
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
        pt: `{{character1Name}} e {{character2Name}} se casaram matrilinearmente.`,
        tr: `{{character1Name}} ve {{character2Name}} matrilineal olarak evlendi.`
      };
    }
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
      pt: `{{character1Name}} e {{character2Name}} se casaram.`,
      tr: `{{character1Name}} ve {{character2Name}} evlendi.`
    };
  },

chatMessageClass: "positive-action-message",
}