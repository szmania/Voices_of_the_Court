//Made by: GitHub Sync

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "aiLeavesConversation",
    args: [],
    description: {
        en: `Executed when {{aiName}} leaves the conversation.`,
        zh: `当{{aiName}}离开对话时执行。`,
        ru: `Выполняется, когда {{aiName}} покидает разговор.`,
        fr: `Exécuté lorsque {{aiName}} quitte la conversation.`,
        es: `Ejecutado cuando {{aiName}} abandona la conversación.`,
        de: `Wird ausgeführt, wenn {{aiName}} das Gespräch verlässt.`,
        ja: `{{aiName}}が会話を離れたときに実行されます。`,
        ko: `{{aiName}}가 대화를 떠날 때 실행됩니다.`,
        pl: `Wykonywane, gdy {{aiName}} opuszcza rozmowę.`
    },

    /**
     * @param {GameData} gameData 
     */
    check: (gameData) => {
        return true;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
        // This action doesn't need a game effect, just ends the conversation
    },
    chatMessage: (args) =>{
        return {
            en: `{{aiName}} left the conversation.`,
            zh: `{{aiName}}离开了对话。`,
            ru: `{{aiName}} покинул разговор.`,
            fr: `{{aiName}} a quitté la conversation.`,
            es: `{{aiName}} abandonó la conversación.`,
            de: `{{aiName}} hat das Gespräch verlassen.`,
            ja: `{{aiName}}は会話を離れました。`,
            ko: `{{aiName}}가 대화를 떠났습니다.`,
            pl: `{{aiName}} opuścił rozmowę.`
        }
    },
    chatMessageClass: "neutral-action-message"
}
