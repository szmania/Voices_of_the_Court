//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "lowerOpinion",
    args: [ 
        {
            name: "opinion",
            type: "number",
            min: 1,
            max: 5,
            desc: { 
                en: "the number of opinion values the relation decreases with.",
                zh: "关系减少的意见值数量。",
                ru: "количество значений мнения, на которое ухудшаются отношения.",
                fr: "le nombre de valeurs d'opinion par lesquelles la relation diminue.",
                es: "el número de valores de opinión con los que disminuye la relación.",
                de: "die Anzahl der Meinungswerte, um die sich die Beziehung verschlechtert.",
                ja: "関係が減少する意見値の数。",
                ko: "관계가 감소하는 평가 값의 수.",
                pl: "liczba wartości opinii, o które pogarsza się relacja."
            }
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
     * @param {number} initiatorId
     * @param {number} targetId
     */
    check: (gameData, initiatorId, targetId) =>{
        return true;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     * @param {number} initiatorId
     * @param {number} targetId
     */
    run: (gameData, runGameEffect, args, initiatorId, targetId) => {
        const target = gameData.getCharacterById(targetId);
        if (!target) return;

        // Only modify opinion if the target is an AI character
        if (target.id !== gameData.playerID) {
            let conversationOpinion = target.getOpinionModifierValue("From conversations");
            if(conversationOpinion > -50){
                target.setOpinionModifierValue("From conversations", conversationOpinion - Number(args[0]));
            }
        }

        runGameEffect(
            `global_var:votcce_action_target = {
                add_opinion = {
                    target = global_var:votcce_action_source
                    modifier = conversation_opinion
                    opinion = -${args[0]}
                }
            }`
        )
    },
    chatMessage: (args) =>{
        return {
            en: `{{character2Name}}'s opinion of {{character1Name}} decreased by ${args[0]}.`,
            zh: `{{character2Name}}对{{character1Name}}的好感度降低了${args[0]}。`,
            ru: `Мнение {{character2Name}} о {{character1Name}} ухудшилось на ${args[0]}.`,
            fr: `L'opinion de {{character2Name}} à l'égard de {{character1Name}} a diminué de ${args[0]}.`,
            es: `La opinión de {{character2Name}} sobre {{character1Name}} disminuyó en ${args[0]}.`,
            de: `Die Meinung von {{character2Name}} über {{character1Name}} hat sich um ${args[0]} verschlechtert.`,
            ja: `{{character2Name}}の{{character1Name}}に対する評価が${args[0]}低下しました。`,
            ko: `{{character2Name}}의 {{character1Name}}에 대한 평가가 ${args[0]} 하락했습니다.`,
            pl: `Opinia {{character2Name}} o {{character1Name}} spadła o ${args[0]}.`
        }
    },
    chatMessageClass: "negative-action-message"
}
