//Made by: joemann, adjusted by MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "becomeSoulmates",
    args: [
        {
            name: "reason",
            type: "string",
            desc: { 
                en: "the reason (the event) that made them become passionate soulmates of eachother. (write it in past tense).",
                zh: "让他们成为激情灵魂伴侣的原因（事件）。（用过去时书写）",
                ru: "причина (событие), по которой они стали страстными родственными душами. (напишите в прошедшем времени).",
                fr: "la raison (l'événement) qui les a fait devenir des âmes sœurs passionnées. (écrivez-le au passé).",
                es: "la razón (el evento) que los hizo almas gemelas apasionadas. (escríbalo en tiempo pasado).",
                de: "der Grund (das Ereignis), der sie zu leidenschaftlichen Seelenverwandten gemacht hat. (schreiben Sie es in der Vergangenheitsform).",
                ja: "彼らが情熱的な魂の伴侶になった理由（出来事）。（過去形で書く）。",
                ko: "그들이 열정적인 영혼의 동반자가 된 이유(사건). (과거 시제로 작성).",
                pl: "powód (wydarzenie), który sprawił, że zostali namiętnymi bratnimi duszami. (napisz w czasie przeszłym)."
            }
        }
    ],
    description: {
        en: `Executed when two characters become passionate soulmates.`,
        zh: `当两个角色成为彼此的激情灵魂伴侣时执行。`,
        ru: `Выполняется, когда два персонажа становятся страстными родственными душами.`,
        fr: `Exécuté lorsque deux personnages deviennent des âmes sœurs passionnées.`,
        es: `Ejecutado cuando dos personajes se convierten en almas gemelas apasionadas.`,
        de: `Wird ausgeführt, wenn zwei Charaktere zu leidenschaftlichen Seelenverwandten werden.`,
        ja: `二人のキャラクターが情熱的な魂の伴侶になったときに実行されます。`,
        ko: `두 캐릭터가 열정적인 영혼의 동반자가 될 때 실행됩니다.`,
        pl: `Wykonywane, gdy dwie postacie stają się namiętnymi bratnimi duszami.`
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
            if (opinionOfSource > 40) conversationOpinion = 36;
        }

		return !relations.includes("Soulmate") && opinionOfSource > 40 && conversationOpinion > 35;
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
            set_relation_soulmate = { reason = ${args[0]} target = global_var:votcce_action_source }
        }`);

        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);
        if (!source || !target) return;

		target.addTrait({
            category: "flag",
            name: "AlreadySoulmate",
            desc: `${target.shortName} is a soulmate`
		});

        if (source.id === gameData.playerID) {
            if (!target.relationsToPlayer.includes("Soulmate")) {
                target.relationsToPlayer.push("Soulmate");
            }
        } else {
            let relationEntry = target.relationsToCharacters.find(r => r.id === source.id);
            if (relationEntry) {
                if (!relationEntry.relations.includes("Soulmate")) {
                    relationEntry.relations.push("Soulmate");
                }
            } else {
                target.relationsToCharacters.push({ id: source.id, relations: ["Soulmate"] });
            }
        }
    },
    chatMessage: (args) =>{
        return {
            en: `{{character1Name}} and {{character2Name}} became soulmates.`,
            zh: `{{character1Name}}和{{character2Name}}成为了灵魂伴侣。`,
            ru: `{{character1Name}} и {{character2Name}} стали родственными душами.`,
            fr: `{{character1Name}} et {{character2Name}} sont devenus des âmes sœurs.`,
            es: `{{character1Name}} y {{character2Name}} se convirtieron en almas gemelas.`,
            de: `{{character1Name}} und {{character2Name}} sind Seelenverwandte geworden.`,
            ja: `{{character1Name}}と{{character2Name}}は魂の伴侶になりました。`,
            ko: `{{character1Name}}와 {{character2Name}}가 영혼의 동반자가 되었습니다.`,
            pl: `{{character1Name}} i {{character2Name}} stali się bratnimi duszami.`
        }
    },
    chatMessageClass: "positive-action-message"
}
