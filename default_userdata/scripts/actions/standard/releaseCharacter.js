//Made by: VOTC-CE

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "releaseCharacter",
    args: [],
    description: {
        en: `Executed when a character is released from prison by another. The source (character1) is the one RELEASING. The target (character2) is the one being RELEASED.`,
        zh: `当一个角色被另一个角色释放出狱时执行。`,
        ru: `Выполняется, когда один персонаж освобождает другого из тюрьмы.`,
        fr: `Exécuté lorsqu'un personnage est libéré de prison par un autre.`,
        es: `Ejecutado cuando un personaje es liberado de prisión por otro.`,
        de: `Wird ausgeführt, wenn ein Charakter von einem anderen aus dem Gefängnis entlassen wird.`,
        ja: `あるキャラクターが別のキャラクターによって刑務所から解放されたときに実行されます。`,
        ko: `한 캐릭터가 다른 캐릭터에 의해 감옥에서 석방되었을 때 실행됩니다.`,
        pl: `Wykonywane, gdy jedna postać zostaje zwolniona z więzienia przez inną.`,
        pt: `Executado quando um personagem é libertado da prisão por outro.`,
        tr: `Bir karakter başka biri tarafından hapisten serbest bırakıldığında çalıştırılır.`
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

        // Check if target is already a prisoner of the source
        const relationToSource = target.relationsToCharacters.find(r => r.id === sourceId);
        return !!(relationToSource && relationToSource.relations.includes("Prisoner"));
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

        // Target must already be a prisoner of the source to be released
        const relationToSource = target.relationsToCharacters.find(r => r.id === sourceId);
        const isPrisoner = !!(relationToSource && relationToSource.relations.includes("Prisoner"));
        if (!isPrisoner) {
            return { success: false, message: "The target is not a prisoner of the source and cannot be released." };
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
        console.log(`Releasing character ${targetId} from prison by ${sourceId}`);
        runGameEffect(`
            global_var:votcce_action_target = {
                release_from_prison = yes
            }`);
    },

    chatMessage: (args) => {
        return {
            en: `{{character1Name}} released {{character2Name}} from prison.`,
            zh: `{{character1Name}}将{{character2Name}}释放出狱。`,
            ru: `{{character1Name}} освободил(а) {{character2Name}} из тюрьмы.`,
            fr: `{{character1Name}} a libéré {{character2Name}} de prison.`,
            es: `{{character1Name}} liberó a {{character2Name}} de prisión.`,
            de: `{{character1Name}} hat {{character2Name}} aus dem Gefängnis entlassen.`,
            ja: `{{character1Name}}は{{character2Name}}を刑務所から解放しました。`,
            ko: `{{character1Name}}가 {{character2Name}}를 감옥에서 석방했습니다.`,
            pl: `{{character1Name}} zwolnił(a) {{character2Name}} z więzienia.`,
            pt: `{{character1Name}} libertou {{character2Name}} da prisão.`,
            tr: `{{character1Name}}, {{character2Name}}'yi hapisten serbest bıraktı.`
        };
    },

    chatMessageClass: "neutral-action-message",
    canPerformAtDistance: false
};