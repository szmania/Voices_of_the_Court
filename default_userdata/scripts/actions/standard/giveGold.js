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
                en: "The amount of gold the initiator ({{character1Name}}) gives to the target ({{character2Name}}).",
                zh: "发起者（{{character1Name}}）给予目标（{{character2Name}}）的金币数量。",
                ru: "Количество золота, которое инициатор ({{character1Name}}) дает цели ({{character2Name}}).",
                fr: "Le montant d'or que l'initiateur ({{character1Name}}) donne à la cible ({{character2Name}}).",
                es: "La cantidad de oro que el iniciador ({{character1Name}}) da al objetivo ({{character2Name}}).",
                de: "Die Menge an Gold, die der Initiator ({{character1Name}}) dem Ziel ({{character2Name}}) gibt.",
                ja: "イニシエーター（{{character1Name}}）がターゲット（{{character2Name}}）に与えるゴールドの量。",
                ko: "개시자({{character1Name}})가 대상({{character2Name}})에게 주는 금의 양.",
                pl: "Ilość złota, którą inicjator ({{character1Name}}) daje celowi ({{character2Name}})."
            }
        }
    ],
    description: {
        en: `Executed when the initiator ({{character1Name}}) gives gold to the target ({{character2Name}}).`,
        zh: `当发起者（{{character1Name}}）向目标（{{character2Name}}）提供金币时执行。`,
        ru: `Выполняется, когда инициатор ({{character1Name}}) дает золото цели ({{character2Name}}).`,
        fr: `Exécuté lorsque l'initiateur ({{character1Name}}) donne de l'or à la cible ({{character2Name}}).`,
        es: `Se ejecuta cuando el iniciador ({{character1Name}}) da oro al objetivo ({{character2Name}}).`,
        de: `Wird ausgeführt, wenn der Initiator ({{character1Name}}) dem Ziel ({{character2Name}}) Gold gibt.`,
        ja: `イニシエーター（{{character1Name}}）がターゲット（{{character2Name}}）にゴールドを与えたときに実行されます。`,
        ko: `개시자({{character1Name}})가 대상({{character2Name}})에게 금을 줄 때 실행됩니다.`,
        pl: `Wykonywane, gdy inicjator ({{character1Name}}) daje złoto celowi ({{character2Name}}).`,
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
            en: `{{character1Name}} gave {{character2Name}} ${args[0]} gold.`,
            zh: `{{character1Name}}给了{{character2Name}} ${args[0]}金币。`,
            ru: `{{character1Name}} дал {{character2Name}} ${args[0]} золота.`,
            fr: `{{character1Name}} a donné ${args[0]} pièces d'or à {{character2Name}}.`,
            es: `{{character1Name}} le dio a {{character2Name}} ${args[0]} de oro.`,
            de: `{{character1Name}} gab {{character2Name}} ${args[0]} Gold.`,
            ja: `{{character1Name}}は{{character2Name}}に${args[0]}ゴールドを与えました。`,
            ko: `{{character1Name}}가 {{character2Name}}에게 ${args[0]} 골드를 주었습니다.`,
            pl: `{{character1Name}} dał {{character2Name}} ${args[0]} złota.`,
        }
    },
    chatMessageClass: "neutral-action-message"
}
