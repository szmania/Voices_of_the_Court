//Made by: Sin

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "playerKillsAI",
    args: [],
	
    description: {
        en: `Executed when {{aiName}} is killed by {{playerName}}.`,
        zh: `当{{aiName}}被杀死时执行。`,
        ru: `Выполняется, когда {{aiName}} убит {{playerName}}.`,
        fr: `Exécuté lorsque {{aiName}} est tué par {{playerName}}.`,
        es: `Ejecutado cuando {{aiName}} es asesinado por {{playerName}}.`,
        de: `Wird ausgeführt, wenn {{aiName}} von {{playerName}} getötet wird.`,
        ja: `{{aiName}}が{{playerName}}に殺されたときに実行されます。`,
        ko: `{{aiName}}가 {{playerName}}에게 살해당했을 때 실행됩니다.`,
        pl: `Wykonywane, gdy {{aiName}} zostaje zabity przez {{playerName}}.`,
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
			global_var:talk_second_scope = {
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
