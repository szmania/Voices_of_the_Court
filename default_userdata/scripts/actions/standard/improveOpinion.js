//Made by: Durond (Refactored for character-agnosticism)

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "improveOpinion",
    args: [ 
        {
            name: "opinion",
            type: "number",
            min: 1,
            max: 5,
            desc: { 
                en: "the number of opinion values the relation improves with.",
                zh: "关系改善的意见值数量。",
                ru: "количество значений мнения, на которое улучшаются отношения.",
                fr: "le nombre de valeurs d'opinion par lesquelles la relation s'améliore.",
                es: "el número de valores de opinión con los que mejora la relación.",
                de: "die Anzahl der Meinungswerte, um die sich die Beziehung verbessert.",
                ja: "関係が改善する意見値の数。",
                ko: "관계가 개선되는 평가 값의 수.",
                pl: "liczba wartości opinii, o które poprawia się relacja."
            }
        }
    ],
    description: {
        en: `Executed when one character's opinion of another improves. The source (character1) is the character whose actions are being judged. The target (character2) is the character whose opinion is IMPROVING.`,
        zh: `当一个角色的对话或行动显著改善了另一个角色对他们的看法时执行。`,
        ru: `Выполняется, когда диалог или действие одного персонажа значительно улучшает мнение другого о нем.`,
        fr: `Exécuté lorsque le dialogue ou l'action d'un personnage améliore considérablement l'opinion qu'un autre a de lui.`,
        es: `Ejecutado cuando el diálogo o la acción de un personaje mejora significativamente la opinión que otro tiene de él.`,
        de: `Wird ausgeführt, wenn der Dialog oder die Handlung eines Charakters die Meinung eines anderen über ihn erheblich verbessert.`,
        ja: `あるキャラクターの対話または行動が、別のキャラクターの彼らに対する評価を大幅に向上させたときに実行されます。`,
        ko: `한 캐릭터의 대화나 행동이 다른 캐릭터의 그들에 대한 평가를 크게 개선할 때 실행됩니다.`,
        pl: `Wykonywane, gdy dialog lub działanie jednej postaci znacząco poprawia opinię drugiej o niej.`
    },

    /**
     * @param {GameData} gameData 
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) =>{
        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);

        if (!source || !target || target.id === gameData.playerID) {
            // Target cannot be the player, as we can't model player opinion.
            return false;
        }

        let opinionValue = 0;
        if (source.id === gameData.playerID) {
            // Target is AI, source is Player. Check AI's opinion of Player.
            opinionValue = target.opinionOfPlayer;
        } else {
            // Target is AI, source is also AI. Check Target's opinion of Source.
            const opinionEntry = target.opinions.find(o => o.id === source.id);
            opinionValue = opinionEntry ? opinionEntry.opinon : 0;
        }

        // Simplified check from original: only improve an already non-negative opinion.
        return opinionValue > 0;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     * @param {number} sourceId
     * @param {number} targetId
     */
    run: (gameData, runGameEffect, args, sourceId, targetId) =>{
        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);
        if (!source || !target) return;

        // If the opinion target is an AI and the source is the player, update the in-memory GameData.
        if (target.id !== gameData.playerID && source.id === gameData.playerID) {
            let conversationOpinion = target.getOpinionModifierValue("From conversations");
            if(conversationOpinion < 50){
                target.setOpinionModifierValue("From conversations", conversationOpinion + Number(args[0]));
            }
        }

        // Always run the game effect.
        runGameEffect(
            `global_var:votcce_action_target = {
                add_opinion = {
                    target = global_var:votcce_action_source
                    modifier = conversation_opinion
                    opinion = ${args[0]}
                }
            }`
        )
    },
    chatMessage: (args) =>{
        return {
            en: `{{character2Name}}'s opinion of {{character1Name}} increased by ${args[0]}.`,
            zh: `{{character2Name}}对{{character1Name}}的好感度提高了${args[0]}。`,
            ru: `Мнение {{character2Name}} о {{character1Name}} улучшилось на ${args[0]}.`,
            fr: `L'opinion de {{character2Name}} à l'égard de {{character1Name}} a augmenté de ${args[0]}.`,
            es: `La opinión de {{character2Name}} sobre {{character1Name}} aumentó en ${args[0]}.`,
            de: `Die Meinung von {{character2Name}} über {{character1Name}} hat sich um ${args[0]} verbessert.`,
            ja: `{{character2Name}}の{{character1Name}}に対する評価が${args[0]}上昇しました。`,
            ko: `{{character2Name}}의 {{character1Name}}에 대한 평가가 ${args[0]} 상승했습니다.`,
            pl: `Opinia {{character2Name}} o {{character1Name}} wzrosła o ${args[0]}.`
        }
    },
    chatMessageClass: "positive-action-message"
}
