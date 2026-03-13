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
                en: "the amount of gold {{aiName}} pays to {{playerName}}, should be always positive",
                zh: "{{aiName}}支付给{{playerName}}的金币数量，应始终为正数",
                ru: "количество золота, которое {{aiName}} платит {{playerName}}, всегда должно быть положительным",
                fr: "le montant d'or que {{aiName}} paie à {{playerName}}, doit toujours être positif",
                es: "la cantidad de oro que {{aiName}} paga a {{playerName}}, siempre debe ser positiva",
                de: "die Menge Gold, die {{aiName}} an {{playerName}} zahlt, sollte immer positiv sein",
                ja: "{{aiName}}が{{playerName}}に支払うゴールドの量は常に正数である必要があります",
                ko: "{{aiName}}가 {{playerName}}에게 지불하는 골드의 양은 항상 양수여야 합니다",
                pl: "ilość złota, którą {{aiName}} płaci {{playerName}}, powinna być zawsze dodatnia"
            }
        }
    ],
    description: {
        en: `Executed when a character requests gold from another, who may pay willingly or forcefully, only if they have enough gold.`,
        zh: `当一个角色向另一个角色请求金币时执行，对方可能会自愿或被迫支付，前提是他们有足够的金币。`,
        ru: `Выполняется, когда один персонаж запрашивает золото у другого, который может заплатить добровольно или принудительно, только если у него достаточно золота.`,
        fr: `Exécuté lorsqu'un personnage demande de l'or à un autre, qui peut payer de gré ou de force, seulement s'il a assez d'or.`,
        es: `Ejecutado cuando un personaje solicita oro a otro, quien puede pagar voluntariamente o por la fuerza, solo si tiene suficiente oro.`,
        de: `Wird ausgeführt, wenn ein Charakter von einem anderen Gold anfordert, der freiwillig oder gezwungen zahlen kann, nur wenn er genug Gold hat.`,
        ja: `あるキャラクターが別のキャラクターにゴールドを要求したときに実行されます。相手は自発的または強制的に支払うことができ、十分なゴールドを持っている場合のみです。`,
        ko: `한 캐릭터가 다른 캐릭터에게 골드를 요청할 때 실행되며, 상대방은 자발적이든 강제적이든 충분한 골드가 있는 경우에만 지불할 수 있습니다.`,
        pl: `Wykonywane, gdy jedna postać prosi o złoto od drugiej, która może zapłacić dobrowolnie lub siłą, tylko jeśli ma wystarczająco złota.`
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
                en: `{{character2Name}} paid {{character1Name}} ${args[0]} gold.`,
                zh: `{{character2Name}}向{{character1Name}}支付了${args[0]}金币`,
                ru: `{{character2Name}} заплатил {{character1Name}} ${args[0]} золота.`,
                fr: `{{character2Name}} a payé ${args[0]} pièces d'or à {{character1Name}}.`,
                es: `{{character2Name}} pagó ${args[0]} monedas de oro a {{character1Name}}.`,
                de: `{{character2Name}} hat {{character1Name}} ${args[0]} Goldmünzen gezahlt.`,
                ja: `{{character2Name}}は{{character1Name}}に${args[0]}ゴールドを支払いました。`,
                ko: `{{character2Name}}가 {{character1Name}}에게 ${args[0]} 골드를 지불했습니다.`,
                pl: `{{character2Name}} zapłacił {{character1Name}} ${args[0]} sztuk złota.`
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
