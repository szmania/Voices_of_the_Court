//Made by: joemann, adjusted by MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "becomeSoulmates",
    args: [
        {
            name: "reason",
            type: "string",
            desc: "the reason (the event) that made them become soulmates of eachother. (write it in past tense)."
        }
    ],
    description: "Execute when {{playerName}} and {{aiName}} became passionate soulmates with eachother.",

    /**
     * @param {GameData} gameData 
     */
    check: (gameData) => {
        let ai = gameData.getAi();
		return !(ai.relationsToPlayer.includes("Soulmate")) && ai.opinionOfPlayer > 40 && ai.getOpinionModifierValue("From conversation") > 35
				
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
        console.log(args[0])
        let ai = gameData.getAi();
        runGameEffect(`global_var:talk_second_scope = {
            set_relation_soulmate = { reason = ${args[0]} target = global_var:talk_first_scope }
        }`)
		ai.addTrait({
        category: "flag",
        name: "AlreadySoulmate",
        desc: `${gameData.getAi().shortName} had sex recently`
		})
		gameData.getAi().relationsToPlayer.push("Soulmate");
    },
    chatMessage: (args) =>{
        return `{{aiName}} has become your soulmate.`
    },
    chatMessageClass: "positive-action-message"
}