//Made by: MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "aiEmployedByPlayer",
    args: [],
    description: `当{{aiName}}不是统治者或勇士，并决定加入{{playerName}}的宫廷时执行`,

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
        return `{{aiName}}加入了你的宫廷`
    },
    chatMessageClass: "neutral-action-message"
}