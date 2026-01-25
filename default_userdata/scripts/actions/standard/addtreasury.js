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
    description: `当{{playerName}}的国库获得收入时执行`,
    
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
            return `{{playerName}}的国库获得了${args[0]}金币`
        }
    ,
    chatMessageClass: "neutral-action-message"
}