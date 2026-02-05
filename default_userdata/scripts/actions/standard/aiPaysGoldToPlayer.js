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
    chatMessage: (args) => {
        if (Number(args[0]) <= Number(args[1])) {
            return {
                en: `{{aiName}} paid you ${args[0]} gold.`,
                zh: `{{aiName}}向你支付了${args[0]}金币`,
                ru: `{{aiName}} заплатил вам ${args[0]} золота.`,
                fr: `{{aiName}} vous a payé ${args[0]} pièces d'or.`
            }
        } else {
            return {
                en: `{{aiName}} does not have enough gold to pay.`,
                zh: `{{aiName}}没有足够的金币支付`,
                ru: `У {{aiName}} недостаточно золота для оплаты.`,
                fr: `{{aiName}} n'a pas assez d'or pour payer.`
            }
        }
    },
    chatMessageClass: "neutral-action-message"
}
