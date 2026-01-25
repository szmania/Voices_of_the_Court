//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "aiGetsWounded",
    args: [],
    description: `当{{aiName}}受重伤时执行。`,
    creator: "Durond",
    /**
     * @param {GameData} gameData 
     */
    check: (gameData) =>{
        return !gameData.getAi().hasTrait("wounded");
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
        runGameEffect(
            `global_var:talk_second_scope = {
                add_trait = wounded_1
            }`
        )
        gameData.getAi().addTrait({
            category: "health",
            name: "Wounded",
            desc: `${gameData.getAi().shortName} is wounded`    
        })
    },
    chatMessage: () =>{
        return `{{aiName}}受伤了！`
    },
    chatMessageClass: "negative-action-message"
}