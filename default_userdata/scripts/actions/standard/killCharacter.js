//Made by: Sin

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "killCharacter",
    args: [],
	
    description: {
        en: `Executed when a character is killed by another.`,
        zh: `当一个角色被另一个角色杀死时执行。`,
        ru: `Выполняется, когда один персонаж убит другим.`,
        fr: `Exécuté lorsqu'un personnage est tué par un autre.`,
        es: `Ejecutado cuando un personaje es asesinado por otro.`,
        de: `Wird ausgeführt, wenn ein Charakter von einem anderen getötet wird.`,
        ja: `あるキャラクターが別のキャラクターに殺されたときに実行されます。`,
        ko: `한 캐릭터가 다른 캐릭터에게 살해당했을 때 실행됩니다.`,
        pl: `Wykonywane, gdy jedna postać zostaje zabita przez inną.`,
    },

    /**
     * @param {GameData} gameData
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) => {
        return true;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     * @param {number} sourceId
     * @param {number} targetId
     */
    run: (gameData, runGameEffect, args, sourceId, targetId) =>{
        runGameEffect(`
			global_var:votcce_action_target = {
				death = {
					death_reason = death_murder killer = global_var:votcce_action_source
				}
        }`)
    },
    chatMessage: () => {
        return {
            en: `{{character2Name}} was killed by {{character1Name}}.`,
            zh: `{{character2Name}}被{{character1Name}}杀死了。`,
            ru: `{{character2Name}} был убит {{character1Name}}.`,
            fr: `{{character2Name}} a été tué par {{character1Name}}.`,
            es: `{{character2Name}} fue asesinado por {{character1Name}}.`,
            de: `{{character2Name}} wurde von {{character1Name}} getötet.`,
            ja: `{{character2Name}}は{{character1Name}}に殺されました。`,
            ko: `{{character2Name}}가 {{character1Name}}에게 살해당했습니다.`,
            pl: `{{character2Name}} został zabity przez {{character1Name}}.`,
        };
    },
    chatMessageClass: "negative-action-message"
}
