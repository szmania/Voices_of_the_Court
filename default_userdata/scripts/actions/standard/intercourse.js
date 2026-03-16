//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "intercourse",
    args: [],
    description: {
        en: `Executed when two characters have sexual intercourse. Can be consensual or forced.`,
        zh: `当两个角色发生性关系时执行，仅在性关系结束后执行。行为可以是双方自愿的或强奸。`,
        ru: `Выполняется, когда два персонажа вступают в половую связь. Может быть по обоюдному согласию или принудительно.`,
        fr: `Exécuté lorsque deux personnages ont des rapports sexuels. Peut être consensuel ou forcé.`,
        es: `Ejecutado cuando dos personajes tienen relaciones sexuales. Puede ser consensual o forzado.`,
        de: `Wird ausgeführt, wenn zwei Charaktere Geschlechtsverkehr haben. Kann einvernehmlich oder gewaltsam sein.`,
        ja: `二人のキャラクターが性的な交渉を持ったときに実行されます。合意の上か強制的かもしれません。`,
        ko: `두 캐릭터가 성관계를 가질 때 실행됩니다. 합의하거나 강제일 수 있습니다.`,
        pl: `Wykonywane, gdy dwie postacie odbywają stosunek seksualny. Może być dobrowolny lub wymuszony.`
    },

    /**
     * @param {GameData} gameData 
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) => {
        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);
        // Prevent action if either character recently had sex, to avoid spam.
        if ((source && source.hasTrait("HadSex")) || (target && target.hasTrait("HadSex"))) {
            return false;
        }
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
        global_var:votcce_action_source = {
            had_sex_with_effect = {
				CHARACTER = global_var:votcce_action_target
				PREGNANCY_CHANCE = pregnancy_chance
			}
        }
    `);
        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);

        if (source) {
            source.addTrait({
                category: "flag",
                name: "HadSex",
                desc: `${source.shortName} had sex recently`
            });
        }
        if (target) {
            target.addTrait({
                category: "flag",
                name: "HadSex",
                desc: `${target.shortName} had sex recently`
            });
        }
    },
    chatMessage: (args) =>{
        return {
            en: `{{character1Name}} and {{character2Name}} had intercourse.`,
            zh: `{{character1Name}}和{{character2Name}}性交`,
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
