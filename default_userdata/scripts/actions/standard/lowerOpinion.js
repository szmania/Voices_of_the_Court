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
        en: `Executed when one character's opinion of another is lowered. The source (character1) is the character whose actions are being judged. The target (character2) is the character whose opinion is LOWERING.`,
        zh: `当一个角色的对话或行动显著降低另一个角色对他们的看法时执行。`,
        ru: `Выполняется, когда диалог или действие одного персонажа значительно ухудшает мнение другого о нем.`,
        fr: `Exécuté lorsque le dialogue ou l'action d'un personnage diminue considérablement l'opinion qu'un autre a de lui.`,
        es: `Ejecutado cuando el diálogo o la acción de un personaje disminuye significativamente la opinión que otro tiene de él.`,
        de: `Wird ausgeführt, wenn der Dialog oder die Handlung eines Charakters die Meinung eines другого über ihn erheblich verschlechtert.`,
        ja: `あるキャラクターの対話または行動が、別のキャラクターの彼らに対する評価を大幅に低下させたときに実行されます。`,
        ko: `한 캐릭터의 대화나 행동이 다른 캐릭터의 그들에 대한 평가를 크게 낮출 때 실행됩니다.`,
        pl: `Wykonywane, gdy dialog lub działanie jednej postaci znacząco obniża opinię drugiej o niej.`
    },

    /**
     * @param {GameData} gameData 
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) =>{
        return true;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     * @param {number} sourceId
     * @param {number} targetId
     */
    run: (gameData, runGameEffect, args, sourceId, targetId) => {
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
