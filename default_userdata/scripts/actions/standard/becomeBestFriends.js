//Made by: GitHub Sync

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "becomeBestFriends",
    args: [
        {
            name: "reason",
            type: "string",
            desc: {
                en: "the reason (the event) that made them become best friends. (write it in past tense).",
                zh: "让他们成为最好朋友的原因（事件）。（用过去时书写）",
                ru: "причина (событие), по которой они стали лучшими друзьями. (напишите в прошедшем времени).",
                fr: "la raison (l'événement) qui les a fait devenir meilleurs amis. (écrivez-le au passé).",
                es: "la razón (el evento) que los hizo mejores amigos. (escríbalo en tiempo pasado).",
                de: "der Grund (das Ereignis), der sie zu besten Freunden gemacht hat. (schreiben Sie es in der Vergangenheitsform).",
                ja: "彼らが親友になった理由（出来事）。（過去形で書く）。",
                ko: "그들이 가장 친한 친구가 된 이유(사건). (과거 시제로 작성).",
                pl: "powód (wydarzenie), który sprawił, że zostali najlepszymi przyjaciółmi. (napisz w czasie przeszłym)."
            }
        }
    ],
    description: {
        en: `Executed when two characters become best friends.`,
        zh: `当两个角色成为最好的朋友时执行。`,
        ru: `Выполняется, когда два персонажа становятся лучшими друзьями.`,
        fr: `Exécuté lorsque deux personnages deviennent meilleurs amis.`,
        es: `Ejecutado cuando dos personajes se convierten en mejores amigos.`,
        de: `Wird ausgeführt, wenn zwei Charaktere zu besten Freunden werden.`,
        ja: `二人のキャラクターが親友になったときに実行されます。`,
        ko: `두 캐릭터가 가장 친한 친구가 될 때 실행됩니다.`,
        pl: `Wykonywane, gdy dwie postacie stają się najlepszymi przyjaciółmi.`
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
            // No generic conversation opinion, so we'll have to make do.
            if (opinionOfSource > 50) conversationOpinion = 51;
        }
        
        return !relations.includes("Best Friend") && 
               relations.includes("Friend") &&
               conversationOpinion > 50 &&
               opinionOfSource > 50;
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
            set_relation_best_friend = { reason = ${args[0]} target = global_var:votcce_action_source }
        }`);

        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);
        if (!source || !target) return;

        if (source.id === gameData.playerID) {
            let friendIndex = target.relationsToPlayer.indexOf("Friend");
            if (friendIndex !== -1) {
                target.relationsToPlayer.splice(friendIndex, 1);
            }
            target.relationsToPlayer.push("Best Friend");
        } else {
            let relationEntry = target.relationsToCharacters.find(r => r.id === source.id);
            if (relationEntry) {
                let friendIndex = relationEntry.relations.indexOf("Friend");
                if (friendIndex !== -1) {
                    relationEntry.relations.splice(friendIndex, 1);
                }
                relationEntry.relations.push("Best Friend");
            } else {
                target.relationsToCharacters.push({ id: source.id, relations: ["Best Friend"] });
            }
        }
    },
    chatMessage: (args) =>{
        return {
            en: `{{character1Name}} and {{character2Name}} became best friends.`,
            zh: `{{character1Name}}和{{character2Name}}成为了最好的朋友。`,
            ru: `{{character1Name}} и {{character2Name}} стали лучшими друзьями.`,
            fr: `{{character1Name}} et {{character2Name}} sont devenus meilleurs amis.`,
            es: `{{character1Name}} y {{character2Name}} se convirtieron en mejores amigos.`,
            de: `{{character1Name}} und {{character2Name}} sind beste Freunde geworden.`,
            ja: `{{character1Name}}と{{character2Name}}は親友になりました。`,
            ko: `{{character1Name}}와 {{character2Name}}가 가장 친한 친구가 되었습니다.`,
            pl: `{{character1Name}} i {{character2Name}} zostali najlepszymi przyjaciółmi.`
        }
    },
    chatMessageClass: "positive-action-message"
}
