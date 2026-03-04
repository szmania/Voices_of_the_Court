//Made by: MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

module.exports = {
    signature: "intercourseB",
    args: [],
    description: {
        en: `Executed after two characters (other than {{playerName}}) have sexual intercourse. Can be consensual or forced.`,
        zh: `仅在除了{{playerName}}之外的{{character1Name}}和{{character2Name}}两人发生性关系后执行。行为可以是双方自愿的或强奸。`,
        ru: `Выполняется после того, как два персонажа (кроме {{playerName}}) вступают в половую связь. Может быть по обоюдному согласию или принудительно.`,
        fr: `Exécuté après que deux personnages (autres que {{playerName}}) ont eu des rapports sexuels. Peut être consensuel ou forcé.`,
        es: `Ejecutado después de que dos personajes (que no sean {{playerName}}) tengan relaciones sexuales. Puede ser consensual o forzado.`,
        de: `Wird ausgeführt, nachdem zwei Charaktere (außer {{playerName}}) Geschlechtsverkehr hatten. Kann einvernehmlich oder gewaltsam sein.`,
        ja: `{{playerName}}以外の2人のキャラクターが性的な交渉を持った後に実行されます。合意の上か強制的かもしれません。`,
        ko: `{{playerName}} 이외의 두 캐릭터가 성관계를 가진 후에 실행됩니다. 합의하거나 강제일 수 있습니다.`,
        pl: `Wykonywane po tym, jak dwie postacie (inne niż {{playerName}}) odbyły stosunek seksualny. Może być dobrowolny lub wymuszony.`
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
        global_var:talk_second_scope = {
            had_sex_with_effect = {
				CHARACTER = global_var:talk_third_scope
				PREGNANCY_CHANCE = pregnancy_chance
			}
        }
    `);
    gameData.getAi().addTrait({
        category: "flag",
        name: "HadSex",
        desc: `${gameData.getAi().shortName} had sex recently`
    })
    },
    /**
     * @param {string[]} args 
     */
    chatMessage: (args) =>{      
        return {
            en: `{{character1Name}} and {{character2Name}} had intercourse.`,
            zh: `{{character1Name}}和{{character2Name}}共赴巫山`,
            ru: `{{character1Name}} и {{character2Name}} вступили в половую связь.`,
            fr: `{{character1Name}} et {{character2Name}} ont eu des rapports sexuels.`,
            es: `{{character1Name}} y {{character2Name}} tuvieron relaciones sexuales.`,
            de: `{{character1Name}} und {{character2Name}} hatten Geschlechtsverkehr.`,
            ja: `{{character1Name}}と{{character2Name}}は性的な交渉を持ちました。`,
            ko: `{{character1Name}}와 {{character2Name}}가 성관계를 가졌습니다.`,
            pl: `{{character1Name}} i {{character2Name}} odbyli stosunek seksualny.`
        }
    },
    chatMessageClass: "neutral-action-message"
}
