//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "emotionSad",
    args: [],
    description: {
        en: `Executed when a character feels sad.`,
        zh: `当一个角色感到悲伤时执行。`,
        ru: `Выполняется, когда персонаж чувствует грусть.`,
        fr: `Exécuté lorsqu'un personnage se sent triste.`,
        es: `Ejecutado cuando un personaje se siente triste.`,
        de: `Wird ausgeführt, wenn ein Charakter sich traurig fühlt.`,
        ja: `キャラクターが悲しいと感じたときに実行されます。`,
        ko: `캐릭터가 슬픔을 느낄 때 실행됩니다.`,
        pl: `Wykonywane, gdy postać czuje się smutna.`
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
				value = flag:sad
            }`
        )
    },
    chatMessage: () =>{
        
    },
    chatMessageClass: null
}

