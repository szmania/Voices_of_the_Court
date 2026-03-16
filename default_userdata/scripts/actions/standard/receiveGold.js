
//Made by: Durond, refactored by machiavelli
/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "receiveGold",
    args: [
        {
            name: "amount",
            type: "number",
            min: 1,
            desc: {
                en: "The amount of gold the RECEIVER (initiator, character1) gets from the GIVER (target, character2).",
                zh: "接收者（发起者，character1）从给予者（目标，character2）获得的金币数量。",
                ru: "Количество золота, которое ПОЛУЧАТЕЛЬ (инициатор, character1) получает от ДАЮЩЕГО (цель, character2).",
                fr: "Le montant d'or que le RECEVEUR (initiateur, character1) reçoit du DONNEUR (cible, character2).",
                es: "La cantidad de oro que el RECEPTOR (iniciador, character1) recibe del DADOR (objetivo, character2).",
                de: "Die Menge an Gold, die der EMPFÄNGER (Initiator, character1) vom GEBER (Ziel, character2) erhält.",
                ja: "受け取る側（イニシエーター、character1）が与える側（ターゲット、character2）から受け取るゴールドの量。",
                ko: "받는 사람(개시자, character1)이 주는 사람(대상, character2)으로부터 받는 금의 양.",
                pl: "Ilość złota, którą ODBIORCA (inicjator, character1) otrzymuje od DARCZYŃCY (cel, character2)."
            }
        }
    ],
    description: {
        en: `Executed when one character receives gold from another. The initiator (character1) is the RECEIVER. The target (character2) is the GIVER.`,
        zh: `当一个角色从另一个角色那里收到金币时执行。发起者（character1）是接收者。目标（character2）是给予者。`,
        ru: `Выполняется, когда один персонаж получает золото от другого. Инициатор (character1) - ПОЛУЧАТЕЛЬ. Цель (character2) - ДАЮЩИЙ.`,
        fr: `Exécuté lorsqu'un personnage reçoit de l'or d'un autre. L'initiateur (character1) est le RECEVEUR. La cible (character2) est le DONNEUR.`,
        es: `Se ejecuta cuando un personaje recibe oro de otro. El iniciador (character1) es el RECEPTOR. El objetivo (character2) es el DADOR.`,
        de: `Wird ausgeführt, wenn ein Charakter von einem anderen Gold erhält. Der Initiator (character1) ist der EMPFÄNGER. Das Ziel (character2) ist der GEBER.`,
        ja: `あるキャラクターが別のキャラクターからゴールドを受け取ったときに実行されます。イニシエーター（character1）は受け取る側です。ターゲット（character2）は与える側です。`,
        ko: `한 캐릭터가 다른 캐릭터로부터 금을 받을 때 실행됩니다. 개시자(character1)는 받는 사람입니다. 대상(character2)은 주는 사람입니다.`,
        pl: `Wykonywane, gdy jedna postać otrzymuje złoto od drugiej. Inicjator (character1) to ODBIORCA. Cel (character2) to DARCZYŃCA.`
    },

    /**
     * @param {GameData} gameData
     * @param {number} initiatorId
     * @param {number} targetId
     */
    check: (gameData, initiatorId, targetId) => {
        const target = gameData.getCharacterById(targetId);
        // Basic check to see if target exists. Gold amount is unknown here.
        return !!target;
    },

    /**
     * @param {GameData} gameData
     * @param {string[]} args
     * @param {number} initiatorId
     * @param {number} targetId
     * @returns {{success: boolean, message?: string}}
     */
    preCheck: (gameData, args, initiatorId, targetId) => {
        const target = gameData.getCharacterById(targetId);
        if (!target) {
            return { success: false, message: "Target character not found." };
        }
        const amount = Number(args[0]);
        if (target.gold < amount) {
            return { success: false, message: `${target.shortName} does not have enough gold (${target.gold}) to give ${amount}.` };
        }
        return { success: true };
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
    },
    chatMessage: (args) =>{
        return {
            en: `{{character1Name}} received ${args[0]} gold from {{character2Name}}.`,
            zh: `{{character1Name}}从{{character2Name}}那里收到了${args[0]}金币。`,
            ru: `{{character1Name}} получил ${args[0]} золота от {{character2Name}}.`,
            fr: `{{character1Name}} a reçu ${args[0]} pièces d'or de {{character2Name}}.`,
            es: `{{character1Name}} recibió ${args[0]} de oro de {{character2Name}}.`,
            de: `{{character1Name}} erhielt ${args[0]} Gold von {{character2Name}}.`,
            ja: `{{character1Name}}は{{character2Name}}から${args[0]}ゴールドを受け取りました。`,
            ko: `{{character1Name}}가 {{character2Name}}로부터 ${args[0]} 골드를 받았습니다.`,
            pl: `{{character1Name}} otrzymał ${args[0]} złota od {{character2Name}}.`
        }
    },
    chatMessageClass: "neutral-action-message"
}
