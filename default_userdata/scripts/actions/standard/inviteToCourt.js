//Made by: VOTC-CE

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

module.exports = {
    signature: "inviteToCourt",
    args: [],
    description: {
        en: `Executed when a character invites another to their court. The source (character1) is the one EXTENDING the invitation (must be a ruler with a court). The target (character2) is the one being WELCOMED (must not be a landed ruler or already at the source's court).`,
        zh: `当一个角色邀请另一个角色加入其宫廷时执行。源（character1）必须是拥有宫廷的统治者，而目标（character2）不能是领地统治者或已身处源宫廷。`,
        ru: `Выполняется, когда один персонаж приглашает другого к своему двору. Источник (персонаж 1) должен быть правителем с двором, а цель (персонаж 2) не может быть держащим землю правителем или уже находиться при дворе источника.`,
        fr: `Exécuté lorsqu'un personnage en invite un autre à sa cour. La source (personnage 1) doit être un dirigeant avec une cour, et la cible (personnage 2) ne doit pas être un dirigeant foncier ni déjà à la cour de la source.`,
        es: `Ejecutado cuando un personaje invita a otro a su corte. El origen (character1) debe ser un gobernante con corte, y el objetivo (character2) no debe ser un gobernante con tierras ni estar ya en la corte del origen.`,
        de: `Wird ausgeführt, wenn ein Charakter einen anderen an seinen Hof einlädt. Die Quelle (Charakter 1) muss ein Herrscher mit Hof sein, und das Ziel (Charakter 2) darf kein Land besitzender Herrscher sein oder bereits am Hof der Quelle weilend.`,
        ja: `あるキャラクターが別のキャラクターを自らの宮廷に招いたときに実行されます。ソース（キャラクター1）は宮廷を持つ統治者である必要があり、ターゲット（キャラクター2）は領地統治者でも、すでにソースの宮廷にいる者でもあってはなりません。`,
        ko: `한 캐릭터가 다른 캐릭터를 자신의 궁정으로 초대할 때 실행됩니다. 소스(캐릭터 1)는 궁정을 가진 통치자여야 하며, 대상(캐릭터 2)은 영지 통치자이거나 이미 소스의 궁정에 있어서는 안 됩니다.`,
        pl: `Wykonywane, gdy jedna postać zaprasza inną na swój dwór. Źródło (postać 1) musi być władcą z dworem, a cel (postać 2) nie może być władcą posiadającym ziemie ani już przebywać na dworze źródła.`,
        pt: `Executado quando um personagem convida outro para sua corte. A fonte (personagem 1) deve ser um governante com uma corte, e o alvo (personagem 2) não deve ser um governante com terras nem já estar na corte da fonte.`,
        tr: `Bir karakter başka birini sarayına davet ettiğinde çalıştırılır. Kaynak (character1) sarayı olan bir hükümdar olmalıdır ve hedef (character2) toprak sahibi bir hükümdar olmamalı ya da zaten kaynağın sarayında bulunmamalıdır.`
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

        // Source must be a ruler with a court to invite anyone to
        if (!source.isRuler) return false;

        // Target must not be a landed ruler of their own realm
        if (target.isLandedRuler) return false;

        // Target must not already be a courtier/guest of the source
        const alreadyAtSourceCourt = target.liege === source.fullName || target.liege === source.shortName;
        if (alreadyAtSourceCourt) return false;

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
            return { success: false, message: "A character cannot invite themselves to their own court." };
        }

        if (!source.isRuler) {
            return { success: false, message: "The source must be a ruler with a court to extend an invitation." };
        }

        if (target.isLandedRuler) {
            return { success: false, message: "The target is a landed ruler and cannot join another court." };
        }

        const alreadyAtSourceCourt = target.liege === source.fullName || target.liege === source.shortName;
        if (alreadyAtSourceCourt) {
            return { success: false, message: "The target is already at the source's court." };
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
            global_var:votcce_action_source = {
                add_courtier = global_var:votcce_action_target
            }`);
    },

    chatMessage: (args) => {
        return {
            en: `{{character1Name}} invited {{character2Name}} to their court.`,
            zh: `{{character1Name}}邀请了{{character2Name}}加入其宫廷。`,
            ru: `{{character1Name}} пригласил(а) {{character2Name}} к своему двору.`,
            fr: `{{character1Name}} a invité {{character2Name}} à sa cour.`,
            es: `{{character1Name}} invitó a {{character2Name}} a su corte.`,
            de: `{{character1Name}} hat {{character2Name}} an seinen Hof eingeladen.`,
            ja: `{{character1Name}}は{{character2Name}}を自らの宮廷に招待しました。`,
            ko: `{{character1Name}}이(가) {{character2Name}}를 자신의 궁정으로 초대했습니다.`,
            pl: `{{character1Name}} zaprosił(a) {{character2Name}} na swój dwór.`,
            pt: `{{character1Name}} convidou {{character2Name}} para sua corte.`,
            tr: `{{character1Name}}, {{character2Name}}'i sarayına davet etti.`
        };
    },

    chatMessageClass: "neutral-action-message",
    canPerformAtDistance: false
};