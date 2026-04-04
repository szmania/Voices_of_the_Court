//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "becomeCloseFriends",
    args: [
        {
            name: "reason",
            type: "string",
            desc: { 
                en: "the reason (the event) that made them become friends. (in past tense).",
                zh: "让他们成为朋友的原因（事件）。（用过去时书写）",
                ru: "причина (событие), по которой они стали друзьями. (в прошедшем времени).",
                fr: "la raison (l'événement) qui les a fait devenir amis. (au passé).",
                es: "la razón (el evento) que los hizo amigos. (en tiempo pasado).",
                de: "der Grund (das Ereignis), der sie zu Freunden gemacht hat. (in der Vergangenheitsform).",
                ja: "彼らが友達になった理由（出来事）。（過去形で書く）。",
                ko: "그들이 친구가 된 이유(사건). (과거 시제로 작성).",
                pl: "powód (wydarzenie), który sprawił, że zostali przyjaciółmi. (w czasie przeszłym)."
            }
        }
    ],
    description: {
        en: `Executed when a strong and close friendship forms between two characters. The source (character1) and target (character2) are the two characters forming the friendship.`,
        zh: `当两个角色之间形成牢固而亲密的友谊时执行。`,
        ru: `Выполняется, когда между двумя персонажами завязывается крепкая и близкая дружба.`,
        fr: `Exécuté lorsqu'une amitié forte et étroite se noue entre deux personnages.`,
        es: `Ejecutado cuando se forma una amistad fuerte y cercana entre dos personajes.`,
        de: `Wird ausgeführt, wenn sich eine starke und enge Freundschaft zwischen zwei Charakteren bildet.`,
        ja: `二人のキャラクターの間に強く親密な友情が形成されたときに実行されます。`,
        ko: `두 캐릭터 사이에 강하고 친밀한 우정이 형성될 때 실행됩니다.`,
        pl: `Wykonywane, gdy między dwiema postaciami zawiązuje się silna i bliska przyjaźń.`
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
            // Simulate conversation opinion for AI-AI
            if (opinionOfSource > 0) conversationOpinion = 36;
        }
        
        return conversationOpinion > 35 &&
               opinionOfSource > 0 &&
               !relations.includes("Friend");
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
            set_relation_friend = { reason = ${args[0]} target = global_var:votcce_action_source }
        }`)

        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);
        if (!source || !target) return;

        if (source.id === gameData.playerID) {
            if (!target.relationsToPlayer.includes("Friend")) {
                target.relationsToPlayer.push("Friend");
            }
        } else {
            let relationEntry = target.relationsToCharacters.find(r => r.id === source.id);
            if (relationEntry) {
                if (!relationEntry.relations.includes("Friend")) {
                    relationEntry.relations.push("Friend");
                }
            } else {
                target.relationsToCharacters.push({ id: source.id, relations: ["Friend"] });
            }
        }
    },
    chatMessage: (args) =>{
        return {
            en: `{{character1Name}} and {{character2Name}} became friends.`,
            zh: `{{character1Name}}和{{character2Name}}成为了朋友。`,
            ru: `{{character1Name}} и {{character2Name}} стали друзьями.`,
            fr: `{{character1Name}} et {{character2Name}} sont devenus amis.`,
            es: `{{character1Name}} y {{character2Name}} se hicieron amigos.`,
            de: `{{character1Name}} und {{character2Name}} sind Freunde geworden.`,
            ja: `{{character1Name}}と{{character2Name}}は友達になりました。`,
            ko: `{{character1Name}}와 {{character2Name}}가 친구가 되었습니다.`,
            pl: `{{character1Name}} i {{character2Name}} zostali przyjaciółmi.`
        }
    },
    chatMessageClass: "positive-action-message"
}
