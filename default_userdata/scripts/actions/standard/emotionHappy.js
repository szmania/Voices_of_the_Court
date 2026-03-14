//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "emotionHappy",
    args: [],
    description: {
        en: `Executed when a character feels happy.`,
        zh: `当一个角色感到快乐时执行。`,
        ru: `Выполняется, когда персонаж чувствует себя счастливым.`,
        fr: `Exécuté lorsqu'un personnage se sent heureux.`,
        es: `Ejecutado cuando un personaje se siente feliz.`,
        de: `Wird ausgeführt, wenn ein Charakter sich glücklich fühlt.`,
        ja: `キャラクターが幸せを感じたときに実行されます。`,
        ko: `캐릭터가 행복을 느낄 때 실행됩니다.`,
        pl: `Wykonywane, gdy postać czuje się szczęśliwa.`
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
				value = flag:happy
            }`
        )
    },
    chatMessage: () =>{
        
    },
    chatMessageClass: null
}

