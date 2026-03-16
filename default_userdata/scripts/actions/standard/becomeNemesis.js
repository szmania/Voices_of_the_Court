//Made by: GitHub Sync

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "becomeNemesis",
    args: [
        {
            name: "reason",
            type: "string",
            desc: { 
                en: "the reason (the event) that made them become nemesis of each other. (write it in past tense).", 
                zh: "让他们成为宿敌的原因（事件）。（用过去时书写）",
                ru: "причина (событие), по которой они стали заклятыми врагами. (напишите в прошедшем времени).",
                fr: "la raison (l'événement) qui les a fait devenir ennemis jurés. (écrivez-le au passé).",
                es: "la razón (el evento) que los hizo némesis. (escríbalo en tiempo pasado).",
                de: "der Grund (das Ereignis), der sie zu Erzfeinden gemacht hat. (schreiben Sie es in der Vergangenheitsform).",
                ja: "彼らが宿敵になった理由（出来事）。（過去形で書く）。",
                ko: "그들이 천적이 된 이유(사건). (과거 시제로 작성).",
                pl: "powód (wydarzenie), który sprawił, że zostali śmiertelnymi wrogami. (napisz w czasie przeszłym)."
            }
        }
    ],
    description: {
        en: `Executed when two characters become nemesis.`,
        zh: `当两个角色成为彼此的宿敌时执行。`,
        ru: `Выполняется, когда два персонажа становятся заклятыми врагами.`,
        fr: `Exécuté lorsque deux personnages deviennent ennemis jurés.`,
        es: `Ejecutado cuando dos personajes se convierten en némesis.`,
        de: `Wird ausgeführt, wenn zwei Charaktere zu Erzfeinden werden.`,
        ja: `二人のキャラクターが宿敵になったときに実行されます。`,
        ko: `두 캐릭터가 천적이 될 때 실행됩니다.`,
        pl: `Wykonywane, gdy dwie postacie stają się śmiertelnymi wrogami.`
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
            if (opinionOfSource < -30) conversationOpinion = -21;
        }

        return !relations.includes("Nemesis") && 
               relations.includes("Rival") &&
               opinionOfSource < -30 &&
               conversationOpinion < -20;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     * @param {number} sourceId
     * @param {number} targetId
     */
    run: (gameData, runGameEffect, args, sourceId, targetId) => {
        runGameEffect(`global_var:votcce_action_target = {
            set_relation_nemesis = { reason = ${args[0]} target = global_var:votcce_action_source }
        }`);

        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);
        if (!source || !target) return;

        if (source.id === gameData.playerID) {
            let rivalIndex = target.relationsToPlayer.indexOf("Rival");
            if (rivalIndex !== -1) {
                target.relationsToPlayer.splice(rivalIndex, 1);
            }
            if (!target.relationsToPlayer.includes("Nemesis")) {
                target.relationsToPlayer.push("Nemesis");
            }
        } else {
            let relationEntry = target.relationsToCharacters.find(r => r.id === source.id);
            if (relationEntry) {
                let rivalIndex = relationEntry.relations.indexOf("Rival");
                if (rivalIndex !== -1) {
                    relationEntry.relations.splice(rivalIndex, 1);
                }
                if (!relationEntry.relations.includes("Nemesis")) {
                    relationEntry.relations.push("Nemesis");
                }
            } else {
                // This case shouldn't happen based on check(), but as a fallback...
                target.relationsToCharacters.push({ id: source.id, relations: ["Nemesis"] });
            }
        }
    },
    chatMessage: (args) =>{
        return {
            en: `{{character1Name}} and {{character2Name}} became nemesis.`,
            zh: `{{character1Name}}和{{character2Name}}成为了宿敌。`,
            ru: `{{character1Name}} и {{character2Name}} стали заклятыми врагами.`,
            fr: `{{character1Name}} et {{character2Name}} sont devenus ennemis jurés.`,
            es: `{{character1Name}} y {{character2Name}} se convirtieron en némesis.`,
            de: `{{character1Name}} und {{character2Name}} sind zu Erzfeinden geworden.`,
            ja: `{{character1Name}}と{{character2Name}}は宿敵になりました。`,
            ko: `{{character1Name}}와 {{character2Name}}가 천적이 되었습니다.`,
            pl: `{{character1Name}} i {{character2Name}} stali się śmiertelnymi wrogami.`
        }
    },
    chatMessageClass: "negative-action-message"
}
