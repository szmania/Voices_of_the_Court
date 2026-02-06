//Made by: Sin

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "playerKillsAI",
    args: [],
	
    description: {
        en: `Executed when {{aiName}} is killed by {{playerName}}.`,
        zh: `当{{aiName}}被杀死时执行。`,
        ru: `Выполняется, когда {{aiName}} убит {{playerName}}.`,
        fr: `Exécuté lorsque {{aiName}} est tué par {{playerName}}.`
    },

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
        return {
            en: `{{aiName}} was killed.`,
            zh: `{{aiName}}被杀死了。`,
            ru: `{{aiName}} был убит.`,
            fr: `{{aiName}} a été tué.`
        };
    },
    chatMessageClass: "negative-action-message"
}
