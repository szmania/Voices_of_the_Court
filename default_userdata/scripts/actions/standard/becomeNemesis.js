//Made by: GitHub Sync

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "becomeNemesis",
    args: [
        {
            name: "reason",
            type: "string",
            desc: "the reason (the event) that made them become nemesis of each other. (write it in past tense)."
        }
    ],
    description: {
        en: `Executed when {{playerName}} and {{aiName}} become nemesis.`,
        zh: `当{{playerName}}和{{aiName}}成为彼此的宿敌时执行。`,
        ru: `Выполняется, когда {{playerName}} и {{aiName}} становятся заклятыми врагами.`,
        fr: `Exécuté lorsque {{playerName}} et {{aiName}} deviennent ennemis jurés.`,
        es: `Ejecutado cuando {{playerName}} y {{aiName}} se convierten en némesis.`,
        de: `Wird ausgeführt, wenn {{playerName}} und {{aiName}} zu Erzfeinden werden.`,
        ja: `{{playerName}}と{{aiName}}が宿敵になったときに実行されます。`,
        ko: `{{playerName}}와 {{aiName}}가 천적이 될 때 실행됩니다.`,
        pl: `Wykonywane, gdy {{playerName}} i {{aiName}} stają się śmiertelnymi wrogami.`
    },

    /**
     * @param {GameData} gameData 
     */
    check: (gameData) => {
        let ai = gameData.getAi();
        return !ai.relationsToPlayer.includes("Nemesis") && 
               ai.relationsToPlayer.includes("Rival") &&
               ai.opinionOfPlayer < -30 &&
               ai.getOpinionModifierValue("From conversations") < -20;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
        runGameEffect(`global_var:talk_second_scope = {
            set_relation_nemesis = { reason = ${args[0]} target = global_var:talk_first_scope }
        }`);

        // Remove Rival relation and add Nemesis
        let ai = gameData.getAi();
        let rivalIndex = ai.relationsToPlayer.indexOf("Rival");
        if (rivalIndex !== -1) {
            ai.relationsToPlayer.splice(rivalIndex, 1);
        }
        ai.relationsToPlayer.push("Nemesis");
    },
    chatMessage: (args) =>{
        return {
            en: `{{aiName}} became your nemesis.`,
            zh: `{{aiName}}成为了你的宿敌。`,
            ru: `{{aiName}} стал вашим заклятым врагом.`,
            fr: `{{aiName}} est devenu votre ennemi juré.`,
            es: `{{aiName}} se convirtió en tu némesis.`,
            de: `{{aiName}} ist dein Erzfeind geworden.`,
            ja: `{{aiName}}はあなたの宿敵になりました。`,
            ko: `{{aiName}}가 당신의 천적이 되었습니다.`,
            pl: `{{aiName}} stał się twoim śmiertelnym wrogiem.`
        }
    },
    chatMessageClass: "negative-action-message"
}
