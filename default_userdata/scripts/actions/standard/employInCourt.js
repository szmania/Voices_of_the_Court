//Made by: MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "employInCourt",
    args: [],
    description: {
        en: `Executed when a character joins another character's court. The source (character1) is the RULER/EMPLOYER. The target (character2) is the character being EMPLOYED.`,
        zh: `当一个不是统治者或骑士的角色决定加入另一个角色的宫廷时执行`,
        ru: `Выполняется, когда персонаж, не являющийся правителем или рыцарем, решает присоединиться к двору другого персонажа.`,
        fr: `Exécuté lorsqu'un personnage qui n'est pas un souverain ou un chevalier décide de rejoindre la cour d'un autre personnage.`,
        es: `Ejecutado cuando un personaje que no es un gobernante o caballero decide unirse a la corte de otro personaje.`,
        de: `Wird ausgeführt, wenn ein Charakter, der kein Herrscher oder Ritter ist, beschließt, dem Hof eines anderen Charakters beizutreten.`,
        ja: `支配者でも騎士でもないキャラクターが別のキャラクターの宮廷に加わることを決めたときに実行されます。`,
        ko: `통치자나 기사가 아닌 캐릭터가 다른 캐릭터의 궁정에 합류하기로 결정했을 때 실행됩니다.`,
        pl: `Wykonywane, gdy postać, która nie jest władcą ani rycerzem, decyduje się dołączyć do dworu innej postaci.`
    },

    /**
     * @param {GameData} gameData 
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) => {
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
            en: `{{character2Name}} joined {{character1Name}}'s court.`,
            zh: `{{character2Name}}加入了{{character1Name}}的宫廷`,
            ru: `{{character2Name}} присоединился к двору {{character1Name}}.`,
            fr: `{{character2Name}} a rejoint la cour de {{character1Name}}.`,
            es: `{{character2Name}} se unió a la corte de {{character1Name}}.`,
            de: `{{character2Name}} hat sich dem Hof von {{character1Name}} angeschlossen.`,
            ja: `{{character2Name}}は{{character1Name}}の宮廷に加わりました。`,
            ko: `{{character2Name}}가 {{character1Name}}의 궁정에 합류했습니다.`,
            pl: `{{character2Name}} dołączył do dworu {{character1Name}}.`
        }
    },
    chatMessageClass: "neutral-action-message"
}
