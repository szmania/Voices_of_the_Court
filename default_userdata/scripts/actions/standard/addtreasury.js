//Made by: Lisiyuan

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "addTreasury",
    args: [
        {
            name: "amount",
            type: "number",
            min: 1,
            desc: { 
                en: "the amount of gold {{playerName}}'s treasury gets, should be always positive",
                zh: "{{playerName}}的国库获得的金币数量，应始终为正数",
                ru: "количество золота, которое получает казна {{playerName}}, всегда должно быть положительным",
                fr: "le montant d'or que le trésor de {{playerName}} reçoit, doit toujours être positif",
                es: "la cantidad de oro que recibe el tesoro de {{playerName}}, siempre debe ser positiva",
                de: "die Menge Gold, die die Schatzkammer von {{playerName}} erhält, sollte immer positiv sein",
                ja: "{{playerName}}の財政が受け取るゴールドの量は常に正数である必要があります",
                ko: "{{playerName}}의 국고가 받는 골드의 양은 항상 양수여야 합니다",
                pl: "ilość złota, którą otrzymuje skarbiec {{playerName}}, powinna być zawsze dodatnia"
            }
        }
    ],
    description: {
        en: `Executed when {{playerName}}'s treasury receives income.`,
        zh: `当{{playerName}}的国库获得收入时执行`,
        ru: `Выполняется, когда казна {{playerName}} получает доход.`,
        fr: `Exécuté lorsque le trésor de {{playerName}} reçoit des revenus.`,
        es: `Ejecutado cuando el tesoro de {{playerName}} recibe ingresos.`,
        de: `Wird ausgeführt, wenn die Schatzkammer von {{playerName}} Einnahmen erhält.`,
        ja: `{{playerName}}の財政が収入を受け取ったときに実行されます。`,
        ko: `{{playerName}}의 국고가 수입을 받을 때 실행됩니다.`,
        pl: `Wykonywane, gdy skarbiec {{playerName}} otrzymuje dochody.`
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
                global_var:votcce_action_source = {
                    add_treasury_or_gold = ${args[0]};
                }
            `);
        },
    chatMessage: (args) =>{
            return {
                en: `{{playerName}}'s treasury received ${args[0]} gold.`,
                zh: `{{playerName}}的国库获得了${args[0]}金币`,
                ru: `Казна {{playerName}} получила ${args[0]} золота.`,
                fr: `Le trésor de {{playerName}} a reçu ${args[0]} pièces d'or.`,
                es: `El tesoro de {{playerName}} recibió ${args[0]} monedas de oro.`,
                de: `Die Schatzkammer von {{playerName}} erhielt ${args[0]} Goldmünzen.`,
                ja: `{{playerName}}の財政は${args[0]}ゴールドを受け取りました。`,
                ko: `{{playerName}}의 국고가 ${args[0]} 골드를 받았습니다.`,
                pl: `Skarbiec {{playerName}} otrzymał ${args[0]} sztuk złota.`
            }
        }
    ,
    chatMessageClass: "neutral-action-message"
}
