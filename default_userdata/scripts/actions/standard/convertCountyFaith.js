//Made by: software_engineer_ck3

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

module.exports = {
    signature: "convertCountyFaith",
    args: [],
    description: {
        en: `Executed when a landed ruler's capital county is converted to another character's faith. The source (character1) is the one whose faith is ADOPTED. The target (character2) is the landed ruler whose capital county converts.`,
        zh: `当一个领地统治者的首都伯爵领皈依另一个角色的信仰时执行。源（character1）是被采用信仰者，目标（character2）是首都伯爵领皈依的领地统治者。`,
        ru: `Выполняется, когда столичное графство правителя обращается в веру другого персонажа. Источник (персонаж 1) — тот, чья вера принимается. Цель (персонаж 2) — правитель, чьё столичное графство обращается.`,
        fr: `Exécuté lorsque le comté capital d'un dirigeant foncier est converti à la foi d'un autre personnage. La source (personnage 1) est celui dont la foi est adoptée. La cible (personnage 2) est le dirigeant foncier dont le comté capital se convertit.`,
        es: `Ejecutado cuando el condado capital de un gobernante con tierras se convierte a la fe de otro personaje. El origen (character1) es aquel cuya fe se adopta. El objetivo (character2) es el gobernante con tierras cuyo condado capital se convierte.`,
        de: `Wird ausgeführt, wenn die Hauptlandgrafschaft eines Herrschers zum Glauben eines anderen Charakters bekehrt wird. Die Quelle (Charakter 1) ist derjenige, dessen Glaube übernommen wird. Das Ziel (Charakter 2) ist der Herrscher, dessen Hauptlandgrafschaft konvertiert.`,
        ja: `領地統治者の首都伯領が別のキャラクターの信仰に改宗したときに実行されます。ソース（キャラクター1）は信仰が採用される側、ターゲット（キャラクター2）は首都伯領が改宗する領地統治者です。`,
        ko: `영지 통치자의 수도 백작령이 다른 캐릭터의 신앙으로 개종할 때 실행됩니다. 소스(캐릭터 1)는 신앙이 채택되는 쪽, 대상(캐릭터 2)은 수도 백작령이 개종하는 영지 통치자입니다.`,
        pl: `Wykonywane, gdy stołeczne hrabstwo władcy zostaje nawrócone na wiarę innej postaci. Źródło (postać 1) to ta, której wiara jest przyjmowana. Cel (postać 2) to władca, którego stołeczne hrabstwo ulega konwersji.`,
        pt: `Executado quando o condado capital de um governante com terras é convertido à fé de outro personagem. A fonte (character1) é aquele cuja fé é adotada. O alvo (character2) é o governante com terras cujo condado capital se converte.`,
        tr: `Toprak sahibi bir hükümdarın baş ilçesi başka bir karakterin inancına döndüğünde çalıştırılır. Kaynak (character1) inancı benimsenen taraftır. Hedef (character2) baş ilçesi dönen toprak sahibi hükümdardır.`
    },
    canPerformAtDistance: true,

    /**
     * @param {GameData} gameData
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) => {
        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);
        if (!source || !target) return false;
        if (sourceId === targetId) return false;
        if (!target.isLandedRuler) return false;

        const sourceFaith = String(source.faith || "").toLowerCase();
        const targetFaith = String(target.faith || "").toLowerCase();
        if (!sourceFaith || !targetFaith || sourceFaith === targetFaith) return false;

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
        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);
        if (!source || !target) {
            return { success: false, message: "Source or target character not found." };
        }
        if (sourceId === targetId) {
            return { success: false, message: "A character cannot convert their own county's faith to themselves." };
        }
        if (!target.isLandedRuler) {
            return { success: false, message: "The target must hold a landed title for their capital county to convert faith." };
        }

        const sourceFaith = String(source.faith || "").toLowerCase();
        const targetFaith = String(target.faith || "").toLowerCase();
        if (!sourceFaith || !targetFaith || sourceFaith === targetFaith) {
            return { success: false, message: "The source and target must be of different faiths for a county faith conversion." };
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
        const target = gameData.getCharacterById(targetId);
        if (!target) return;

        runGameEffect(`
            global_var:votcce_action_target.capital_county = {
                set_county_faith = global_var:votcce_action_source.faith
            }`);
    },

    chatMessage: (args) => {
        return {
            en: `{{character2Name}}'s capital county was converted to {{character1Name}}'s faith.`,
            zh: `{{character2Name}}的首都伯爵领皈依了{{character1Name}}的信仰。`,
            ru: `Столичное графство {{character2Name}} было обращено в веру {{character1Name}}.`,
            fr: `Le comté capital de {{character2Name}} a été converti à la foi de {{character1Name}}.`,
            es: `El condado capital de {{character2Name}} fue convertido a la fe de {{character1Name}}.`,
            de: `Die Hauptlandgrafschaft von {{character2Name}} wurde zum Glauben von {{character1Name}} bekehrt.`,
            ja: `{{character2Name}}の首都伯領は{{character1Name}}の信仰に改宗しました。`,
            ko: `{{character2Name}}의 수도 백작령이 {{character1Name}}의 신앙으로 개종했습니다.`,
            pl: `Stołeczne hrabstwo {{character2Name}} zostało nawrócone na wiarę {{character1Name}}.`,
            pt: `O condado capital de {{character2Name}} foi convertido à fé de {{character1Name}}.`,
            tr: `{{character2Name}}'nin baş ilçesi {{character1Name}}'in inancına döndürüldü.`
        };
    },
    chatMessageClass: "neutral-action-message"
};