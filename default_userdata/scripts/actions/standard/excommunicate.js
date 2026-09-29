//Made by: VOTC-CE

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

module.exports = {
    signature: "excommunicate",
    args: [],
    description: {
        en: `Executed when a character has another cast out of the faith. The source (character1) is the one DEMANDING the excommunication (their faith's head carries it out). The target (character2) is the one EXCOMMUNICATED. Both must share a faith.`,
        zh: `当一个角色使另一个角色被逐出信仰时执行。双方必须同信仰。`,
        ru: `Выполняется, когда один персонаж добивается отлучения другого от церкви. Оба должны исповедовать одну веру.`,
        fr: `Exécuté lorsqu'un personnage fait excommunier un autre. Les deux doivent partager la même foi.`,
        es: `Ejecutado cuando un personaje hace que otro sea excomulgado. Ambos deben compartir la misma fe.`,
        de: `Wird ausgeführt, wenn ein Charakter dafür sorgt, dass ein anderer exkommuniziert wird. Beide müssen denselben Glauben teilen.`,
        ja: `あるキャラクターが別のキャラクターを破門させたときに実行されます。両者は同じ信仰を共有している必要があります。`,
        ko: `한 캐릭터가 다른 캐릭터를 파문시킬 때 실행됩니다. 두 캐릭터는 같은 신앙을 공유해야 합니다.`,
        pl: `Wykonywane, gdy jedna postać doprowadza do ekskomuniki drugiej. Obie muszą wyznawać tę samą wiarę.`,
        pt: `Executado quando um personagem faz com que outro seja excomungado. Ambos devem compartilhar a mesma fé.`,
        tr: `Bir karakter başkasının aforoz edilmesini sağladığında çalıştırılır. İkisi de aynı inancı paylaşmalıdır.`
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

        // Both characters must share the same faith for an excommunication request to make sense
        const sourceFaith = String(source.faith || "").toLowerCase();
        const targetFaith = String(target.faith || "").toLowerCase();
        if (!sourceFaith || !targetFaith || sourceFaith !== targetFaith) return false;

        return true;
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
            return { success: false, message: "A character cannot excommunicate themselves." };
        }

        const sourceFaith = String(source.faith || "").toLowerCase();
        const targetFaith = String(target.faith || "").toLowerCase();
        if (!sourceFaith || !targetFaith || sourceFaith !== targetFaith) {
            return { success: false, message: "The source and target must share the same faith for an excommunication." };
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
            excommunicate_character = {
                REQUESTING_CHARACTER = global_var:votcce_action_source
                TARGET_CHARACTER = global_var:votcce_action_target
            }`);
    },

    chatMessage: (args) => {
        return {
            en: `{{character1Name}} had {{character2Name}} excommunicated.`,
            zh: `{{character1Name}}使{{character2Name}}被逐出教会。`,
            ru: `{{character1Name}} добился(ась) отлучения {{character2Name}} от церкви.`,
            fr: `{{character1Name}} a fait excommunier {{character2Name}}.`,
            es: `{{character1Name}} hizo que {{character2Name}} fuera excomulgado.`,
            de: `{{character1Name}} ließ {{character2Name}} exkommunizieren.`,
            ja: `{{character1Name}}は{{character2Name}}を破門させました。`,
            ko: `{{character1Name}}이(가) {{character2Name}}를 파문시켰습니다.`,
            pl: `{{character1Name}} doprowadził(a) do ekskomuniki {{character2Name}}.`,
            pt: `{{character1Name}} mandou excomungar {{character2Name}}.`,
            tr: `{{character1Name}}, {{character2Name}}'in aforoz edilmesini sağladı.`
        };
    },

    chatMessageClass: "negative-action-message",
    canPerformAtDistance: false
};