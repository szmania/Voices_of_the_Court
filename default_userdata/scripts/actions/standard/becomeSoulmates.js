//Made by: joemann, adjusted by MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "becomeSoulmates",
    args: [
        {
            name: "reason",
            type: "string",
            desc: { 
                en: "the reason (the event) that made them become passionate soulmates of eachother. (write it in past tense).",
                zh: "让他们成为激情灵魂伴侣的原因（事件）。（用过去时书写）",
                ru: "причина (событие), по которой они стали страстными родственными душами. (напишите в прошедшем времени).",
                fr: "la raison (l'événement) qui les a fait devenir des âmes sœurs passionnées. (écrivez-le au passé).",
                es: "la razón (el evento) que los hizo almas gemelas apasionadas. (escríbalo en tiempo pasado).",
                de: "der Grund (das Ereignis), der sie zu leidenschaftlichen Seelenverwandten gemacht hat. (schreiben Sie es in der Vergangenheitsform).",
                ja: "彼らが情熱的な魂の伴侶になった理由（出来事）。（過去形で書く）。",
                ko: "그들이 열정적인 영혼의 동반자가 된 이유(사건). (과거 시제로 작성).",
                pl: "powód (wydarzenie), który sprawił, że zostali namiętnymi bratnimi duszami. (napisz w czasie przeszłym)."
            }
        }
    ],
    description: {
        en: `Executed when {{playerName}} and {{aiName}} become passionate soulmates.`,
        zh: `当{{playerName}}和{{aiName}}成为彼此的激情灵魂伴侣时执行。`,
        ru: `Выполняется, когда {{playerName}} и {{aiName}} становятся страстными родственными душами.`,
        fr: `Exécuté lorsque {{playerName}} et {{aiName}} deviennent des âmes sœurs passionnées.`,
        es: `Ejecutado cuando {{playerName}} y {{aiName}} se convierten en almas gemelas apasionadas.`,
        de: `Wird ausgeführt, wenn {{playerName}} und {{aiName}} zu leidenschaftlichen Seelenverwandten werden.`,
        ja: `{{playerName}}と{{aiName}}が情熱的な魂の伴侶になったときに実行されます。`,
        ko: `{{playerName}}와 {{aiName}}가 열정적인 영혼의 동반자가 될 때 실행됩니다.`,
        pl: `Wykonywane, gdy {{playerName}} i {{aiName}} stają się namiętnymi bratnimi duszami.`
    },

    /**
     * @param {GameData} gameData 
     */
    check: (gameData) => {
        let ai = gameData.getAi();
		return !(ai.relationsToPlayer.includes("Soulmate")) && ai.opinionOfPlayer > 40 && ai.getOpinionModifierValue("From conversations") > 35
				
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
        console.log(args[0])
        let ai = gameData.getAi();
        runGameEffect(`global_var:talk_second_scope = {
            set_relation_soulmate = { reason = ${args[0]} target = global_var:talk_first_scope }
        }`)
		ai.addTrait({
        category: "flag",
        name: "AlreadySoulmate",
        desc: `${gameData.getAi().shortName} had sex recently`
		})
		gameData.getAi().relationsToPlayer.push("Soulmate");
    },
    chatMessage: (args) =>{
        return {
            en: `{{aiName}} became your soulmate.`,
            zh: `{{aiName}}成为了你的灵魂伴侣。`,
            ru: `{{aiName}} стал вашей родственной душой.`,
            fr: `{{aiName}} est devenu votre âme sœur.`,
            es: `{{aiName}} se convirtió en tu alma gemela.`,
            de: `{{aiName}} ist dein Seelenverwandter geworden.`,
            ja: `{{aiName}}はあなたの魂の伴侶になりました。`,
            ko: `{{aiName}}가 당신의 영혼의 동반자가 되었습니다.`,
            pl: `{{aiName}} stał się twoją bratnią duszą.`
        }
    },
    chatMessageClass: "positive-action-message"
}
