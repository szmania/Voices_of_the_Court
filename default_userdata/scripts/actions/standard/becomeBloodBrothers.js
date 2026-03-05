//Made by: GitHub Sync

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "becomeBloodBrothers",
    args: [
        {
            name: "reason",
            type: "string",
            desc: { 
                en: "the reason (the event) that made them become blood brothers. (write it in past tense).", 
                zh: "让他们成为结义兄弟的原因（事件）。（用过去时书写）",
                ru: "причина (событие), по которой они стали побратимами. (напишите в прошедшем времени).",
                fr: "la raison (l'événement) qui les a fait devenir frères de sang. (écrivez-le au passé).",
                es: "la razón (el evento) que los hizo hermanos de sangre. (escríbalo en tiempo pasado).",
                de: "der Grund (das Ereignis), der sie zu Blutsbrüdern gemacht hat. (schreiben Sie es in der Vergangenheitsform).",
                ja: "彼らが血の盟友になった理由（出来事）。（過去形で書く）。",
                ko: "그들이 결의 형제가 된 이유(사건). (과거 시제로 작성).",
                pl: "powód (wydarzenie), który sprawił, że zostali braćmi krwi. (napisz w czasie przeszłym)."
            }
        }
    ],
    description: {
        en: `Executed when {{playerName}} and {{aiName}} become blood brothers.`,
        zh: `当{{playerName}}和{{aiName}}成为结义兄弟时执行。`,
        ru: `Выполняется, когда {{playerName}} и {{aiName}} становятся побратимами.`,
        fr: `Exécuté lorsque {{playerName}} et {{aiName}} deviennent frères de sang.`,
        es: `Ejecutado cuando {{playerName}} y {{aiName}} se convierten en hermanos de sangre.`,
        de: `Wird ausgeführt, wenn {{playerName}} und {{aiName}} zu Blutsbrüdern werden.`,
        ja: `{{playerName}}と{{aiName}}が血の盟友になったときに実行されます。`,
        ko: `{{playerName}}와 {{aiName}}가 결의 형제가 될 때 실행됩니다.`,
        pl: `Wykonywane, gdy {{playerName}} i {{aiName}} stają się braćmi krwi.`
    },

    /**
     * @param {GameData} gameData 
     */
    check: (gameData) => {
        let ai = gameData.getAi();
        return !ai.relationsToPlayer.includes("Blood Brother") && 
               ai.getOpinionModifierValue("From conversations") > 60 &&
               ai.opinionOfPlayer > 70;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
        runGameEffect(`global_var:talk_second_scope = {
            set_relation_blood_brother = { reason = ${args[0]} target = global_var:talk_first_scope }
        }`);

        // Remove any hostile relations
        let ai = gameData.getAi();
        let rivalIndex = ai.relationsToPlayer.indexOf("Rival");
        if (rivalIndex !== -1) {
            ai.relationsToPlayer.splice(rivalIndex, 1);
        }
        
        ai.relationsToPlayer.push("Blood Brother");
    },
    chatMessage: (args) =>{
        return {
            en: `{{aiName}} became your blood brother.`,
            zh: `{{aiName}}成为了你的结义兄弟。`,
            ru: `{{aiName}} стал вашим побратимом.`,
            fr: `{{aiName}} est devenu votre frère de sang.`,
            es: `{{aiName}} se convirtió en tu hermano de sangre.`,
            de: `{{aiName}} ist dein Blutsbruder geworden.`,
            ja: `{{aiName}}はあなたの血の盟友になりました。`,
            ko: `{{aiName}}가 당신의 결의 형제가 되었습니다.`,
            pl: `{{aiName}} stał się twoim bratem krwi.`
        }
    },
    chatMessageClass: "positive-action-message"
}
