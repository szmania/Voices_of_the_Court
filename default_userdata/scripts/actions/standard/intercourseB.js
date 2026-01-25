//Made by: MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

module.exports = {
    signature: "intercourseB",
    args: [],
    description: `仅在除了{{playerName}}之外的{{character1Name}}和{{character2Name}}两人发生性关系后执行。行为可以是双方自愿的或强奸。`,

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
            had_sex_with_effect = {
				CHARACTER = global_var:talk_third_scope
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
    /**
     * @param {string[]} args 
     */
    chatMessage: (args) =>{      
        // 返回包含两个角色名称的消息字符串
        // 使用{{character1Name}}和{{character2Name}}变量，它们将在parseVariables中被替换为实际角色名称
        return `{{character1Name}}和{{character2Name}}共赴巫山`
    },
    chatMessageClass: "neutral-action-message"
}