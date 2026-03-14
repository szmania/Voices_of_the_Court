//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "emotionWorry",
    args: [],
    description: {
        en: `Executed when a character feels worried.`,
        zh: `当一个角色感到担忧时执行。`,
        ru: `Выполняется, когда персонаж чувствует беспокойство.`,
        fr: `Exécuté lorsqu'un personnage se sent inquiet.`,
        es: `Ejecutado cuando un personaje se siente preocupado.`,
        de: `Wird ausgeführt, wenn ein Charakter sich besorgt fühlt.`,
        ja: `キャラクターが心配していると感じたときに実行されます。`,
        ko: `캐릭터가 걱정을 느낄 때 실행됩니다.`,
        pl: `Wykonywane, gdy postać czuje się zaniepokojona.`
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
        runGameEffect(
            `set_global_variable = {
				name = talk_pose
				value = flag:worry
            }`
        )
    },
    chatMessage: () =>{
        return {
            en: `{{character1Name}} feels worried.`,
            zh: `{{character1Name}}感到担忧。`,
            ru: `{{character1Name}} беспокоится.`,
            fr: `{{character1Name}} est inquiet.`,
            es: `{{character1Name}} está preocupado.`,
            de: `{{character1Name}} ist besorgt.`,
            ja: `{{character1Name}}は心配しています。`,
            ko: `{{character1Name}}는 걱정합니다.`,
            pl: `{{character1Name}} jest zmartwiony.`
        }
    },
    chatMessageClass: "neutral-action-message"
}

