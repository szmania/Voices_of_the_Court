//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "intercourse",
    args: [],
    description: `当{{aiName}}和{{playerName}}发生性关系时执行，仅在性关系结束后执行。行为可以是双方自愿的或强奸。`,

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
        global_var:talk_first_scope = {
            had_sex_with_effect = {
				CHARACTER = global_var:talk_second_scope
				PREGNANCY_CHANCE = pregnancy_chance
			}
        }
    `);
    },
    chatMessage: (args) =>{
        return `你与{{aiName}}性交`
    },
    chatMessageClass: "neutral-action-message"
}