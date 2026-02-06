//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "undressAi",
    args: [],
    description: {
        en: `Executed when {{aiName}} undresses, either willingly or forcefully.`,
        zh: `当{{aiName}}自愿或被迫脱去衣服时执行。`,
        ru: `Выполняется, когда {{aiName}} раздевается, добровольно или принудительно.`,
        fr: `Exécuté lorsque {{aiName}} se déshabille, de plein gré ou par la force.`
    },

    /**
     * @param {GameData} gameData 
     */
    check: (gameData) => {
        return true;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
        runGameEffect(`
        global_var:talk_second_scope = {
            add_character_flag = {
                flag = is_naked
                days = 1
            }
        }
    `);
    },
    chatMessage: (args) =>{
        return {
            en: `{{aiName}} undressed.`,
            zh: `{{aiName}}脱去了衣服`,
            ru: `{{aiName}} разделся.`,
            fr: `{{aiName}} s'est déshabillé.`
        }
    },
    chatMessageClass: "neutral-action-message"
}
