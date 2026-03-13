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
     */
    check: (gameData) => {
        return true;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) =>{
        runGameEffect(`
			global_var:votcce_action_target = {
				death = {
					death_reason = death_murder killer = root
				}
        }`)
    },
    chatMessage: () => {
        return {
            en: `{{aiName}} was killed.`,
            zh: `{{aiName}}被杀死了。`,
            ru: `{{aiName}} был убит.`,
            fr: `{{aiName}} a été tué.`,
            es: `{{aiName}} fue asesinado.`,
            de: `{{aiName}} wurde getötet.`,
            ja: `{{aiName}}は殺されました。`,
            ko: `{{aiName}}가 살해당했습니다.`,
            pl: `{{aiName}} został zabity.`,
        };
    },
    chatMessageClass: "negative-action-message"
}
