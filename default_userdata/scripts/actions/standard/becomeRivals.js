//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "becomeRivals",
    args: [
        {
            name: "reason",
            type: "string",
            desc: { 
                en: "the reason (the event) that made them become rivals with eachother. (write it in past tense).",
                zh: "让他们成为仇人的原因（事件）。（用过去时书写）",
                ru: "причина (событие), по которой они стали соперниками. (напишите в прошедшем времени).",
                fr: "la raison (l'événement) qui les a fait devenir rivaux. (écrivez-le au passé).",
                es: "la razón (el evento) que los hizo rivales. (escríbalo en tiempo pasado).",
                de: "der Grund (das Ereignis), der sie zu Rivalen gemacht hat. (schreiben Sie es in der Vergangenheitsform).",
                ja: "彼らがライバルになった理由（出来事）。（過去形で書く）。",
                ko: "그들이 라이벌이 된 이유(사건). (과거 시제로 작성).",
                pl: "powód (wydarzenie), który sprawił, że zostali rywalami. (napisz w czasie przeszłym)."
            }
        }
    ],
    description: {
        en: `Executed when {{playerName}} and {{aiName}} become rivals.`,
        zh: `当{{playerName}}和{{aiName}}成为彼此的仇人时执行。`,
        ru: `Выполняется, когда {{playerName}} и {{aiName}} становятся соперниками.`,
        fr: `Exécuté lorsque {{playerName}} et {{aiName}} deviennent rivaux.`,
        es: `Ejecutado cuando {{playerName}} y {{aiName}} se convierten en rivales.`,
        de: `Wird ausgeführt, wenn {{playerName}} und {{aiName}} zu Rivalen werden.`,
        ja: `{{playerName}}と{{aiName}}がライバルになったときに実行されます。`,
        ko: `{{playerName}}와 {{aiName}}가 라이벌이 될 때 실행됩니다.`,
        pl: `Wykonywane, gdy {{playerName}} i {{aiName}} stają się rywalami.`
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
        return {
            en: `{{aiName}} became your rival.`,
            zh: `{{aiName}}成为了你的仇人。`,
            ru: `{{aiName}} стал вашим соперником.`,
            fr: `{{aiName}} est devenu votre rival.`,
            es: `{{aiName}} se convirtió en tu rival.`,
            de: `{{aiName}} ist dein Rivale geworden.`,
            ja: `{{aiName}}はあなたのライバルになりました。`,
            ko: `{{aiName}}가 당신의 라이벌이 되었습니다.`,
            pl: `{{aiName}} stał się twoim rywalem.`
        }
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
