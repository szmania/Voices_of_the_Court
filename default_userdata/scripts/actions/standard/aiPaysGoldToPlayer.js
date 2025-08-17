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
    description: `execute when {{aiName}} pays gold to {{playerName}} either willingly or forcefully against {{aiName}} wish and ONLY WHEN {{aiName}} has enough gold to pay`,
    
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
            return `{{aiName}} paid ${args[0]} gold to you`
        }
        else {
            return `{{aiName}} doesn't have enough gold to pay`
        }
    },
    chatMessageClass: "neutral-action-message"
}