//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "playerPaysGoldToAi",
    args: [
        {
            name: "amount",
            type: "number",
            desc: "the amount of gold {{playerName}} pays to {{aiName}}"
        }
    ],
    description: {
        en: `Executed when {{playerName}} gives gold to {{aiName}}, only if {{aiName}} accepts it.`,
        zh: `当{{playerName}}给{{aiName}}金币时执行，仅在明确{{aiName}}接受并收取金币时执行。`,
        ru: `Выполняется, когда {{playerName}} дает золото {{aiName}}, только если {{aiName}} принимает его.`,
        fr: `Exécuté lorsque {{playerName}} donne de l'or à {{aiName}}, seulement si {{aiName}} l'accepte.`
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
            add_gold = ${args[0]};
            }

            global_var:talk_first_scope = {
                remove_short_term_gold = ${args[0]};
            }
        `);


        gameData.getPlayer().gold -= args[0];
        gameData.getPlayer().gold += args[0];
    },
    chatMessage: (args) =>{
        return `你向{{aiName}}支付了${args[0]}金币`
    },
    chatMessageClass: "neutral-action-message"
}
