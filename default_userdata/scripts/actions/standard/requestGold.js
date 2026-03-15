//Made by: MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "requestGold",
    args: [
        {
            name: "amount",
            type: "number",
            min: 1,
            desc: { 
                en: "The amount of gold the initiator ({{character1Name}}) requests from the target ({{character2Name}}).",
                zh: "发起者（{{character1Name}}）向目标（{{character2Name}}）请求的金币数量。",
                ru: "Количество золота, которое инициатор ({{character1Name}}) запрашивает у цели ({{character2Name}}).",
                fr: "Le montant d'or que l'initiateur ({{character1Name}}) demande à la cible ({{character2Name}}).",
                es: "La cantidad de oro que el iniciador ({{character1Name}}) solicita al objetivo ({{character2Name}}).",
                de: "Die Menge an Gold, die der Initiator ({{character1Name}}) vom Ziel ({{character2Name}}) anfordert.",
                ja: "イニシエーター（{{character1Name}}）がターゲット（{{character2Name}}）に要求するゴールドの量。",
                ko: "개시자({{character1Name}})가 대상({{character2Name}})에게 요청하는 금의 양.",
                pl: "Ilość złota, którą inicjator ({{character1Name}}) prosi od celu ({{character2Name}})."
            }
        }
    ],
    description: {
        en: `Executed when the initiator ({{character1Name}}) requests gold from the target ({{character2Name}}), and the target gives it.`,
        zh: `当发起者（{{character1Name}}）向目标（{{character2Name}}）请求金币，并且目标给予时执行。`,
        ru: `Выполняется, когда инициатор ({{character1Name}}) запрашивает золото у цели ({{character2Name}}), и цель его дает.`,
        fr: `Exécuté lorsque l'initiateur ({{character1Name}}) demande de l'or à la cible ({{character2Name}}), et que la cible le donne.`,
        es: `Se ejecuta cuando el iniciador ({{character1Name}}) solicita oro al objetivo ({{character2Name}}), y el objetivo se lo da.`,
        de: `Wird ausgeführt, wenn der Initiator ({{character1Name}}) vom Ziel ({{character2Name}}) Gold anfordert und das Ziel es gibt.`,
        ja: `イニシエーター（{{character1Name}}）がターゲット（{{character2Name}}）にゴールドを要求し、ターゲットがそれを与えたときに実行されます。`,
        ko: `개시자({{character1Name}})가 대상({{character2Name}})에게 금을 요청하고 대상이 그것을 줄 때 실행됩니다.`,
        pl: `Wykonywane, gdy inicjator ({{character1Name}}) prosi o złoto od celu ({{character2Name}}), a cel je daje.`
    },
    
    /**
     * @param {GameData} gameData 
     * @param {number} initiatorId
     * @param {number} targetId
     */
    check: (gameData, initiatorId, targetId) => {
        const target = gameData.getCharacterById(targetId);
		return target ? target.gold > 20 : false;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     * @param {number} initiatorId
     * @param {number} targetId
     */
    run: (gameData, runGameEffect, args, initiatorId, targetId) => {
        const initiator = gameData.getCharacterById(initiatorId);
        const target = gameData.getCharacterById(targetId);
        if (!initiator || !target) return;

        const amount = Number(args[0]);
        args[1] = target.gold; // For chatMessage logic
        if (amount <= target.gold) {
            runGameEffect(`
                global_var:votcce_action_source = {
                    add_gold = ${amount};
                }

                global_var:votcce_action_target = {
                    remove_short_term_gold = ${amount};
                }
            `);
            initiator.gold += amount;
            target.gold -= amount;
        }
    },
    chatMessage: (args) => {
        if (Number(args[0]) <= Number(args[1])) {
            return {
                en: `{{character2Name}} gave {{character1Name}} ${args[0]} gold.`,
                zh: `{{character2Name}}给了{{character1Name}} ${args[0]}金币。`,
                ru: `{{character2Name}} дал {{character1Name}} ${args[0]} золота.`,
                fr: `{{character2Name}} a donné ${args[0]} pièces d'or à {{character1Name}}.`,
                es: `{{character2Name}} le dio a {{character1Name}} ${args[0]} de oro.`,
                de: `{{character2Name}} gab {{character1Name}} ${args[0]} Gold.`,
                ja: `{{character2Name}}は{{character1Name}}に${args[0]}ゴールドを与えました。`,
                ko: `{{character2Name}}가 {{character1Name}}에게 ${args[0]} 골드를 주었습니다.`,
                pl: `{{character2Name}} dał {{character1Name}} ${args[0]} złota.`
            }
        } else {
            return {
                en: `{{character2Name}} does not have enough gold to pay {{character1Name}}.`,
                zh: `{{character2Name}}没有足够的金币支付给{{character1Name}}`,
                ru: `У {{character2Name}} недостаточно золота для оплаты {{character1Name}}.`,
                fr: `{{character2Name}} n'a pas assez d'or pour payer {{character1Name}}.`,
                es: `{{character2Name}} no tiene suficiente oro para pagar a {{character1Name}}.`,
                de: `{{character2Name}} hat nicht genug Gold, um {{character1Name}} zu bezahlen.`,
                ja: `{{character2Name}}には{{character1Name}}に支払うための十分なゴールドがありません。`,
                ko: `{{character2Name}}에게는 {{character1Name}}에게 지불할 충분한 골드가 없습니다.`,
                pl: `{{character2Name}} nie ma wystarczająco złota, aby zapłacić {{character1Name}}.`
            }
        }
    },
    chatMessageClass: "neutral-action-message"
}
