//Made by: GitHub Sync

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "aiEmployedAsKnight",
    args: [],
    description: {
        en: `Executed when {{aiName}} is not a ruler and decides to join {{playerName}}'s court as a knight.`,
        zh: `当{{aiName}}不是统治者，并决定以骑士身份加入{{playerName}}的宫廷时执行`,
        ru: `Выполняется, когда {{aiName}} не является правителем и решает присоединиться к двору {{playerName}} в качестве рыцаря.`,
        fr: `Exécuté lorsque {{aiName}} n'est pas un souverain et décide de rejoindre la cour de {{playerName}} en tant que chevalier.`,
        es: `Ejecutado cuando {{aiName}} no es un gobernante y decide unirse a la corte de {{playerName}} como caballero.`,
        de: `Wird ausgeführt, wenn {{aiName}} kein Herrscher ist und beschließt, den Hof von {{playerName}} als Ritter zu verlassen.`,
        ja: `{{aiName}}が支配者ではなく、{{playerName}}の宮廷に騎士として加わることを決めたときに実行されます。`,
        ko: `{{aiName}}이 통치자가 아니고 {{playerName}}의 궁정에 기사로 합류하기로 결정했을 때 실행됩니다.`,
        pl: `Wykonywane, gdy {{aiName}} nie jest władcą i decyduje się dołączyć do dworu {{playerName}} jako rycerz.`
    },

    /**
     * @param {GameData} gameData 
     */
    check: (gameData) => {
        let ai = gameData.getAi();
        return !ai.isLandedRuler;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
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
            en: `{{aiName}} joined your court as a knight.`,
            zh: `{{aiName}}以骑士身份加入了你的宫廷`,
            ru: `{{aiName}} присоединился к вашему двору в качестве рыцаря.`,
            fr: `{{aiName}} a rejoint votre cour en tant que chevalier.`,
            es: `{{aiName}} se unió a tu corte como caballero.`,
            de: `{{aiName}} hat sich deinem Hof als Ritter angeschlossen.`,
            ja: `{{aiName}}は騎士としてあなたの宮廷に加わりました。`,
            ko: `{{aiName}}가 기사로 당신의 궁정에 합류했습니다.`,
            pl: `{{aiName}} dołączył do twojego dworu jako rycerz.`
        }
    },
    chatMessageClass: "neutral-action-message"
}
