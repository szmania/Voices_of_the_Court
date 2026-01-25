//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "emotionSad",
    args: [],
    description: `当{{aiName}}感到悲伤时执行。`,

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

