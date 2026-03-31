/** @import { GameData, Character } from '../../gamedata_typedefs.js' */

module.exports = {
    signature: "changeLiege",
    isDestructive: true,
    args: [],
    description: {
        en: "A vassal (the source, character1) changes their liege to a new ruler (the target, character2).",
        zh: "一个封臣（源，character1）将他的领主换成一个新的统治者（目标，character2）。",
        ru: "Вассал (источник, персонаж 1) меняет своего сюзерена на нового правителя (цель, персонаж 2).",
        fr: "Un vassal (la source, personnage 1) change son suzerain pour un nouveau dirigeant (la cible, personnage 2).",
        es: "Un vasallo (el origen, character1) cambia su señor por un nuevo gobernante (el objetivo, character2).",
        de: "Ein Vasall (die Quelle, Charakter 1) wechselt seinen Lehnsherrn zu einem neuen Herrscher (dem Ziel, Charakter 2).",
        ja: "家臣（ソース、キャラクター1）が主君を新しい支配者（ターゲット、キャラクター2）に変更します。",
        ko: "가신(소스, 캐릭터 1)이 자신의 군주를 새로운 통치자(대상, 캐릭터 2)로 변경합니다.",
        pl: "Wasal (źródło, postać 1) zmienia swojego suwerena na nowego władcę (cel, postać 2).",
        pt: "Um vassalo (a fonte, personagem 1) muda seu suserano para um novo governante (o alvo, personagem 2)."
    },

    /**
     * @param {GameData} gameData
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) => {
        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);
        // A landed ruler can change liege to another landed ruler.
        return !!source && !!target && source.isLandedRuler && target.isLandedRuler && sourceId !== targetId;
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
        if (!source.isLandedRuler) {
            return { success: false, message: `${source.shortName} must be a landed ruler to change liege.` };
        }
        if (!target.isLandedRuler) {
            return { success: false, message: `${target.shortName} must be a landed ruler to become a liege.` };
        }
        if (source.liege === target.shortName || source.liege === target.fullName) {
            return { success: false, message: `${source.shortName} is already a vassal of ${target.shortName}.`};
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
        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);
        if (!source || !target) return;

        runGameEffect(`
            create_title_and_vassal_change = {
                type = swear_fealty
                save_scope_as = change
            }
            global_var:votcce_action_source = {
                change_liege = {
                    liege = global_var:votcce_action_target
                    change = scope:change
                }
                add_opinion = {
                    modifier = became_vassal
                    target = global_var:votcce_action_target
                    opinion = 10
                }
            }
            resolve_title_and_vassal_change = scope:change
        `);

        source.liege = target.fullName;
    },

    chatMessage: (args) => {
        return {
            en: `{{character1Name}} now swears fealty to {{character2Name}}.`,
            zh: `{{character1Name}}现在向{{character2Name}}宣誓效忠。`,
            ru: `{{character1Name}} теперь присягает на верность {{character2Name}}.`,
            fr: `{{character1Name}} prête maintenant allégeance à {{character2Name}}.`,
            es: `{{character1Name}} ahora jura lealtad a {{character2Name}}.`,
            de: `{{character1Name}} schwört nun {{character2Name}} die Treue.`,
            ja: `{{character1Name}}は今、{{character2Name}}に忠誠を誓います。`,
            ko: `{{character1Name}}은(는) 이제 {{character2Name}}에게 충성을 맹세합니다.`,
            pl: `{{character1Name}} teraz przysięga wierność {{character2Name}}.`,
            pt: `{{character1Name}} agora jura lealdade a {{character2Name}}.`
        };
    },

    chatMessageClass: "neutral-action-message"
};
