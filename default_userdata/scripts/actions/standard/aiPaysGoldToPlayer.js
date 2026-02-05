//Made by: MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "aiPaysGoldToPlayer",
    args: [
        {
            name: "amount",
            type: "number",
            desc: "the amount of gold {{aiName}} pays to {{playerName}}, should be always positive"
        }
    ],
    description: {
        en: `Executed when {{aiName}} pays gold to {{playerName}}, willingly or forcefully, only if {{aiName}} has enough gold.`,
        zh: `当{{aiName}}自愿或被迫向{{playerName}}支付金币时执行，仅在{{aiName}}有足够金币支付时执行`,
        ru: `Выполняется, когда {{aiName}} платит золото {{playerName}}, добровольно или принудительно, только если у {{aiName}} достаточно золота.`,
        fr: `Exécuté lorsque {{aiName}} paie de l'or à {{playerName}}, de plein gré ou par la force, seulement si {{aiName}} a assez d'or.`
    },
    
    /**
     * @param {GameData} gameData 
     */
    check: (gameData) => {
		let ai = gameData.getAi();
		return ai.gold > 20;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
        let ai = gameData.getAi();
        args[1] = ai.gold
        if (Number(args[0]) <= Number(args[1])) {
            runGameEffect(`
                global_var:talk_first_scope = {
                    add_gold = ${args[0]};
                }

                global_var:talk_second_scope = {
                    remove_short_term_gold = ${args[0]};
                }
            `);
        }
    },
    chatMessage: (args) =>{
        if (Number(args[0]) <= Number(args[1])) {
            return `{{aiName}}向你支付了${args[0]}金币`
        }
        else {
            return `{{aiName}}没有足够的金币支付`
        }
    },
    chatMessageClass: "neutral-action-message"
}
