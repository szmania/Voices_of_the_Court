//Made by: VOTC-CE

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

module.exports = {
    signature: "promoteCulture",
    args: [],
    description: {
        en: `Executed when a character champions their culture in another's lands. The source (character1) is the one PROMOTING their culture. The target (character2) is the landed ruler whose capital county adopts the source's culture. The two must be of different cultures.`,
        zh: `当一个角色在另一个角色的领地上宣扬自己的文化时执行。目标必须是与源不同文化的领地统治者，其首都伯爵领将采纳源的文化。`,
        ru: `Выполняется, когда один персонаж продвигает свою культуру на землях другого. Цель должна быть держащим землю правителем иной культуры; её столичное графство принимает культуру источника.`,
        fr: `Exécuté lorsqu'un personnage fait la promotion de sa culture sur les terres d'un autre. La cible doit être un dirigeant foncier d'une culture différente ; son comté capital adopte la culture de la source.`,
        es: `Ejecutado cuando un personaje promueve su cultura en las tierras de otro. El objetivo debe ser un gobernante con tierras de una cultura diferente; su condado capital adopta la cultura del origen.`,
        de: `Wird ausgeführt, wenn ein Charakter seine Kultur im Land eines anderen fördert. Das Ziel muss ein Land besitzender Herrscher einer anderen Kultur sein; sein Hauptlandgrafschaft übernimmt die Kultur der Quelle.`,
        ja: `あるキャラクターが別のキャラクターの領地で自らの文化を広めたときに実行されます。ターゲットは異なる文化を持つ領地統治者である必要があり、その首都の伯爵領がソースの文化を採用します。`,
        ko: `한 캐릭터가 다른 캐릭터의 영지에서 자신의 문화를 장려할 때 실행됩니다. 대상은 다른 문화를 가진 영지 통치자여야 하며, 그 수도 백작령이 소스의 문화를 채택합니다.`,
        pl: `Wykonywane, gdy jedna postać promuje swoją kulturę na ziemiach drugiej. Cel musi być władcą posiadającym ziemię innej kultury; jego stołeczne hrabstwo przyjmuje kulturę źródła.`,
        pt: `Executado quando um personagem promove sua cultura nas terras de outro. O alvo deve ser um governante com terras de uma cultura diferente; seu condado capital adota a cultura da fonte.`,
        tr: `Bir karakter kültürünü başkasının topraklarında teşvik ettiğinde çalıştırılır. Hedefin, farklı bir kültüre sahip toprak sahibi bir hükümdar olması gerekir; baş ilçesi kaynağın kültürünü benimser.`
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

        // Target must hold a landed title for their capital county to be converted
        if (!target.isLandedRuler) return false;

        // The cultures must differ, otherwise there is nothing to promote
        const sourceCulture = String(source.culture || "").toLowerCase();
        const targetCulture = String(target.culture || "").toLowerCase();
        if (!sourceCulture || !targetCulture || sourceCulture === targetCulture) return false;

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
            return { success: false, message: "A character cannot promote their culture to themselves." };
        }

        if (!target.isLandedRuler) {
            return { success: false, message: "The target must hold a landed title for their capital county to adopt a new culture." };
        }

        const sourceCulture = String(source.culture || "").toLowerCase();
        const targetCulture = String(target.culture || "").toLowerCase();
        if (!sourceCulture || !targetCulture || sourceCulture === targetCulture) {
            return { success: false, message: "The source and target must be of different cultures for a culture promotion." };
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
            global_var:votcce_action_target.capital_county = {
                set_county_culture = global_var:votcce_action_source.culture
            }`);
    },

    chatMessage: (args) => {
        return {
            en: `{{character1Name}} championed their culture in {{character2Name}}'s capital county.`,
            zh: `{{character1Name}}在{{character2Name}}的首都伯爵领宣扬了自己的文化。`,
            ru: `{{character1Name}} продвинул(а) свою культуру в столичном графстве {{character2Name}}.`,
            fr: `{{character1Name}} a fait la promotion de sa culture dans le comté capital de {{character2Name}}.`,
            es: `{{character1Name}} promovió su cultura en el condado capital de {{character2Name}}.`,
            de: `{{character1Name}} hat seine Kultur in der Hauptlandgrafschaft von {{character2Name}} gefördert.`,
            ja: `{{character1Name}}は{{character2Name}}の首都の伯領で自らの文化を広めました。`,
            ko: `{{character1Name}}이(가) {{character2Name}}의 수도 백작령에서 자신의 문화를 장려했습니다.`,
            pl: `{{character1Name}} poparł(a) swoją kulturę w stołecznym hrabstwie {{character2Name}}.`,
            pt: `{{character1Name}} promoveu sua cultura no condado capital de {{character2Name}}.`,
            tr: `{{character1Name}}, kendi kültürünü {{character2Name}}'in baş ilçesinde teşvik etti.`
        };
    },

    chatMessageClass: "neutral-action-message",
    canPerformAtDistance: false
};