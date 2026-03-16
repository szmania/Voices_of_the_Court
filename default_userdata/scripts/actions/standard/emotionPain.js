//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "emotionPain",
    args: [],
    description: {
        en: `Executed when a character feels pain or is hurt. The source (character1) is the character who caused the emotion. The target (character2) is the character FEELING the emotion.`,
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
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) =>{
        return true;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     * @param {number} sourceId
     * @param {number} targetId
     */
    run: (gameData, runGameEffect, args, sourceId, targetId) => {
        runGameEffect(
            `global_var:votcce_action_target = {
                set_global_variable = {
                    name = talk_pose
                    value = flag:pain
                }
            }`
        )
    },
    chatMessage: () =>{
        return {
            en: `{{character2Name}} is in pain.`,
            zh: `{{character2Name}}感到痛苦。`,
            ru: `{{character2Name}} испытывает боль.`,
            fr: `{{character2Name}} a mal.`,
            es: `{{character2Name}} siente dolor.`,
            de: `{{character2Name}} hat Schmerzen.`,
            ja: `{{character2Name}}は痛みを感じています。`,
            ko: `{{character2Name}}는 고통을 느낍니다.`,
            pl: `{{character2Name}} odczuwa ból.`
        }
    },
    chatMessageClass: "neutral-action-message"
}

