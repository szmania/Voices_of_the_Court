//Made by: MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

module.exports = {
    signature: "intercourseB",
    args: [],
    description: {
        en: `Executed after two characters (other than {{playerName}}) have sexual intercourse. Can be consensual or forced.`,
        zh: `仅在除了{{playerName}}之外的{{character1Name}}和{{character2Name}}两人发生性关系后执行。行为可以是双方自愿的或强奸。`,
        ru: `Выполняется после того, как два персонажа (кроме {{playerName}}) вступают в половую связь. Может быть по обоюдному согласию или принудительно.`,
        fr: `Exécuté après que deux personnages (autres que {{playerName}}) ont eu des rapports sexuels. Peut être consensuel ou forcé.`
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
        return {
            en: `{{character1Name}} and {{character2Name}} had intercourse.`,
            zh: `{{character1Name}}和{{character2Name}}共赴巫山`,
            ru: `{{character1Name}} и {{character2Name}} вступили в половую связь.`,
            fr: `{{character1Name}} et {{character2Name}} ont eu des rapports sexuels.`
        }
    },
    chatMessageClass: "neutral-action-message"
}
