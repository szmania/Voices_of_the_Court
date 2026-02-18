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
        
        // Check if conversation has had at least 2 exchanges
        // This prevents immediate opinion changes
        // Note: This is a simplified check - actual message count would need to be tracked elsewhere
        // For now, we'll use a basic check based on opinion modifier value
        const conversationOpinion = ai.getOpinionModifierValue("From conversations");
        
        // Only allow opinion improvement if conversation opinion is moderately positive (between 10 and 40)
        // This prevents excessive triggering at both low and high values
        if (conversationOpinion < 10 || conversationOpinion > 40) {
            return false;
        }
        
        // Add some randomness to prevent every eligible conversation from triggering
        // 70% chance when conditions are met
        return Math.random() < 0.7;
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
