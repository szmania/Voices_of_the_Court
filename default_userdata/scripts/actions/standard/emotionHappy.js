//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "emotionHappy",
    args: [],
    description: {
        en: `Executed when {{aiName}} feels happy.`,
        zh: `当{{aiName}}感到快乐时执行。`,
        ru: `Выполняется, когда {{aiName}} чувствует себя счастливым.`,
        fr: `Exécuté lorsque {{aiName}} se sent heureux.`,
        es: `Ejecutado cuando {{aiName}} se siente feliz.`,
        de: `Wird ausgeführt, wenn {{aiName}} sich glücklich fühlt.`,
        ja: `{{aiName}}が幸せを感じたときに実行されます。`,
        ko: `{{aiName}}가 행복을 느낄 때 실행됩니다.`,
        pl: `Wykonywane, gdy {{aiName}} czuje się szczęśliwy.`
    },

    /**
     * @param {GameData} gameData 
     */
    check: (gameData) =>{
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
				value = flag:happy
            }`
        )
    },
    chatMessage: () =>{
        
    },
    chatMessageClass: null
}

