//Made by: software_engineer_ck3

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

module.exports = {
    signature: "assignGuardian",
    args: [],
    description: {
        en: `Executed when a character becomes the guardian of a child. The source (character1) is the GUARDIAN. The target (character2) is the WARD (a child under 16).`,
        zh: `当一个角色成为孩子的监护人时执行。源（character1）是监护人，目标（character2）是被监护人（16岁以下的孩子）。`,
        ru: `Выполняется, когда персонаж становится опекуном ребёнка. Источник (персонаж 1) — опекун, цель (персонаж 2) — подопечный (ребёнок младше 16 лет).`,
        fr: `Exécuté lorsqu'un personnage devient le tuteur d'un enfant. La source (personnage 1) est le TUTEUR, la cible (personnage 2) est le PUPILLE (un enfant de moins de 16 ans).`,
        es: `Ejecutado cuando un personaje se convierte en tutor de un niño. El origen (character1) es el TUTOR, el objetivo (character2) es el PUPILO (un niño menor de 16 años).`,
        de: `Wird ausgeführt, wenn ein Charakter Vormund eines Kindes wird. Die Quelle (Charakter 1) ist der VORMUND, das Ziel (Charakter 2) ist das MÜNDEL (ein Kind unter 16 Jahren).`,
        ja: `キャラクターが子供の後見人になったときに実行されます。ソース（キャラクター1）は後見人、ターゲット（キャラクター2）は被後見人（16歳未満の子供）です。`,
        ko: `캐릭터가 아이의 후견인이 될 때 실행됩니다. 소스(캐릭터 1)는 후견인, 대상(캐릭터 2)은 피후견인(16세 미만 아동)입니다.`,
        pl: `Wykonywane, gdy postać zostaje opiekunem dziecka. Źródło (postać 1) to OPIEKUN, cel (postać 2) to PODOPIECZNY (dziecko poniżej 16 lat).`,
        pt: `Executado quando um personagem se torna tutor de uma criança. A fonte (character1) é o TUTOR, o alvo (character2) é o PUPILO (uma criança com menos de 16 anos).`,
        tr: `Bir karakter bir çocuğun vasisi olduğunda çalıştırılır. Kaynak (character1) VASİ, hedef (character2) VESAYET ALTINDAKİ (16 yaşından küçük bir çocuk).`
    },
    canPerformAtDistance: false,

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
        return Number(target.age) < 16 && Number(source.age) >= 16;
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
            return { success: false, message: "A character cannot be their own guardian." };
        }
        if (!(Number(target.age) < 16)) {
            return { success: false, message: "The target must be a child (under 16) to receive a guardian." };
        }
        if (!(Number(source.age) >= 16)) {
            return { success: false, message: "The source must be an adult (16 or older) to become a guardian." };
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
            global_var:votcce_action_target = {
                set_relation_guardian = global_var:votcce_action_source
            }`);
    },

    chatMessage: (args) => {
        return {
            en: `{{character1Name}} became the guardian of {{character2Name}}.`,
            zh: `{{character1Name}}成为了{{character2Name}}的监护人。`,
            ru: `{{character1Name}} стал(а) опекуном {{character2Name}}.`,
            fr: `{{character1Name}} est devenu le tuteur de {{character2Name}}.`,
            es: `{{character1Name}} se convirtió en el tutor de {{character2Name}}.`,
            de: `{{character1Name}} wurde der Vormund von {{character2Name}}.`,
            ja: `{{character1Name}}は{{character2Name}}の後見人になりました。`,
            ko: `{{character1Name}}가 {{character2Name}}의 후견인이 되었습니다.`,
            pl: `{{character1Name}} został(a) opiekunem {{character2Name}}.`,
            pt: `{{character1Name}} tornou-se o tutor de {{character2Name}}.`,
            tr: `{{character1Name}}, {{character2Name}}'nin vasisi oldu.`
        };
    },
    chatMessageClass: "neutral-action-message"
};