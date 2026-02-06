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
    description: {
        en: `Executed when {{playerName}} and {{aiName}} become lovers after a sexual encounter.`,
        zh: `当{{playerName}}和{{aiName}}发生良好、出色或惊人的性关系并成为恋人时执行。`,
        ru: `Выполняется, когда {{playerName}} и {{aiName}} становятся любовниками после сексуальной связи.`,
        fr: `Exécuté lorsque {{playerName}} et {{aiName}} deviennent amants après une relation sexuelle.`
    },

    /**
     * @param {GameData} gameData 
     */
    check: (gameData) => {
        let ai = gameData.getAi();
        return !(ai.relationsToPlayer.includes("Lover")) && ai.getOpinionModifierValue("From conversations") > 25 && ai.opinionOfPlayer > 65
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
        return {
            en: `{{aiName}} became your lover.`,
            zh: `{{aiName}}成为了你的恋人。`,
            ru: `{{aiName}} стал вашим любовником.`,
            fr: `{{aiName}} est devenu votre amant.`
        }
    },
    chatMessageClass: "positive-action-message"
}
