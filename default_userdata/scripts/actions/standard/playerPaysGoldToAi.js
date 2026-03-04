//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "playerPaysGoldToAi",
    args: [
        {
            name: "amount",
            type: "number",
            desc: "the amount of gold {{playerName}} pays to {{aiName}}"
        }
    ],
    description: {
        en: `Executed when {{playerName}} gives gold to {{aiName}}, only if {{aiName}} accepts it.`,
        zh: `当{{playerName}}给{{aiName}}金币时执行，仅在明确{{aiName}}接受并收取金币时执行。`,
        ru: `Выполняется, когда {{playerName}} дает золото {{aiName}}, только если {{aiName}} принимает его.`,
        fr: `Exécuté lorsque {{playerName}} donne de l'or à {{aiName}}, seulement si {{aiName}} l'accepte.`
 es: `Ejecutado cuando {{playerName}} da oro a {{aiName}}, solo si {{aiName}} lo acepta.`,
 de: `Wird ausgeführt, wenn {{playerName}} {{aiName}} Gold gibt, nur wenn {{aiName}} es annimmt.`,
 ja: `{{playerName}}が{{aiName}}にゴールドを渡すときに実行されます。{{aiName}}が受け入れた場合のみ。`,
 ko: `{{playerName}}가 {{aiName}}에게 골드를 줄 때 실행됩니다. {{aiName}}가 수락하는 경우에만.`,
 pl: `Wykonywane, gdy {{playerName}} daje złoto {{aiName}}, tylko jeśli {{aiName}} to zaakceptuje.`,
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
            add_gold = ${args[0]};
            }

            global_var:talk_first_scope = {
                remove_short_term_gold = ${args[0]};
            }
        `);


        gameData.getPlayer().gold -= args[0];
        gameData.getPlayer().gold += args[0];
    },
    chatMessage: (args) =>{
        return {
            en: `You paid {{aiName}} ${args[0]} gold.`,
            zh: `你向{{aiName}}支付了${args[0]}金币`,
            ru: `Вы заплатили {{aiName}} ${args[0]} золота.`,
            fr: `Vous avez payé ${args[0]} pièces d'or à {{aiName}}.`
 es: `Pagaste ${args[0]} monedas de oro a {{aiName}}.`,
 de: `Du hast {{aiName}} ${args[0]} Goldmünzen gezahlt.`,
 ja: `あなたは{{aiName}}に${args[0]}ゴールドを支払いました。`,
 ko: `당신은 {{aiName}}에게 ${args[0]} 골드를 지불했습니다.`,
 pl: `Zapłaciłeś {{aiName}} ${args[0]} sztuk złota.`,
        }
    },
    chatMessageClass: "neutral-action-message"
}
