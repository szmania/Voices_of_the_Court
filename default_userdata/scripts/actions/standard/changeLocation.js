//Made by: GitHub Sync

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "changeLocation",
    args: [
        {
            name: "location",
            type: "string",
            desc: "the new location where {{aiName}} moves to"
        }
    ],
    description: {
        en: `Executed when {{aiName}} changes location.`,
        zh: `当{{aiName}}改变位置时执行。`,
        ru: `Выполняется, когда {{aiName}} меняет местоположение.`,
        fr: `Exécuté lorsque {{aiName}} change de lieu.`,
        es: `Ejecutado cuando {{aiName}} cambia de ubicación.`,
        de: `Wird ausgeführt, wenn {{aiName}} den Ort wechselt.`,
        ja: `{{aiName}}が場所を変更したときに実行されます。`,
        ko: `{{aiName}}가 위치를 변경할 때 실행됩니다.`,
        pl: `Wykonywane, gdy {{aiName}} zmienia lokalizację.`
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
    run: (gameData, runGameEffect, args) => {
        runGameEffect(`
            global_var:talk_second_scope = {
                move_character_to_location_effect = {
                    LOCATION = ${args[0]}
                }
            }
        `);
    },
    chatMessage: (args) =>{
        return {
            en: `{{aiName}} moved to ${args[0]}.`,
            zh: `{{aiName}}移动到了${args[0]}。`,
            ru: `{{aiName}} переместился в ${args[0]}.`,
            fr: `{{aiName}} s'est déplacé vers ${args[0]}.`,
            es: `{{aiName}} se trasladó a ${args[0]}.`,
            de: `{{aiName}} ist nach ${args[0]} gezogen.`,
            ja: `{{aiName}}は${args[0]}に移動しました。`,
            ko: `{{aiName}}가 ${args[0]}(으)로 이동했습니다.`,
            pl: `{{aiName}} przeniósł się do ${args[0]}.`
        }
    },
    chatMessageClass: "neutral-action-message"
}
