//Made by: GitHub Sync

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "becomeBestFriends",
    args: [
        {
            name: "reason",
            type: "string",
            desc: "the reason (the event) that made them become best friends. (write it in past tense)."
        }
    ],
    description: {
        en: `Executed when {{playerName}} and {{aiName}} become best friends.`,
        zh: `当{{playerName}}和{{aiName}}成为最好的朋友时执行。`,
        ru: `Выполняется, когда {{playerName}} и {{aiName}} становятся лучшими друзьями.`,
        fr: `Exécuté lorsque {{playerName}} et {{aiName}} deviennent meilleurs amis.`,
        es: `Ejecutado cuando {{playerName}} y {{aiName}} se convierten en mejores amigos.`,
        de: `Wird ausgeführt, wenn {{playerName}} und {{aiName}} zu besten Freunden werden.`,
        ja: `{{playerName}}と{{aiName}}が親友になったときに実行されます。`,
        ko: `{{playerName}}와 {{aiName}}가 가장 친한 친구가 될 때 실행됩니다.`,
        pl: `Wykonywane, gdy {{playerName}} i {{aiName}} stają się najlepszymi przyjaciółmi.`
    },

    /**
     * @param {GameData} gameData 
     */
    check: (gameData) => {
        let ai = gameData.getAi();
        return !ai.relationsToPlayer.includes("Best Friend") && 
               ai.relationsToPlayer.includes("Friend") &&
               ai.getOpinionModifierValue("From conversations") > 50 &&
               ai.opinionOfPlayer > 50;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
        runGameEffect(`global_var:talk_second_scope = {
            set_relation_best_friend = { reason = ${args[0]} target = global_var:talk_first_scope }
        }`);

        // Remove Friend relation and add Best Friend
        let ai = gameData.getAi();
        let friendIndex = ai.relationsToPlayer.indexOf("Friend");
        if (friendIndex !== -1) {
            ai.relationsToPlayer.splice(friendIndex, 1);
        }
        ai.relationsToPlayer.push("Best Friend");
    },
    chatMessage: (args) =>{
        return {
            en: `{{aiName}} became your best friend.`,
            zh: `{{aiName}}成为了你最好的朋友。`,
            ru: `{{aiName}} стал вашим лучшим другом.`,
            fr: `{{aiName}} est devenu votre meilleur ami.`,
            es: `{{aiName}} se convirtió en tu mejor amigo.`,
            de: `{{aiName}} ist dein bester Freund geworden.`,
            ja: `{{aiName}}はあなたの親友になりました。`,
            ko: `{{aiName}}가 당신의 가장 친한 친구가 되었습니다.`,
            pl: `{{aiName}} stał się twoim najlepszym przyjacielem.`
        }
    },
    chatMessageClass: "positive-action-message"
}
