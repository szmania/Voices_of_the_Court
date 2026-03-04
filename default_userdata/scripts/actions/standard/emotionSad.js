//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "emotionSad",
    args: [],
    description: {
        en: `Executed when {{aiName}} feels sad.`,
        zh: `当{{aiName}}感到悲伤时执行。`,
        ru: `Выполняется, когда {{aiName}} чувствует грусть.`,
    fr: `Exécuté lorsque {{aiName}} se sent triste.`,
    es: `Ejecutado cuando {{aiName}} se siente triste.`,
    de: `Wird ausgeführt, wenn {{aiName}} sich traurig fühlt.`,
    ja: `{{aiName}}が悲しいと感じたときに実行されます。`,
    ko: `{{aiName}}가 슬픔을 느낄 때 실행됩니다.`,
    pl: `Wykonywane, gdy {{aiName}} czuje się smutny.`
    },

    /**
     * @param {GameData} gameData 
     */
    check: (conv) =>{
        return true;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
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

