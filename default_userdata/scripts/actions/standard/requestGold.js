//Made by: MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "receiveGold",
    args: [
        {
            name: "amount",
            type: "number",
            min: 1,
            desc: { 
                en: "The amount of gold the initiator ({{character1Name}}) receives from the target ({{character2Name}}).",
                zh: "发起者（{{character1Name}}）从目标（{{character2Name}}）收到的金币数量。",
                ru: "Количество золота, которое инициатор ({{character1Name}}) получает от цели ({{character2Name}}).",
                fr: "Le montant d'or que l'initiateur ({{character1Name}}) reçoit de la cible ({{character2Name}}).",
                es: "La cantidad de oro que el iniciador ({{character1Name}}) recibe del objetivo ({{character2Name}}).",
                de: "Die Menge an Gold, die der Initiator ({{character1Name}}) vom Ziel ({{character2Name}}) erhält.",
                ja: "イニシエーター（{{character1Name}}）がターゲット（{{character2Name}}）から受け取るゴールドの量。",
                ko: "개시자({{character1Name}})가 대상({{character2Name}})으로부터 받는 금의 양.",
                pl: "Ilość złota, którą inicjator ({{character1Name}}) otrzymuje od celu ({{character2Name}})."
            }
        }
    ],
    description: {
        en: `Executed when the initiator ({{character1Name}}) receives gold from the target ({{character2Name}}).`,
        zh: `当发起者（{{character1Name}}）从目标（{{character2Name}}）收到金币时执行。`,
        ru: `Выполняется, когда инициатор ({{character1Name}}) получает золото от цели ({{character2Name}}).`,
        fr: `Exécuté lorsque l'initiateur ({{character1Name}}) reçoit de l'or de la cible ({{character2Name}}).`,
        es: `Se ejecuta cuando el iniciador ({{character1Name}}) recibe oro del objetivo ({{character2Name}}).`,
        de: `Wird ausgeführt, wenn der Initiator ({{character1Name}}) vom Ziel ({{character2Name}}) Gold erhält.`,
        ja: `イニシエーター（{{character1Name}}）がターゲット（{{character2Name}}）からゴールドを受け取ったときに実行されます。`,
        ko: `개시자({{character1Name}})가 대상({{character2Name}})으로부터 금을 받을 때 실행됩니다.`,
        pl: `Wykonywane, gdy inicjator ({{character1Name}}) otrzymuje złoto od celu ({{character2Name}}).`
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
                en: `{{character1Name}} received ${args[0]} gold from {{character2Name}}.`,
                zh: `{{character1Name}} 从 {{character2Name}} 收到了 ${args[0]} 金币。`,
                ru: `{{character1Name}} получил ${args[0]} золота от {{character2Name}}.`,
                fr: `{{character1Name}} a reçu ${args[0]} pièces d'or de {{character2Name}}.`,
                es: `{{character1Name}} recibió ${args[0]} de oro de {{character2Name}}.`,
                de: `{{character1Name}} erhielt ${args[0]} Gold von {{character2Name}}.`,
                ja: `{{character1Name}}は{{character2Name}}から${args[0]}ゴールドを受け取りました。`,
                ko: `{{character1Name}}가 {{character2Name}}로부터 ${args[0]} 골드를 받았습니다.`,
                pl: `{{character1Name}} otrzymał ${args[0]} złota od {{character2Name}}.`
            }
        } else {
            return {
                en: `{{character2Name}} does not have enough gold to give to {{character1Name}}.`,
                zh: `{{character2Name}}没有足够的金币给{{character1Name}}。`,
                ru: `У {{character2Name}} недостаточно золота, чтобы дать {{character1Name}}.`,
                fr: `{{character2Name}} n'a pas assez d'or pour donner à {{character1Name}}.`,
                es: `{{character2Name}} no tiene suficiente oro para darle a {{character1Name}}.`,
                de: `{{character2Name}} hat nicht genug Gold, um {{character1Name}} zu geben.`,
                ja: `{{character2Name}}には{{character1Name}}に渡すための十分なゴールドがありません。`,
                ko: `{{character2Name}}에게는 {{character1Name}}에게 줄 충분한 골드가 없습니다.`,
                pl: `{{character2Name}} nie ma wystarczająco złota, aby dać {{character1Name}}.`
            }
        }
    },
    chatMessageClass: "neutral-action-message"
}
