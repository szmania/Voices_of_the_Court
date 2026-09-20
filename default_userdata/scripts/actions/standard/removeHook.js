//Made by: VOTC-CE

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "removeHook",
    args: [],
    description: {
        en: `Executed when a character forgives or withdraws a hook they hold on another. The source (character1) is the one RELEASING the hook. The target (character2) is the one the hook is removed from.`,
        zh: `当一个角色原谅或撤回对另一个角色所持的把柄时执行。`,
        ru: `Выполняется, когда один персонаж прощает или снимает обязательство, которое он держит на другом.`,
        fr: `Exécuté lorsqu'un personnage pardonne ou retire une faveur qu'il détient sur un autre.`,
        es: `Ejecutado cuando un personaje perdona o retira un favor que tiene sobre otro.`,
        de: `Wird ausgeführt, wenn ein Charakter einen Gefallen vergibt oder zurückzieht, den er über einen anderen hält.`,
        ja: `あるキャラクターが別のキャラクターに対して持っている恩義を許したり撤回したりしたときに実行されます。`,
        ko: `한 캐릭터가 다른 캐릭터에 대해 가진 호의를 용서하거나 철회할 때 실행됩니다.`,
        pl: `Wykonywane, gdy jedna postać wybacza lub wycofuje przysługę, którą trzyma nad inną.`,
        pt: `Executado quando um personagem perdoa ou retira um favor que detém sobre outro.`,
        tr: `Bir karakter başka birinin üzerinde tuttuğu bir iyiliği affettiğinde veya geri çektiğinde çalıştırılır.`
    },

    /**
     * @param {GameData} gameData 
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) => {
        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);
        return !!source && !!target && sourceId !== targetId;
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
            return { success: false, message: "A character cannot remove a hook from themselves." };
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
                remove_hook = { target = global_var:votcce_action_target }
            }`);
    },

    chatMessage: (args) => {
        return {
            en: `{{character1Name}} forgave the hook they held on {{character2Name}}.`,
            zh: `{{character1Name}}原谅了对{{character2Name}}所持的把柄。`,
            ru: `{{character1Name}} простил(а) обязательство, которое держал(а) на {{character2Name}}.`,
            fr: `{{character1Name}} a pardonné la faveur qu'il détenait sur {{character2Name}}.`,
            es: `{{character1Name}} perdonó el favor que tenía sobre {{character2Name}}.`,
            de: `{{character1Name}} hat den Gefallen vergeben, den er über {{character2Name}} hielt.`,
            ja: `{{character1Name}}は{{character2Name}}に対して持っていた恩義を許しました。`,
            ko: `{{character1Name}}가 {{character2Name}}에 대해 가진 호의를 용서했습니다.`,
            pl: `{{character1Name}} wybaczył(a) przysługę, którą trzymał(a) nad {{character2Name}}.`,
            pt: `{{character1Name}} perdoou o favor que detinha sobre {{character2Name}}.`,
            tr: `{{character1Name}}, {{character2Name}} üzerinde tuttuğu iyiliği affetti.`
        };
    },

    chatMessageClass: "neutral-action-message",
    canPerformAtDistance: true
};