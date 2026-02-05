//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "becomeRivals",
    args: [
        {
            name: "reason",
            type: "string",
            desc: "the reason (the event) that made them become rivals with eachother. (write it in past tense)."
        }
    ],
    description: {
        en: `Executed when {{playerName}} and {{aiName}} become rivals.`,
        zh: `当{{playerName}}和{{aiName}}成为彼此的仇人时执行。`,
        ru: `Выполняется, когда {{playerName}} и {{aiName}} становятся соперниками.`,
        fr: `Exécuté lorsque {{playerName}} et {{aiName}} deviennent rivaux.`
    },

    /**
     * @param {GameData} gameData 
     */
    check: (gameData) => {
        let ai = gameData.getAi();
        
        return ( !ai.relationsToPlayer.includes("Friend") && 
                !ai.relationsToPlayer.includes("Rival") &&
                ai.opinionOfPlayer < 20
                )
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
        console.log(args[0])
        runGameEffect(`global_var:talk_second_scope = {
            set_relation_rival = { reason = ${args[0]} target = global_var:talk_first_scope }
        }`)

        gameData.getAi().relationsToPlayer.push("Rival");
    },
    chatMessage: (args) =>{
        return `{{aiName}}成为了你的仇人。`
    },
    chatMessageClass: "negative-action-message"
}
//help functions 
function getConversationOpinionValue(opinionBreakdown){
    let results = opinionBreakdown.filter( (opinionModifier) =>{
        return opinionModifier.reason == "From conversations";
    })

    let conversationOpinion = 0;
    if(results.length>0){
        conversationOpinion = results[0].value;
    }

    return conversationOpinion;
}
