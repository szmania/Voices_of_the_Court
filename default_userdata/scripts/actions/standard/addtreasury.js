//Made by: Lisiyuan

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "addTreasury",
    args: [
        {
            name: "amount",
            type: "number",
            desc: "the amount of gold {{playerName}}'treasury gets, should be always positive"
        }
    ],
    description: {
        en: `Executed when {{playerName}}'s treasury receives income.`,
        zh: `当{{playerName}}的国库获得收入时执行`,
        ru: `Выполняется, когда казна {{playerName}} получает доход.`,
        fr: `Exécuté lorsque le trésor de {{playerName}} reçoit des revenus.`
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
                global_var:talk_first_scope = {
                    add_treasury_or_gold = ${args[0]};
                }
            `);
        },
    chatMessage: (args) =>{
            return {
                en: `{{playerName}}'s treasury received ${args[0]} gold.`,
                zh: `{{playerName}}的国库获得了${args[0]}金币`,
                ru: `Казна {{playerName}} получила ${args[0]} золота.`,
                fr: `Le trésor de {{playerName}} a reçu ${args[0]} pièces d'or.`
            }
        }
    ,
    chatMessageClass: "neutral-action-message"
}