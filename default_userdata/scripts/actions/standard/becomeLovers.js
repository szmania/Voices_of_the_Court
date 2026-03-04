//Made by: joemann, adjusted by MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "becomeLovers",
    args: [
        {
            name: "reason",
            type: "string",
            desc: { 
                en: "the reason (the event) that made them become lovers of each other. (write it in past tense).",
                zh: "让他们成为恋人的原因（事件）。（用过去时书写）",
                ru: "причина (событие), по которой они стали любовниками. (напишите в прошедшем времени).",
                fr: "la raison (l'événement) qui les a fait devenir amants. (écrivez-le au passé).",
                es: "la razón (el evento) que los hizo amantes. (escríbalo en tiempo pasado).",
                de: "der Grund (das Ereignis), der sie zu Liebhabern gemacht hat. (schreiben Sie es in der Vergangenheitsform).",
                ja: "彼らが恋人同士になった理由（出来事）。（過去形で書く）。",
                ko: "그들이 연인이 된 이유(사건). (과거 시제로 작성).",
                pl: "powód (wydarzenie), który sprawił, że zostali kochankami. (napisz w czasie przeszłym)."
            }
        }
    ],
    description: {
        en: `Executed when {{playerName}} and {{aiName}} become lovers after a sexual encounter.`,
        zh: `当{{playerName}}和{{aiName}}发生良好、出色或惊人的性关系并成为恋人时执行。`,
        ru: `Выполняется, когда {{playerName}} и {{aiName}} становятся любовниками после сексуальной связи.`,
        fr: `Exécuté lorsque {{playerName}} et {{aiName}} deviennent amants après une relation sexuelle.`,
        es: `Ejecutado cuando {{playerName}} y {{aiName}} se convierten en amantes después de un encuentro sexual.`,
        de: `Wird ausgeführt, wenn {{playerName}} und {{aiName}} nach einer sexuellen Begegnung zu Liebhabern werden.`,
        ja: `{{playerName}}と{{aiName}}が性的な出会いの後に恋人同士になったときに実行されます。`,
        ko: `{{playerName}}와 {{aiName}}가 성적인 만남 후에 연인이 될 때 실행됩니다.`,
        pl: `Wykonywane, gdy {{playerName}} i {{aiName}} stają się kochankami po stosunku seksualnym.`
    },

    /**
     * @param {GameData} gameData 
     */
    check: (gameData) => {
        let ai = gameData.getAi();
        return !(ai.relationsToPlayer.includes("Lover")) && ai.getOpinionModifierValue("From conversations") > 25 && ai.opinionOfPlayer > 65
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
        console.log(args[0])
        runGameEffect(`global_var:talk_second_scope = {
            set_relation_lover = { reason = ${args[0]} target = global_var:talk_first_scope }
        }`)
		gameData.getAi().addTrait({
        category: "flag",
        name: "AlreadyLover",
        desc: `${gameData.getAi().shortName} already lover`
		})
		gameData.getAi().relationsToPlayer.push("Lover");
    },
    chatMessage: (args) =>{
        return {
            en: `{{aiName}} became your lover.`,
            zh: `{{aiName}}成为了你的恋人。`,
            ru: `{{aiName}} стал вашим любовником.`,
            fr: `{{aiName}} est devenu votre amant.`,
            es: `{{aiName}} se convirtió en tu amante.`,
            de: `{{aiName}} ist dein Liebhaber geworden.`,
            ja: `{{aiName}}はあなたの恋人になりました。`,
            ko: `{{aiName}}가 당신의 연인이 되었습니다.`,
            pl: `{{aiName}} stał się twoim kochankiem.`
        }
    },
    chatMessageClass: "positive-action-message"
}
