//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "giveGold",
    args: [
        {
            name: "amount",
            type: "number",
            min: 1,
            desc: { 
                en: "the amount of gold {{character1Name}} pays to {{character2Name}}",
                zh: "{{character1Name}}支付给{{character2Name}}的金币数量",
                ru: "количество золота, которое {{character1Name}} платит {{character2Name}}",
                fr: "le montant d'or que {{character1Name}} paie à {{character2Name}}",
                es: "la cantidad de oro que {{character1Name}} paga a {{character2Name}}",
                de: "die Menge Gold, die {{character1Name}} an {{character2Name}} zahlt",
                ja: "{{character1Name}}が{{character2Name}}に支払うゴールドの量",
                ko: "{{character1Name}}가 {{character2Name}}에게 지불하는 골드의 양",
                pl: "ilość złota, którą {{character1Name}} płaci {{character2Name}}"
            }
        }
    ],
    description: {
        en: `Executed when a character gives gold to another, only if the recipient accepts it.`,
        zh: `当一个角色给另一个角色金币时执行，仅在明确收款人接受并收取金币时执行。`,
        ru: `Выполняется, когда один персонаж дает золото другому, только если получатель принимает его.`,
        fr: `Exécuté lorsqu'un personnage donne de l'or à un autre, seulement si le destinataire l'accepte.`,
        es: `Ejecutado cuando un personaje da oro a otro, solo si el destinatario lo acepta.`,
        de: `Wird ausgeführt, wenn ein Charakter einem anderen Gold gibt, nur wenn der Empfänger es annimmt.`,
        ja: `あるキャラクターが別のキャラクターにゴールドを渡すときに実行されます。受け取り人が受け入れた場合のみ。`,
        ko: `한 캐릭터가 다른 캐릭터에게 골드를 줄 때 실행됩니다. 수령인이 수락하는 경우에만.`,
        pl: `Wykonywane, gdy jedna postać daje złoto drugiej, tylko jeśli odbiorca to zaakceptuje.`,
    },

    /**
     * @param {GameData} gameData 
     * @param {number} initiatorId
     * @param {number} targetId
     */
    check: (gameData, initiatorId, targetId) => {
        const initiator = gameData.getCharacterById(initiatorId);
        return initiator ? initiator.gold >= 1 : false;
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
        if (initiator.gold >= amount) {
            runGameEffect(`
                global_var:votcce_action_target = {
                add_gold = ${amount};
                }

                global_var:votcce_action_source = {
                    remove_short_term_gold = ${amount};
                }
            `);

            initiator.gold -= amount;
            target.gold += amount;
        }
    },
    chatMessage: (args) =>{
        return {
            en: `{{character1Name}} paid {{character2Name}} ${args[0]} gold.`,
            zh: `{{character1Name}}向{{character2Name}}支付了${args[0]}金币`,
            ru: `{{character1Name}} заплатил {{character2Name}} ${args[0]} золота.`,
            fr: `{{character1Name}} a payé ${args[0]} pièces d'or à {{character2Name}}.`,
            es: `{{character1Name}} pagó ${args[0]} monedas de oro a {{character2Name}}.`,
            de: `{{character1Name}} hat {{character2Name}} ${args[0]} Goldmünzen gezahlt.`,
            ja: `{{character1Name}}は{{character2Name}}に${args[0]}ゴールドを支払いました.`,
            ko: `{{character1Name}}는 {{character2Name}}에게 ${args[0]} 골드를 지불했습니다.`,
            pl: `{{character1Name}} zapłacił {{character2Name}} ${args[0]} sztuk złota.`,
        }
    },
    chatMessageClass: "neutral-action-message"
}
