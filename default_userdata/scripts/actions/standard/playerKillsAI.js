//Made by: Sin

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "playerKillsAI",
    args: [],
	
    description: `当{{aiName}}被杀死时执行。`,

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
    run: (gameData, runGameEffect, args) =>{
        runGameEffect(`
			global_var:talk_second_scope = {
				death = {
					death_reason = death_murder killer = root
				}
        }`)
    },
    chatMessage: () => {
        return `{{aiName}}被杀死了。`
    },
    chatMessageClass: "negative-action-message"
}
