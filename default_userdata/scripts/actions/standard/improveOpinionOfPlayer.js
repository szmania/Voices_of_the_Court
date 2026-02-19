//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "improveOpinionOfPlayer",
    args: [ 
        {
            name: "opinion",
            type: "number",
            desc: "the number of opinion values the relation improves with. Can be between 1 and 5."
        }
    ],
    description: {
        en: `Executed when {{playerName}}'s last dialogue or action significantly improves {{aiName}}'s opinion of them.`,
        zh: `当{{playerName}}的最后一次对话或行动极大地改善了{{aiName}}对{{playerName}}的看法时执行。`,
        ru: `Выполняется, когда последний диалог или действие {{playerName}} значительно улучшает мнение {{aiName}} о нем.`,
        fr: `Exécuté lorsque le dernier dialogue ou la dernière action de {{playerName}} améliore considérablement l'opinion que {{aiName}} a de lui.`
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
                `global_var:talk_second_scope = {
                    add_opinion = {
                        target = global_var:talk_first_scope
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
            fr: `L'opinion de {{aiName}} à votre égard a augmenté de ${args[0]}.`
        }
    },
    chatMessageClass: "positive-action-message"
}
