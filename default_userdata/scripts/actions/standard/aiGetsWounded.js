//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "woundCharacter",
    args: [],
    description: {
        en: `Executed when a character is seriously wounded.`,
        zh: `当一个角色受重伤时执行。`,
        ru: `Выполняется, когда персонаж получает серьезное ранение.`,
        fr: `Exécuté lorsqu'un personnage est gravement blessé.`,
        es: `Ejecutado cuando un personaje está gravemente herido.`,
        de: `Wird ausgeführt, wenn ein Charakter schwer verwundet ist.`,
        ja: `キャラクターが重傷を負ったときに実行されます。`,
        ko: `캐릭터가 중상을 입었을 때 실행됩니다.`,
        pl: `Wykonywane, gdy postać jest ciężko ranna.`
    },
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
            `global_var:votcce_action_target = {
                add_trait = wounded_1
            }`
        )
        gameData.getAi().addTrait({
            category: "health",
            name: "Wounded",
            desc: `${gameData.getAi().shortName} is wounded`    
        })
    },
    chatMessage: () => {
        return {
            en: `{{aiName}} is wounded!`,
            zh: `{{aiName}}受伤了！`,
            ru: `{{aiName}} ранен!`,
            fr: `{{aiName}} est blessé !`,
            es: `¡{{aiName}} está herido!`,
            de: `{{aiName}} ist verwundet!`,
            ja: `{{aiName}}が負傷しました！`,
            ko: `{{aiName}}가 부상당했습니다!`,
            pl: `{{aiName}} jest ranny!`
        }
    },
    chatMessageClass: "negative-action-message"
}
