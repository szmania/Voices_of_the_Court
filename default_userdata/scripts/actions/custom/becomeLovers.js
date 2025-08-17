//Made by: joemann, adjusted by MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "becomeLovers",
    args: [
        {
            name: "reason",
            type: "string",
            desc: "the reason (the event) that made them become lovers of each other. (write it in past tense)."
        }
    ],
    description: "Execute when {{playerName}} and {{aiName}} became have good, great or amazing sex with each other and become lovers.",

    /**
     * @param {GameData} gameData 
     */
    check: (gameData) => {
        let ai = gameData.getAi();
        return !(ai.relationsToPlayer.includes("Lover")) && ai.getOpinionModifierValue("From conversation") > 25 && ai.opinionOfPlayer > 65				               				
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
        console.log(args[0])
        runGameEffect(`global_var:talk_second_scope = {
            set_relation_lover = { reason = ${args[0]} target = global_var:talk_first_scope }
        }`)
		gameData.getAi().addTrait({
        category: "flag",
        name: "AlreadyLover",
        desc: `${gameData.getAi().shortName} already lover`
		})
		gameData.getAi().relationsToPlayer.push("Lover");
    },
    chatMessage: (args) =>{
        return `{{aiName}} has become your lover.`
    },
    chatMessageClass: "positive-action-message"
}
