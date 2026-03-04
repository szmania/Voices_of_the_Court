//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "emotionWorry",
    args: [],
    description: {
        en: `Executed when {{aiName}} feels worried.`,
        zh: `当{{aiName}}感到担忧时执行。`,
        ru: `Выполняется, когда {{aiName}} чувствует беспокойство.`,
        fr: `Exécuté lorsque {{aiName}} se sent inquiet.`,
        es: `Ejecutado cuando {{aiName}} se siente preocupado.`,
        de: `Wird ausgeführt, wenn {{aiName}} sich besorgt fühlt.`,
        ja: `{{aiName}}が心配していると感じたときに実行されます。`,
        ko: `{{aiName}}가 걱정을 느낄 때 실행됩니다.`,
        pl: `Wykonywane, gdy {{aiName}} czuje się zaniepokojony.`
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
				value = flag:worry
            }`
        )
    },
    chatMessage: () =>{
        
    },
    chatMessageClass: null
}

