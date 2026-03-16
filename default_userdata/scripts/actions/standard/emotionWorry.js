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
        runGameEffect(
            `global_var:votcce_action_target = {
                set_global_variable = {
                    name = talk_pose
                    value = flag:worry
                }
            }`
        )
    },
    chatMessage: () =>{
        return {
            en: `{{character2Name}} feels worried.`,
            zh: `{{character2Name}}感到担忧。`,
            ru: `{{character2Name}} беспокоится.`,
            fr: `{{character2Name}} est inquiet.`,
            es: `{{character2Name}} está preocupado.`,
            de: `{{character2Name}} ist besorgt.`,
            ja: `{{character2Name}}は心配しています。`,
            ko: `{{character2Name}}는 걱정합니다.`,
            pl: `{{character2Name}} jest zmartwiony.`
        }
    },
    chatMessageClass: "neutral-action-message"
}

