//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "emotionWorry",
    args: [],
    description: {
        en: `Executed when {{aiName}} feels worried.`,
        zh: `当{{aiName}}感到担忧时执行。`,
        ru: `Выполняется, когда {{aiName}} чувствует беспокойство.`,
        fr: `Exécuté lorsque {{aiName}} se sent inquiet.`
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

