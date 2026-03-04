//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "becomeCloseFriends",
    args: [
        {
            name: "reason",
            type: "string",
            desc: "the reason (the event) that made them become friends. (in past tense)."
        }
    ],
    description: {
        en: `Executed when a strong and close friendship forms between {{playerName}} and {{aiName}}.`,
        zh: `当{{playerName}}和{{aiName}}之间形成牢固而亲密的友谊时执行。`,
        ru: `Выполняется, когда между {{playerName}} и {{aiName}} завязывается крепкая и близкая дружба.`,
        fr: `Exécuté lorsqu'une amitié forte et étroite se noue entre {{playerName}} et {{aiName}}.`,
        es: `Ejecutado cuando se forma una amistad fuerte y cercana entre {{playerName}} y {{aiName}}.`,
        de: `Wird ausgeführt, wenn sich eine starke und enge Freundschaft zwischen {{playerName}} und {{aiName}} bildet.`,
        ja: `{{playerName}}と{{aiName}}の間に強く親密な友情が形成されたときに実行されます。`,
        ko: `{{playerName}}와 {{aiName}} 사이에 강하고 친밀한 우정이 형성될 때 실행됩니다.`,
        pl: `Wykonywane, gdy między {{playerName}} a {{aiName}} zawiązuje się silna i bliska przyjaźń.`
    },

    /**
     * @param {GameData} gameData 
     */
    check: (gameData) => {
        let ai = gameData.getAi();
        
        return (ai.getOpinionModifierValue("From conversations") > 35 &&
                ai.opinionOfPlayer > 0 &&
                !ai.relationsToPlayer.includes("Friend"))
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
        runGameEffect(`global_var:talk_second_scope = {
            set_relation_friend = { reason = ${args[0]} target = global_var:talk_first_scope }
        }`)

        gameData.getAi().relationsToPlayer.push("Friend");
    },
    chatMessage: (args) =>{
        return {
            en: `{{aiName}} became your friend.`,
            zh: `{{aiName}}成为了你的朋友。`,
            ru: `{{aiName}} стал вашим другом.`,
            fr: `{{aiName}} est devenu votre ami.`,
            es: `{{aiName}} se convirtió en tu amigo.`,
            de: `{{aiName}} ist dein Freund geworden.`,
            ja: `{{aiName}}はあなたの友達になりました。`,
            ko: `{{aiName}}가 당신의 친구가 되었습니다.`,
            pl: `{{aiName}} stał się twoim przyjacielem.`
        }
    },
    chatMessageClass: "positive-action-message"
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
