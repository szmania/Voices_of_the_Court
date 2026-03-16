//Made by: GitHub Sync

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "employAsKnight",
    args: [],
    description: {
        en: `Executed when a character is not a ruler and decides to join another's court as a knight.`,
        zh: `当一个角色不是统治者，并决定以骑士身份加入另一个角色的宫廷时执行`,
        ru: `Выполняется, когда персонаж не является правителем и решает присоединиться к двору другого в качестве рыцаря.`,
        fr: `Exécuté lorsqu'un personnage n'est pas un souverain et décide de rejoindre la cour d'un autre en tant que chevalier.`,
        es: `Ejecutado cuando un personaje no es un gobernante y decide unirse a la corte de otro como caballero.`,
        de: `Wird ausgeführt, wenn ein Charakter kein Herrscher ist und beschließt, dem Hof eines anderen als Ritter beizutreten.`,
        ja: `あるキャラクターが支配者ではなく、別のキャラクターの宮廷に騎士として加わることを決めたときに実行されます。`,
        ko: `한 캐릭터가 통치자가 아니고 다른 캐릭터의 궁정에 기사로 합류하기로 결정했을 때 실행됩니다.`,
        pl: `Wykonywane, gdy postać nie jest władcą i decyduje się dołączyć do dworu innej jako rycerz.`
    },

    /**
     * @param {GameData} gameData 
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) => {
        const target = gameData.getCharacterById(targetId);
        return target ? !target.isLandedRuler : false;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     * @param {number} sourceId
     * @param {number} targetId
     */
    run: (gameData, runGameEffect, args, sourceId, targetId) => {
        runGameEffect(`
            global_var:votcce_action_target = {
                add_to_entourage_court_and_activity_effect = {
                    CHAR_TO_ADD = global_var:votcce_action_target
                    NEW_COURT_OWNER = global_var:votcce_action_source
                }
                set_knight_status = force
            }
        `);
    },
    chatMessage: (args) => {
        return {
            en: `{{character2Name}} joined {{character1Name}}'s court as a knight.`,
            zh: `{{character2Name}}以骑士身份加入了{{character1Name}}的宫廷`,
            ru: `{{character2Name}} присоединился к двору {{character1Name}} в качестве рыцаря.`,
            fr: `{{character2Name}} a rejoint la cour de {{character1Name}} en tant que chevalier.`,
            es: `{{character2Name}} se unió a la corte de {{character1Name}} como caballero.`,
            de: `{{character2Name}} hat sich dem Hof von {{character1Name}} als Ritter angeschlossen.`,
            ja: `{{character2Name}}は騎士として{{character1Name}}の宮廷に加わりました。`,
            ko: `{{character2Name}}가 기사로 {{character1Name}}의 궁정에 합류했습니다.`,
            pl: `{{character2Name}} dołączył do dworu {{character1Name}} jako rycerz.`
        }
    },
    chatMessageClass: "neutral-action-message"
}
