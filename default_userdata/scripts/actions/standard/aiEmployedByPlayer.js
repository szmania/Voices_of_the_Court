//Made by: MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "aiEmployedByPlayer",
    args: [],
    description: {
        en: `Executed when {{aiName}} is not a ruler or knight and decides to join {{playerName}}'s court.`,
        zh: `当{{aiName}}不是统治者或勇士，并决定加入{{playerName}}的宫廷时执行`,
        ru: `Выполняется, когда {{aiName}} не является правителем или рыцарем и решает присоединиться к двору {{playerName}}.`,
        fr: `Exécuté lorsque {{aiName}} n'est pas un souverain ou un chevalier et décide de rejoindre la cour de {{playerName}}.`,
        es: `Ejecutado cuando {{aiName}} no es un gobernante o caballero y decide unirse a la corte de {{playerName}}.`,
        de: `Wird ausgeführt, wenn {{aiName}} kein Herrscher oder Ritter ist und beschließt, den Hof von {{playerName}} zu verlassen.`,
        ja: `{{aiName}}が支配者でも騎士でもなく、{{playerName}}の宮廷に加わることを決めたときに実行されます。`,
        ko: `{{aiName}}이 통치자나 기사가 아니고 {{playerName}}의 궁정에 합류하기로 결정했을 때 실행됩니다.`,
        pl: `Wykonywane, gdy {{aiName}} nie jest władcą ani rycerzem i decyduje się dołączyć do dworu {{playerName}}.`
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
            global_var:votcce_action_target = {
				add_to_entourage_court_and_activity_effect = {
					CHAR_TO_ADD = global_var:votcce_action_target
					NEW_COURT_OWNER = global_var:votcce_action_source
				}
			}
        `);
        
    },
    chatMessage: (args) => {
        return {
            en: `{{aiName}} joined your court.`,
            zh: `{{aiName}}加入了你的宫廷`,
            ru: `{{aiName}} присоединился к вашему двору.`,
            fr: `{{aiName}} a rejoint votre cour.`,
            es: `{{aiName}} se unió a tu corte.`,
            de: `{{aiName}} hat sich deinem Hof angeschlossen.`,
            ja: `{{aiName}}はあなたの宮廷に加わりました。`,
            ko: `{{aiName}}가 당신의 궁정에 합류했습니다.`,
            pl: `{{aiName}} dołączył do twojego dworu.`
        }
    },
    chatMessageClass: "neutral-action-message"
}
