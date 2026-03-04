//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "emotionPain",
    args: [],
    description: {
        en: `Executed when {{aiName}} feels pain or is hurt.`,
        zh: `当{{aiName}}感到痛苦或受伤时执行。`,
        ru: `Выполняется, когда {{aiName}} чувствует боль или ранен.`,
    fr: `Exécuté lorsque {{aiName}} ressent de la douleur ou est blessé.`,
    es: `Ejecutado cuando {{aiName}} siente dolor o está herido.`,
    de: `Wird ausgeführt, wenn {{aiName}} Schmerzen empfindet oder verletzt ist.`,
    ja: `{{aiName}}が痛みを感じたり、傷ついたときに実行されます。`,
    ko: `{{aiName}}가 고통을 느끼거나 다쳤을 때 실행됩니다.`,
    pl: `Wykonywane, gdy {{aiName}} czuje ból lub jest ranny.`
    },

    /**
     * @param {GameData} gameData 
     */
    check: (conv) =>{
        return true;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
        runGameEffect(
            `set_global_variable = {
				name = talk_pose
				value = flag:pain
            }`
        )
    },
    chatMessage: () =>{
        
    },
    chatMessageClass: null
}

