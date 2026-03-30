/** @import { GameData, Character } from '../../gamedata_typedefs.js' */

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
      type: "string",
      desc: {
        en: "Trait key to add to the target character (e.g. 'brave', 'lustful', 'ambitious'). Spanish intent: 'ganar rasgo', 'adquirir rasgo', 'se vuelve'.",
        es: "Clave de rasgo para agregar al personaje objetivo (p. ej., 'valiente', 'lujurioso', 'ambicioso'). Intención en español: 'ganar rasgo', 'adquirir rasgo', 'se vuelve'."
      }
    },
    {
      name: "reason",
      type: "string",
      desc: {
        en: `Optional short reason from conversation context describing why this trait is being added. Spanish examples: 'tras la batalla', 'por su conducta'.`,
        es: `Razón corta opcional del contexto de la conversación que describe por qué se agrega este rasgo. Ejemplos en español: 'tras la batalla', 'por su conducta'.`
      }
    }
  ],
  description: {
    en: "Adds a long-term trait to a character when dialogue implies a personality or status change. The target (character2) receives the trait. Spanish trigger examples: 'se vuelve valiente', 'se ha vuelto paranoico'.",
    es: "Añade un rasgo a largo plazo a un personaje cuando el diálogo implica un cambio de personalidad o estado. El objetivo (character2) recibe el rasgo. Ejemplos de activación en español: 'se vuelve valiente', 'se ha vuelto paranoico'."
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
      es: `{{character2Name}} obtuvo el rasgo ${traitKey}.`
    };
  },

  chatMessageClass: "neutral-action-message"
};
