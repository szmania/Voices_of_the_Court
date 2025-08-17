//Made by: MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "aiEmployedByPlayer",
    args: [],
    description: `execute when {{aiName}} is not ruler or knight and decided to join {{playerName}}'s court`,

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
    run: (gameData, runGameEffect, args) => {
        runGameEffect(`
            global_var:talk_second_scope = {
				add_to_entourage_court_and_activity_effect = {
					CHAR_TO_ADD = global_var:talk_second_scope
					NEW_COURT_OWNER = global_var:talk_first_scope
				}
			}
        `);
        
    },
    chatMessage: (args) =>{
        return `{{aiName}} joined to your court`
    },
    chatMessageClass: "neutral-action-message"
}