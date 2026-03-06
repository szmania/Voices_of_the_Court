//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "intercourse",
    args: [],
    description: {
        en: `Executed when {{aiName}} and {{playerName}} have sexual intercourse. Can be consensual or forced.`,
        zh: `当{{aiName}}和{{playerName}}发生性关系时执行，仅在性关系结束后执行。行为可以是双方自愿的或强奸。`,
        ru: `Выполняется, когда {{aiName}} и {{playerName}} вступают в половую связь. Может быть по обоюдному согласию или принудительно.`,
        fr: `Exécuté lorsque {{aiName}} et {{playerName}} ont des rapports sexuels. Peut être consensuel ou forcé.`,
        es: `Ejecutado cuando {{aiName}} y {{playerName}} tienen relaciones sexuales. Puede ser consensual o forzado.`,
        de: `Wird ausgeführt, wenn {{aiName}} und {{playerName}} Geschlechtsverkehr haben. Kann einvernehmlich oder gewaltsam sein.`,
        ja: `{{aiName}}と{{playerName}}が性的な交渉を持ったときに実行されます。合意の上か強制的かもしれません。`,
        ko: `{{aiName}}와 {{playerName}}가 성관계를 가질 때 실행됩니다. 합의하거나 강제일 수 있습니다.`,
        pl: `Wykonywane, gdy {{aiName}} i {{playerName}} odbywają stosunek seksualny. Może być dobrowolny lub wymuszony.`
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
        global_var:talk_first_scope = {
            had_sex_with_effect = {
				CHARACTER = global_var:talk_second_scope
				PREGNANCY_CHANCE = pregnancy_chance
			}
        }
    `);
    },
    chatMessage: (args) =>{
        return {
            en: `You had intercourse with {{aiName}}.`,
            zh: `你与{{aiName}}性交`,
            ru: `Вы вступили в половую связь с {{aiName}}.`,
            fr: `Vous avez eu des rapports sexuels avec {{aiName}}.`,
            es: `Tuviste relaciones sexuales con {{aiName}}.`,
            de: `Du hattest Geschlechtsverkehr mit {{aiName}}.`,
            ja: `あなたは{{aiName}}と性的な交渉を持ちました。`,
            ko: `당신은 {{aiName}}와 성관계를 가졌습니다.`,
            pl: `Odbyłeś stosunek seksualny z {{aiName}}.`
        }
    },
    chatMessageClass: "neutral-action-message"
}
