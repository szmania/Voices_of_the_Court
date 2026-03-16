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
                en: "The amount of gold the source ({{character1Name}}) gives to the target ({{character2Name}}).",
                zh: "发起者（{{character1Name}}）给予目标（{{character2Name}}）的金币数量。",
                ru: "Количество золота, которое инициатор ({{character1Name}}) дает цели ({{character2Name}}).",
                fr: "Le montant d'or que l'initiateur ({{character1Name}}) donne à la cible ({{character2Name}}).",
                es: "La cantidad de oro que el iniciador ({{character1Name}}) da al objetivo ({{character2Name}}).",
                de: "Die Menge an Gold, die der Source ({{character1Name}}) dem Ziel ({{character2Name}}) gibt.",
                ja: "イニシエーター（{{character1Name}}）がターゲット（{{character2Name}}）に与えるゴールドの量。",
                ko: "개시자({{character1Name}})가 대상({{character2Name}})에게 주는 금의 양.",
                pl: "Ilość złota, którą inicjator ({{character1Name}}) daje celowi ({{character2Name}})."
            }
        }
    ],
    description: {
        en: `Executed when one character gives gold to another. The source (character1) is the GIVER. The target (character2) is the RECEIVER.`,
        zh: `当一个角色向另一个角色提供金币时执行。发起者（character1）是给予者。目标（character2）是接收者。`,
        ru: `Выполняется, когда один персонаж дает золото другому. Инициатор (character1) - ДАЮЩИЙ. Цель (character2) - ПОЛУЧАТЕЛЬ.`,
        fr: `Exécuté lorsqu'un personnage donne de l'or à un autre. L'initiateur (character1) est le DONNEUR. La cible (character2) est le RECEVEUR.`,
        es: `Se ejecuta cuando un personaje da oro a otro. El iniciador (character1) es el DADOR. El objetivo (character2) es el RECEPTOR.`,
        de: `Wird ausgeführt, wenn ein Charakter einem anderen Gold gibt. Der Source (character1) ist der GEBER. Das Ziel (character2) ist der EMPFÄNGER.`,
        ja: `あるキャラクターが別のキャラクターにゴールドを与えたときに実行されます。イニシエーター（character1）は与える側です。ターゲット（character2）は受け取る側です。`,
        ko: `한 캐릭터가 다른 캐릭터에게 금을 줄 때 실행됩니다. 개시자(character1)는 주는 사람입니다. 대상(character2)은 받는 사람입니다.`,
        pl: `Wykonywane, gdy jedna postać daje złoto drugiej. Inicjator (character1) to DARCZYŃCA. Cel (character2) to ODBIORCA.`,
    },

    /**
     * @param {GameData} gameData
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) => {
        const source = gameData.getCharacterById(sourceId);
        return source ? source.gold >= 1 : false;
    },

    /**
     * @param {GameData} gameData
     * @param {string[]} args
     * @param {number} sourceId
     * @param {number} targetId
     * @returns {{success: boolean, message?: string}}
     */
    preCheck: (gameData, args, sourceId, targetId) => {
        const source = gameData.getCharacterById(sourceId);
        if (!source) {
            return { success: false, message: "Source character not found." };
        }
        const amount = Number(args[0]);
        if (source.gold < amount) {
            return { success: false, message: `${source.shortName} does not have enough gold (${source.gold}) to give ${amount}.` };
        }
        return { success: true };
    },

    /**
     * @param {GameData} gameData
     * @param {Function} runGameEffect
     * @param {string[]} args
     * @param {number} sourceId
     * @param {number} targetId
     */
    run: (gameData, runGameEffect, args, sourceId, targetId) => {
        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);
        if (!source || !target) return;

        const amount = Number(args[0]);
        if (source.gold >= amount) {
            runGameEffect(`
                global_var:votcce_action_target = {
                add_gold = ${amount};
                }

                global_var:votcce_action_source = {
                    remove_short_term_gold = ${amount};
                }
            `);

            source.gold -= amount;
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
