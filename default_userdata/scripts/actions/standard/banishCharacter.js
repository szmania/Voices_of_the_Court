//Made by: VOTC-CE

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "banishCharacter",
    args: [],
    description: {
        en: `Executed when a character is banished from the court by another. The source (character1) is the liege/host EXPELLING. The target (character2) is the courtier or guest being BANISHED.`,
        zh: `当一个角色被另一个角色逐出宫廷时执行。`,
        ru: `Выполняется, когда один персонаж изгоняет другого из двора.`,
        fr: `Exécuté lorsqu'un personnage est banni de la cour par un autre.`,
        es: `Ejecutado cuando un personaje es desterrado de la corte por otro.`,
        de: `Wird ausgeführt, wenn ein Charakter von einem anderen vom Hof verbannt wird.`,
        ja: `あるキャラクターが別のキャラクターによって宮廷から追放されたときに実行されます。`,
        ko: `한 캐릭터가 다른 캐릭터에 의해 궁정에서 추방되었을 때 실행됩니다.`,
        pl: `Wykonywane, gdy jedna postać zostaje wygnana z dworu przez inną.`,
        pt: `Executado quando um personagem é banido da corte por outro.`,
        tr: `Bir karakter başka biri tarafından saraydan sürgün edildiğinde çalıştırılır.`
    },

    /**
     * @param {GameData} gameData 
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) => {
        const target = gameData.getCharacterById(targetId);
        if (!target) return false;

        const source = gameData.getCharacterById(sourceId);
        if (!source) return false;

        if (sourceId === targetId) return false;

        // Target must be an unlanded courtier/guest (not a landed ruler of another realm)
        if (target.isLandedRuler) return false;

        // Source must be the target's liege/host
        const isLiegeOrHost = target.liege === source.fullName || target.liege === source.shortName;
        return !!isLiegeOrHost;
    },

    /**
     * @param {GameData} gameData 
     * @param {string[]} args 
     * @param {number} sourceId
     * @param {number} targetId
     * @returns {{success: boolean, message?: string}}
     */
    preCheck: (gameData, args, sourceId, targetId) => {
        const target = gameData.getCharacterById(targetId);
        if (!target) {
            return { success: false, message: "Target character not found." };
        }

        const source = gameData.getCharacterById(sourceId);
        if (!source) {
            return { success: false, message: "Source character not found." };
        }

        if (sourceId === targetId) {
            return { success: false, message: "A character cannot banish themselves." };
        }

        if (target.isLandedRuler) {
            return { success: false, message: "The target is a landed ruler and cannot be banished from court." };
        }

        const isLiegeOrHost = target.liege === source.fullName || target.liege === source.shortName;
        if (!isLiegeOrHost) {
            return { success: false, message: "The target is not a courtier or guest of the source and cannot be banished." };
        }

        return { success: true };
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
                banish = yes
            }`);
    },

    chatMessage: (args) => {
        return {
            en: `{{character1Name}} banished {{character2Name}} from the court.`,
            zh: `{{character1Name}}将{{character2Name}}逐出了宫廷。`,
            ru: `{{character1Name}} изгнал(а) {{character2Name}} из двора.`,
            fr: `{{character1Name}} a banni {{character2Name}} de la cour.`,
            es: `{{character1Name}} desterró a {{character2Name}} de la corte.`,
            de: `{{character1Name}} hat {{character2Name}} vom Hof verbannt.`,
            ja: `{{character1Name}}は{{character2Name}}を宮廷から追放しました。`,
            ko: `{{character1Name}}가 {{character2Name}}를 궁정에서 추방했습니다.`,
            pl: `{{character1Name}} wygnął(a) {{character2Name}} z dworu.`,
            pt: `{{character1Name}} baniu {{character2Name}} da corte.`,
            tr: `{{character1Name}}, {{character2Name}}'yi saraydan sürgün etti.`
        };
    },

    chatMessageClass: "negative-action-message",
    canPerformAtDistance: false
};