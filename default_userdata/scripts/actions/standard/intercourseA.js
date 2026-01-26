//Made by: MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "intercourseA",
    args: [],
    description: `仅在{{aiName}}和{{playerName}}发生性关系后执行。行为可以是双方自愿的或强奸。`,

    /**
     * @param {GameData} gameData 
     */
    check: (gameData) => {
        return !gameData.getAi().hasTrait("HadSex")
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
    gameData.getAi().addTrait({
        category: "flag",
        name: "HadSex",
        desc: `${gameData.getAi().shortName} had sex recently`
    })
    },
    chatMessage: (args) =>{
        return `你与{{aiName}}性交`
    },
    chatMessageClass: "neutral-action-message"
}