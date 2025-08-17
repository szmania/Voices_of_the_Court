//Made by: MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "intercourseA",
    args: [],
    description: `Execute only after {{aiName}} and {{playerName}} had sexual intercourse. The act can be both consensual or rape.`,

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
        return `you lay with {{aiName}}`
    },
    chatMessageClass: "neutral-action-message"
}