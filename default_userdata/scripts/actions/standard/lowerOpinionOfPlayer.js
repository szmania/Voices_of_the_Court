//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "lowerOpinionOfPlayer",
    args: [ 
        {
            name: "opinion",
            type: "number",
            desc: "the number of opinion values the relation decreases with. Can be between 1 and 5."
        }
    ],
    description: {
        en: `Executed when {{playerName}}'s last dialogue or action significantly lowers {{aiName}}'s opinion of them.`,
        zh: `当{{playerName}}的最后一次对话或行动极大地降低了{{aiName}}对{{playerName}}的看法时执行。`,
        ru: `Выполняется, когда последний диалог или действие {{playerName}} значительно ухудшает мнение {{aiName}} о нем.`,
    fr: `Exécuté lorsque le dernier dialogue ou la dernière action de {{playerName}} diminue considérablement l'opinion que {{aiName}} a de lui.`,
    es: `Ejecutado cuando el último diálogo o acción de {{playerName}} disminuye significativamente la opinión que {{aiName}} tiene de él.`,
    de: `Wird ausgeführt, wenn der letzte Dialog oder die letzte Aktion von {{playerName}} die Meinung, die {{aiName}} von ihm hat, erheblich verschlechtert.`,
    ja: `{{playerName}}の最後の対話または行動が{{aiName}}の彼に対する評価を大幅に低下させたときに実行されます。`,
    ko: `{{playerName}}의 마지막 대화나 행동이 {{aiName}}의 그에 대한 평가를 크게 낮출 때 실행됩니다.`,
    pl: `Wykonywane, gdy ostatni dialog lub działanie {{playerName}} znacząco obniża opinię, jaką {{aiName}} o nim ma.`
    },

    /**
     * @param {GameData} gameData 
     */
    check: (gameData) =>{
        return true;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
       let ai = gameData.getAi();
        let conversationOpinion = ai.getOpinionModifierValue("From conversations");
        if(conversationOpinion > -50){
            ai.setOpinionModifierValue("From conversations", conversationOpinion - args[0]);

            runGameEffect(
                `global_var:talk_second_scope = {
                    add_opinion = {
                        target = global_var:talk_first_scope
                        modifier = conversation_opinion
                        opinion = -${args[0]}
                    }
                }`
            )
        }
    },
    chatMessage: (args) =>{
        return {
            en: `{{aiName}}'s opinion of you decreased by ${args[0]}.`,
            zh: `{{aiName}}对你的好感度降低了${args[0]}。`,
            ru: `Мнение {{aiName}} о вас ухудшилось на ${args[0]}.`,
    fr: `L'opinion de {{aiName}} à votre égard a diminué de ${args[0]}.`,
    es: `La opinión de {{aiName}} sobre ti disminuyó en ${args[0]}.`,
    de: `Die Meinung von {{aiName}} über dich hat sich um ${args[0]} verschlechtert.`,
    ja: `{{aiName}}のあなたに対する評価が${args[0]}低下しました。`,
    ko: `{{aiName}}의 당신에 대한 평가가 ${args[0]} 하락했습니다.`,
    pl: `Opinia {{aiName}} o tobie spadła o ${args[0]}.`
        }
    },
    chatMessageClass: "negative-action-message"
}
