//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "emotionPain",
    args: [],
    description: {
        en: `Executed when a character feels pain or is hurt.`,
        zh: `当一个角色感到痛苦或受伤时执行。`,
        ru: `Выполняется, когда персонаж чувствует боль или ранен.`,
        fr: `Exécuté lorsqu'un personnage ressent de la douleur ou est blessé.`,
        es: `Ejecutado cuando un personaje siente dolor o está herido.`,
        de: `Wird ausgeführt, wenn ein Charakter Schmerzen empfindet oder verletzt ist.`,
        ja: `キャラクターが痛みを感じたり、傷ついたときに実行されます。`,
        ko: `캐릭터가 고통을 느끼거나 다쳤을 때 실행됩니다.`,
        pl: `Wykonywane, gdy postać czuje ból lub jest ranna.`
    },

    /**
     * @param {GameData} gameData 
     * @param {number} initiatorId
     * @param {number} targetId
     */
    check: (gameData, initiatorId, targetId) =>{
        return true;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     * @param {number} initiatorId
     * @param {number} targetId
     */
    run: (gameData, runGameEffect, args, initiatorId, targetId) => {
        runGameEffect(
            `set_global_variable = {
				name = talk_pose
				value = flag:pain
            }`
        )
    },
    chatMessage: () =>{
        return {
            en: `{{character1Name}} is in pain.`,
            zh: `{{character1Name}}感到痛苦。`,
            ru: `{{character1Name}} испытывает боль.`,
            fr: `{{character1Name}} a mal.`,
            es: `{{character1Name}} siente dolor.`,
            de: `{{character1Name}} hat Schmerzen.`,
            ja: `{{character1Name}}は痛みを感じています。`,
            ko: `{{character1Name}}는 고통을 느낍니다.`,
            pl: `{{character1Name}} odczuwa ból.`
        }
    },
    chatMessageClass: "neutral-action-message"
}

