//Made by: Lisiyuan

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "addGoldToTreasury",
    args: [
        {
            name: "amount",
            type: "number",
            min: 1,
            desc: { 
                en: "the amount of gold {{character1Name}}'s treasury gets, should be always positive",
                zh: "{{character1Name}}的国库获得的金币数量，应始终为正数",
                ru: "количество золота, которое получает казна {{character1Name}}, всегда должно быть положительным",
                fr: "le montant d'or que le trésor de {{character1Name}} reçoit, doit toujours être positif",
                es: "la cantidad de oro que recibe el tesoro de {{character1Name}}, siempre debe ser positiva",
                de: "die Menge Gold, die die Schatzkammer von {{character1Name}} erhält, sollte immer positiv sein",
                ja: "{{character1Name}}の財政が受け取るゴールドの量は常に正数である必要があります",
                ko: "{{character1Name}}의 국고가 받는 골드의 양은 항상 양수여야 합니다",
                pl: "ilość złota, którą otrzymuje skarbiec {{character1Name}}, powinna być zawsze dodatnia"
            }
        }
    ],
    description: {
        en: `Executed when a character's treasury receives income.`,
        zh: `当一个角色的国库获得收入时执行`,
        ru: `Выполняется, когда казна персонажа получает доход.`,
        fr: `Exécuté lorsque le trésor d'un personnage reçoit des revenus.`,
        es: `Ejecutado cuando el tesoro de un personaje recibe ingresos.`,
        de: `Wird ausgeführt, wenn die Schatzkammer eines Charakters Einnahmen erhält.`,
        ja: `キャラクターの財政が収入を受け取ったときに実行されます。`,
        ko: `캐릭터의 국고가 수입을 받을 때 실행됩니다.`,
        pl: `Wykonywane, gdy skarbiec postaci otrzymuje dochody.`
    },
    
    /**
     * @param {GameData} gameData 
     * @param {number} initiatorId
     * @param {number} targetId
     */
    check: (gameData, initiatorId, targetId) => {
		return true;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     * @param {number} initiatorId
     * @param {number} targetId
     */
    run: (gameData, runGameEffect, args, initiatorId, targetId) => {
            runGameEffect(`
                global_var:votcce_action_source = {
                    add_treasury_or_gold = ${args[0]};
                }
            `);
        },
    chatMessage: (args) =>{
            return {
                en: `{{character1Name}}'s treasury received ${args[0]} gold.`,
                zh: `{{character1Name}}的国库获得了${args[0]}金币`,
                ru: `Казна {{character1Name}} получила ${args[0]} золота.`,
                fr: `Le trésor de {{character1Name}} a reçu ${args[0]} pièces d'or.`,
                es: `El tesoro de {{character1Name}} recibió ${args[0]} monedas de oro.`,
                de: `Die Schatzkammer von {{character1Name}} erhielt ${args[0]} Goldmünzen.`,
                ja: `{{character1Name}}の財政は${args[0]}ゴールドを受け取りました。`,
                ko: `{{character1Name}}의 국고가 ${args[0]} 골드를 받았습니다.`,
                pl: `Skarbiec {{character1Name}} otrzymał ${args[0]} sztuk złota.`
            }
        }
    ,
    chatMessageClass: "neutral-action-message"
}
