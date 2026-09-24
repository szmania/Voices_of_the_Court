//Made by: VOTC-CE

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

module.exports = {
    signature: "changeDevelopmentLevel",
    args: [
        {
            name: "delta",
            type: "int",
            desc: {
                en: "development points added (or removed) to {{character2Name}}'s capital county by {{character1Name}}'s patronage (clamped between -5 and +5, positive by default).",
                zh: "{{character1Name}}的资助为{{character2Name}}的首都伯爵领增加（或减少）的发展值（限制在-5到+5之间，默认为正）。",
                ru: "очки развития, добавленные (или отнятые) у столичного графства {{character2Name}} благодаря покровительству {{character1Name}} (ограничено от -5 до +5, по умолчанию положительно).",
                fr: "points de développement ajoutés (ou retirés) au comté capital de {{character2Name}} grâce au mécénat de {{character1Name}} (limité entre -5 et +5, positif par défaut).",
                es: "puntos de desarrollo añadidos (o quitados) al condado capital de {{character2Name}} gracias al mecenazgo de {{character1Name}} (limitado entre -5 y +5, positivo por defecto).",
                de: "Entwicklungspunkte, die durch {{character1Name}}s Förderung der Hauptlandgrafschaft von {{character2Name}} hinzugefügt (oder entzogen) werden (auf -5 bis +5 begrenzt, standardmäßig positiv).",
                ja: "{{character1Name}}の後援により{{character2Name}}の首都の伯領に加算（または減算）される発展値（-5から+5に制限、デフォルトは正の値）。",
                ko: "{{character1Name}}의 후원으로 {{character2Name}}의 수도 백작령에 추가(또는 감소)되는 발전도(-5에서 +5 사이로 제한, 기본값은 양수).",
                pl: "punkty rozwoju dodane (lub odebrane) stołecznemu hrabstwu {{character2Name}} dzięki patronatowi {{character1Name}} (ograniczone do -5..+5, domyślnie dodatnie).",
                pt: "pontos de desenvolvimento adicionados (ou removidos) ao condado capital de {{character2Name}} pelo mecenato de {{character1Name}} (limitado entre -5 e +5, positivo por padrão).",
                tr: "{{character1Name}}'in himayesi sayesinde {{character2Name}}'in baş ilçesine eklenen (veya çıkarılan) kalkınma puanları (-5 ile +5 arasında sınırlandırılmış, varsayılan olarak pozitif)."
            }
        }
    ],
    description: {
        en: `Executed when a character invests in (or undermines) another's homeland. The source (character1) is the PATRON. The target (character2) is the ruler whose capital county's development changes. The target must hold a landed title.`,
        zh: `当一个角色资助（或破坏）另一个角色的家园时执行。目标必须是持有领地头衔的统治者。`,
        ru: `Выполняется, когда один персонаж инвестирует в родину другого (или подрывает её). Цель должна быть правителем, держащим землю.`,
        fr: `Exécuté lorsqu'un personnage investit dans (ou saper) la terre natale d'un autre. La cible doit être un dirigeant détenteur d'un titre foncier.`,
        es: `Ejecutado cuando un personaje invierte en (o socava) la tierra natal de otro. El objetivo debe ser un gobernante con un título territorial.`,
        de: `Wird ausgeführt, wenn ein Charakter in die Heimat eines anderen investiert (oder sie untergräbt). Das Ziel muss ein Herrscher mit Landtitel sein.`,
        ja: `あるキャラクターが別のキャラクターの故郷に投資（または妨害）したときに実行されます。ターゲットは領地称号を持つ統治者である必要があります。`,
        ko: `한 캐릭터가 다른 캐릭터의 고향에 투자(또는 방해)할 때 실행됩니다. 대상은 영지 작위를 가진 통치자여야 합니다.`,
        pl: `Wykonywane, gdy jedna postać inwestuje w ojczyznę drugiej (lub ją podkopuje). Cel musi być władcą posiadającym tytuł ziemski.`,
        pt: `Executado quando um personagem investe na (ou sabota a) terra natal de outro. O alvo deve ser um governante com um título territorial.`,
        tr: `Bir karakter başkasının anavatanına yatırım yaptığında (veya sabote ettiğinde) çalıştırılır. Hedefin toprak unvanına sahip bir hükümdar olması gerekir.`
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

        // Target must hold a landed title for their capital county's development to change
        if (!target.isLandedRuler) return false;

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
            return { success: false, message: "A character cannot change their own capital's development through this action." };
        }

        if (!target.isLandedRuler) {
            return { success: false, message: "The target must hold a landed title for their capital county's development to change." };
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
        let delta = parseInt(args && args[0] ? String(args[0]) : "1", 10);
        if (isNaN(delta)) {
            delta = 1;
        }
        // Clamp the investment between -5 and +5 development points
        delta = Math.max(-5, Math.min(5, delta));
        if (delta === 0) {
            delta = 1;
        }
        runGameEffect(`
            global_var:votcce_action_target.capital_county = {
                change_development_level = ${delta}
            }`);
    },

    chatMessage: (args) => {
        let delta = parseInt(args && args[0] ? String(args[0]) : "1", 10);
        if (isNaN(delta)) {
            delta = 1;
        }
        delta = Math.max(-5, Math.min(5, delta));
        if (delta === 0) {
            delta = 1;
        }
        if (delta < 0) {
            return {
                en: `{{character1Name}}'s dealings cost {{character2Name}}'s capital ${Math.abs(delta)} development.`,
                zh: `{{character1Name}}的交易使{{character2Name}}的首都失去了${Math.abs(delta)}点发展度。`,
                ru: `Деятельность {{character1Name}} лишила столицу {{character2Name}} ${Math.abs(delta)} очков развития.`,
                fr: `Les agissements de {{character1Name}} ont coûté ${Math.abs(delta)} points de développement à la capitale de {{character2Name}}.`,
                es: `Las acciones de {{character1Name}} le costaron a la capital de {{character2Name}} ${Math.abs(delta)} puntos de desarrollo.`,
                de: `{{character1Name}}s Machenschaften haben der Hauptstadt von {{character2Name}} ${Math.abs(delta)} Entwicklungspunkte gekostet.`,
                ja: `{{character1Name}}の取引により、{{character2Name}}の首都は発展度${Math.abs(delta)}を失いました。`,
                ko: `{{character1Name}}의 거래로 인해 {{character2Name}}의 수도가 발전도 ${Math.abs(delta)}를 잃었습니다.`,
                pl: `Działania {{character1Name}} kosztowały stolicę {{character2Name}} ${Math.abs(delta)} punktów rozwoju.`,
                pt: `As ações de {{character1Name}} custaram à capital de {{character2Name}} ${Math.abs(delta)} pontos de desenvolvimento.`,
                tr: `{{character1Name}}'in işleri {{character2Name}}'in başkentine ${Math.abs(delta)} kalkınma puanına mal oldu.`
            };
        }
        return {
            en: `{{character1Name}} invested in {{character2Name}}'s homeland, adding ${delta} development.`,
            zh: `{{character1Name}}投资了{{character2Name}}的家园，增加了${delta}点发展度。`,
            ru: `{{character1Name}} вложился в родину {{character2Name}}, добавив ${delta} очков развития.`,
            fr: `{{character1Name}} a investi dans la terre natale de {{character2Name}}, y ajoutant ${delta} points de développement.`,
            es: `{{character1Name}} invirtió en la tierra natal de {{character2Name}}, añadiendo ${delta} puntos de desarrollo.`,
            de: `{{character1Name}} hat in die Heimat von {{character2Name}} investiert und ${delta} Entwicklungspunkte hinzugefügt.`,
            ja: `{{character1Name}}は{{character2Name}}の故郷に投資し、発展度${delta}を加えました。`,
            ko: `{{character1Name}}이(가) {{character2Name}}의 고향에 투자하여 발전도 ${delta}를 추가했습니다.`,
            pl: `{{character1Name}} zainwestował(a) w ojczyznę {{character2Name}}, dodając ${delta} punktów rozwoju.`,
            pt: `{{character1Name}} investiu na terra natal de {{character2Name}}, adicionando ${delta} pontos de desenvolvimento.`,
            tr: `{{character1Name}}, {{character2Name}}'in anavatanına yatırım yaptı ve ${delta} kalkınma puanı ekledi.`
        };
    },

    chatMessageClass: "neutral-action-message",
    canPerformAtDistance: true
};