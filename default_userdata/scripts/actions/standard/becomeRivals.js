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
        en: `Executed when two characters become rivals.`,
        zh: `当两个角色成为彼此的仇人时执行。`,
        ru: `Выполняется, когда два персонажа становятся соперниками.`,
        fr: `Exécuté lorsque deux personnages deviennent rivaux.`,
        es: `Ejecutado cuando dos personajes se convierten en rivales.`,
        de: `Wird ausgeführt, wenn zwei Charaktere zu Rivalen werden.`,
        ja: `二人のキャラクターがライバルになったときに実行されます。`,
        ko: `두 캐릭터가 라이벌이 될 때 실행됩니다。`,
        pl: `Wykonywane, gdy dwie postacie stają się rywalami.`
    },

    /**
     * @param {GameData} gameData 
     * @param {number} initiatorId
     * @param {number} targetId
     */
    check: (gameData, initiatorId, targetId) => {
        const initiator = gameData.getCharacterById(initiatorId);
        const target = gameData.getCharacterById(targetId);
        if (!initiator || !target) return false;

        let opinionOfInitiator = 0;
        let relations = [];

        if (initiator.id === gameData.playerID) {
            opinionOfInitiator = target.opinionOfPlayer;
            relations = target.relationsToPlayer;
        } else {
            const opinionEntry = target.opinions.find(o => o.id === initiator.id);
            opinionOfInitiator = opinionEntry ? opinionEntry.opinon : 0;
            const relationEntry = target.relationsToCharacters.find(r => r.id === initiator.id);
            relations = relationEntry ? relationEntry.relations : [];
        }
        
        return !relations.includes("Friend") && 
               !relations.includes("Rival") &&
               opinionOfInitiator < 20;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     * @param {number} initiatorId
     * @param {number} targetId
     */
    run: (gameData, runGameEffect, args, initiatorId, targetId) => {
        console.log(args[0])
        runGameEffect(`global_var:votcce_action_target = {
            set_relation_rival = { reason = ${args[0]} target = global_var:votcce_action_source }
        }`);

        const initiator = gameData.getCharacterById(initiatorId);
        const target = gameData.getCharacterById(targetId);
        if (!initiator || !target) return;

        if (initiator.id === gameData.playerID) {
            if (!target.relationsToPlayer.includes("Rival")) {
                target.relationsToPlayer.push("Rival");
            }
        } else {
            let relationEntry = target.relationsToCharacters.find(r => r.id === initiator.id);
            if (relationEntry) {
                if (!relationEntry.relations.includes("Rival")) {
                    relationEntry.relations.push("Rival");
                }
            } else {
                target.relationsToCharacters.push({ id: initiator.id, relations: ["Rival"] });
            }
        }
    },
    chatMessage: (args) =>{
        return {
            en: `{{character1Name}} and {{character2Name}} became rivals.`,
            zh: `{{character1Name}}和{{character2Name}}成为了仇人。`,
            ru: `{{character1Name}} и {{character2Name}} стали соперниками.`,
            fr: `{{character1Name}} et {{character2Name}} sont devenus rivaux.`,
            es: `{{character1Name}} y {{character2Name}} se convirtieron en rivales.`,
            de: `{{character1Name}} und {{character2Name}} sind zu Rivalen geworden.`,
            ja: `{{character1Name}}と{{character2Name}}はライバルになりました。`,
            ko: `{{character1Name}}와 {{character2Name}}가 라이벌이 되었습니다.`,
            pl: `{{character1Name}} i {{character2Name}} zostali rywalami.`
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
