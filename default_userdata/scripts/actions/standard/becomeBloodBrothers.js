//Made by: GitHub Sync

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "becomeBloodBrothers",
    args: [
        {
            name: "reason",
            type: "string",
            desc: { 
                en: "the reason (the event) that made them become blood brothers. (write it in past tense).", 
                zh: "让他们成为结义兄弟的原因（事件）。（用过去时书写）",
                ru: "причина (событие), по которой они стали побратимами. (напишите в прошедшем времени).",
                fr: "la raison (l'événement) qui les a fait devenir frères de sang. (écrivez-le au passé).",
                es: "la razón (el evento) que los hizo hermanos de sangre. (escríbalo en tiempo pasado).",
                de: "der Grund (das Ereignis), der sie zu Blutsbrüdern gemacht hat. (schreiben Sie es in der Vergangenheitsform).",
                ja: "彼らが血の盟友になった理由（出来事）。（過去形で書く）。",
                ko: "그들이 결의 형제가 된 이유(사건). (과거 시제로 작성).",
                pl: "powód (wydarzenie), który sprawił, że zostali braćmi krwi. (napisz w czasie przeszłym)."
            }
        }
    ],
    description: {
        en: `Executed when two characters become blood brothers. The source (character1) and target (character2) are the two characters becoming blood brothers.`,
        zh: `当两个角色成为结义兄弟时执行。`,
        ru: `Выполняется, когда два персонажа становятся побратимами.`,
        fr: `Exécuté lorsque deux personnages deviennent frères de sang.`,
        es: `Ejecutado cuando dos personajes se convierten en hermanos de sangre.`,
        de: `Wird ausgeführt, wenn zwei Charaktere zu Blutsbrüdern werden.`,
        ja: `二人のキャラクターが血の盟友になったときに実行されます。`,
        ko: `두 캐릭터가 결의 형제가 될 때 실행됩니다.`,
        pl: `Wykonywane, gdy dwie postacie stają się braćmi krwi.`
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
            opinionOfSource = opinionEntry ? opinionEntry.opinion : 0;
            const relationEntry = target.relationsToCharacters.find(r => r.id === source.id);
            relations = relationEntry ? relationEntry.relations : [];
            // No generic conversation opinion, so we'll have to make do.
            if (opinionOfSource > 70) conversationOpinion = 61;
        }

        return !relations.includes("Blood Brother") && 
               conversationOpinion > 60 &&
               opinionOfSource > 70;
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
            set_relation_blood_brother = { reason = ${args[0]} target = global_var:votcce_action_source }
        }`);

        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);
        if (!source || !target) return;

        if (source.id === gameData.playerID) {
            let rivalIndex = target.relationsToPlayer.indexOf("Rival");
            if (rivalIndex !== -1) {
                target.relationsToPlayer.splice(rivalIndex, 1);
            }
            target.relationsToPlayer.push("Blood Brother");
        } else {
            let relationEntry = target.relationsToCharacters.find(r => r.id === source.id);
            if (relationEntry) {
                let rivalIndex = relationEntry.relations.indexOf("Rival");
                if (rivalIndex !== -1) {
                    relationEntry.relations.splice(rivalIndex, 1);
                }
                relationEntry.relations.push("Blood Brother");
            } else {
                target.relationsToCharacters.push({ id: source.id, relations: ["Blood Brother"] });
            }
        }
    },
    chatMessage: (args) =>{
        return {
            en: `{{character1Name}} and {{character2Name}} became blood brothers.`,
            zh: `{{character1Name}}和{{character2Name}}成为了结义兄弟。`,
            ru: `{{character1Name}} и {{character2Name}} стали побратимами.`,
            fr: `{{character1Name}} et {{character2Name}} sont devenus frères de sang.`,
            es: `{{character1Name}} y {{character2Name}} se convirtieron en hermanos de sangre.`,
            de: `{{character1Name}} und {{character2Name}} sind Blutsbrüder geworden.`,
            ja: `{{character1Name}}と{{character2Name}}は血の盟友になりました。`,
            ko: `{{character1Name}}와 {{character2Name}}가 결의 형제가 되었습니다.`,
            pl: `{{character1Name}} i {{character2Name}} zostali braćmi krwi.`
        }
    },
    chatMessageClass: "positive-action-message"
}
