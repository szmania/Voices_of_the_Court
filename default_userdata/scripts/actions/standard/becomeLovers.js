//Made by: joemann, adjusted by MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "becomeLovers",
    args: [
        {
            name: "reason",
            type: "string",
            desc: { 
                en: "the reason (the event) that made them become lovers of each other. (write it in past tense).",
                zh: "让他们成为恋人的原因（事件）。（用过去时书写）",
                ru: "причина (событие), по которой они стали любовниками. (напишите в прошедшем времени).",
                fr: "la raison (l'événement) qui les a fait devenir amants. (écrivez-le au passé).",
                es: "la razón (el evento) que los hizo amantes. (escríbalo en tiempo pasado).",
                de: "der Grund (das Ereignis), der sie zu Liebhabern gemacht hat. (schreiben Sie es in der Vergangenheitsform).",
                ja: "彼らが恋人同士になった理由（出来事）。（過去形で書く）。",
                ko: "그들이 연인이 된 이유(사건). (과거 시제로 작성).",
                pl: "powód (wydarzenie), który sprawił, że zostali kochankami. (napisz w czasie przeszłym)."
            }
        }
    ],
    description: {
        en: `Executed when two characters become lovers after a sexual encounter.`,
        zh: `当两个角色发生良好、出色或惊人的性关系并成为恋人时执行。`,
        ru: `Выполняется, когда два персонажа становятся любовниками после сексуальной связи.`,
        fr: `Exécuté lorsque deux personnages deviennent amants après une relation sexuelle.`,
        es: `Ejecutado cuando dos personajes se convierten en amantes después de un encuentro sexual.`,
        de: `Wird ausgeführt, wenn zwei Charaktere nach einer sexuellen Begegnung zu Liebhabern werden.`,
        ja: `二人のキャラクターが性的な出会いの後に恋人同士になったときに実行されます。`,
        ko: `두 캐릭터가 성적인 만남 후에 연인이 될 때 실행됩니다.`,
        pl: `Wykonywane, gdy dwie postacie stają się kochankami po stosunku seksualnym.`
    },

    /**
     * @param {GameData} gameData 
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) => {
        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);
        if (!source || !target) return false;

        let opinionOfSource = 0;
        let relations = [];
        let conversationOpinion = 0;

        if (source.id === gameData.playerID) {
            opinionOfSource = target.opinionOfPlayer;
            relations = target.relationsToPlayer;
            conversationOpinion = target.getOpinionModifierValue("From conversations");
        } else {
            const opinionEntry = target.opinions.find(o => o.id === source.id);
            opinionOfSource = opinionEntry ? opinionEntry.opinon : 0;
            const relationEntry = target.relationsToCharacters.find(r => r.id === source.id);
            relations = relationEntry ? relationEntry.relations : [];
            // Simulate conversation opinion for AI-AI
            if (opinionOfSource > 65) conversationOpinion = 26;
        }
        
        return !relations.includes("Lover") && conversationOpinion > 25 && opinionOfSource > 65;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     * @param {number} sourceId
     * @param {number} targetId
     */
    run: (gameData, runGameEffect, args, sourceId, targetId) => {
        console.log(args[0])
        runGameEffect(`global_var:votcce_action_target = {
            set_relation_lover = { reason = ${args[0]} target = global_var:votcce_action_source }
        }`);

        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);
        if (!source || !target) return;

		target.addTrait({
            category: "flag",
            name: "AlreadyLover",
            desc: `${target.shortName} already lover`
		});

        if (source.id === gameData.playerID) {
            if (!target.relationsToPlayer.includes("Lover")) {
                target.relationsToPlayer.push("Lover");
            }
        } else {
            let relationEntry = target.relationsToCharacters.find(r => r.id === source.id);
            if (relationEntry) {
                if (!relationEntry.relations.includes("Lover")) {
                    relationEntry.relations.push("Lover");
                }
            } else {
                target.relationsToCharacters.push({ id: source.id, relations: ["Lover"] });
            }
        }
    },
    chatMessage: (args) =>{
        return {
            en: `{{character1Name}} and {{character2Name}} became lovers.`,
            zh: `{{character1Name}}和{{character2Name}}成为了恋人。`,
            ru: `{{character1Name}} и {{character2Name}} стали любовниками.`,
            fr: `{{character1Name}} et {{character2Name}} sont devenus amants.`,
            es: `{{character1Name}} y {{character2Name}} se convirtieron en amantes.`,
            de: `{{character1Name}} und {{character2Name}} sind Liebhaber geworden.`,
            ja: `{{character1Name}}と{{character2Name}}は恋人同士になりました。`,
            ko: `{{character1Name}}와 {{character2Name}}가 연인이 되었습니다.`,
            pl: `{{character1Name}} i {{character2Name}} zostali kochankami.`
        }
    },
    chatMessageClass: "positive-action-message"
}
