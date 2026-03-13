//Made by: Durond

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
        en: `Executed when one character's dialogue or action significantly improves another's opinion of them.`,
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
     */
    check: (gameData) =>{
        // Only trigger if there's meaningful conversation context
        // Check if conversation has progressed beyond initial greetings
        const ai = gameData.getAi();
        const player = gameData.getPlayer();
        
        // Check if AI has positive opinion of player (opinion > 0)
        // This prevents improving opinion when AI already dislikes player
        if (ai.opinionOfPlayer <= 0) {
            return false;
        }
        
        // Check if conversation has had meaningful positive interaction
        // Conversation opinion should be moderately positive (between 15 and 45)
        // This prevents triggering at both very low and very high values
        const conversationOpinion = ai.getOpinionModifierValue("From conversations");
        
        if (conversationOpinion < 15 || conversationOpinion > 45) {
            return false;
        }
        
        // Check if this would be 4th consecutive action
        // We need to track this in conversation context - for now, we'll be conservative
        // and only allow if conversation opinion shows steady improvement
        const opinionChange = conversationOpinion - (ai.previousConversationOpinion || 0);
        
        // Only trigger if there's been meaningful opinion improvement in this conversation
        // (at least 5 points of positive change from conversation)
        return opinionChange >= 5;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) =>{
        let ai = gameData.getAi();
        let conversationOpinion = ai.getOpinionModifierValue("From conversations");
        if(conversationOpinion < 50){
            ai.setOpinionModifierValue("From conversations", conversationOpinion + args[0]);

            runGameEffect(
                `global_var:votcce_action_target = {
                    add_opinion = {
                        target = global_var:votcce_action_source
                        modifier = conversation_opinion
                        opinion = ${args[0]}
                    }
                }`
            )
        }
    },
    chatMessage: (args) =>{
        return {
            en: `{{aiName}}'s opinion of you increased by ${args[0]}.`,
            zh: `{{aiName}}对你的好感度提高了${args[0]}。`,
            ru: `Мнение {{aiName}} о вас улучшилось на ${args[0]}.`,
            fr: `L'opinion de {{aiName}} à votre égard a augmenté de ${args[0]}.`,
            es: `La opinión de {{aiName}} sobre ti aumentó en ${args[0]}.`,
            de: `Die Meinung von {{aiName}} über dich hat sich um ${args[0]} verbessert.`,
            ja: `{{aiName}}のあなたに対する評価が${args[0]}上昇しました。`,
            ko: `{{aiName}}의 당신에 대한 평가가 ${args[0]} 상승했습니다.`,
            pl: `Opinia {{aiName}} o tobie wzrosła o ${args[0]}.`
        }
    },
    chatMessageClass: "positive-action-message"
}
