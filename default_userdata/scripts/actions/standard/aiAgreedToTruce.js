//Made by: MrAndroPC (based on peace's action)

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "aiAgreedToTruce",
    args: [
        {
            name: "years",
            type: "number",
            desc: "Required argument. Specifies the number of years the truce lasts. Set 3 years as default if not provided."
        }
    ],
    description: {
        en: `Executed when {{aiName}} and {{playerName}} agree to a mutual truce for a certain number of years.`,
        zh: `当{{aiName}}和{{playerName}}同意达成一定年限的相互休战协议时执行。`,
        ru: `Выполняется, когда {{aiName}} и {{playerName}} соглашаются на взаимное перемирие на определенное количество лет.`,
        fr: `Exécuté lorsque {{aiName}} et {{playerName}} conviennent d'une trêve mutuelle pour un certain nombre d'années.`
    },
    
    /**
     * @param {GameData} gameData 
     */
    check: (gameData) => {
        return (gameData.getAi().opinionOfPlayer >= -30);
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
        let truceYears = args.length > 0 ? args[0] : 3; // Default to 3 years if not provided

        runGameEffect(`
            global_var:talk_first_scope = { 
                if = {
                    limit = { 
                        OR = {
                            AND = {
                                max_military_strength:global_var:talk_first_scope >= max_military_strength:global_var:talk_second_scope
                                opinion:global_var:talk_second_scope = { target = talk_first_scope value = { -30 100 } } 
                            }
                            AND = {
                                max_military_strength:global_var:talk_first_scope < max_military_strength:global_var:talk_second_scope
                                opinion:global_var:talk_second_scope = { target = talk_first_scope value = { 30 100 } }
                            }
                        }
                    }
                    add_truce_both_ways = { 
                        character = global_var:talk_second_scope
                        years = ${truceYears}
                        override = yes
                    }
                }
            }
        `);
    },

    chatMessage: (args) => {
        let truceYears = args.length > 0 ? args[0] : 3;
        return {
            en: `{{aiName}} and {{playerName}} agreed to a ${truceYears}-year truce.`,
            zh: `{{aiName}}和{{playerName}}同意了${truceYears}年的休战协议。`,
            ru: `{{aiName}} и {{playerName}} согласились на перемирие на ${truceYears} года.`,
            fr: `{{aiName}} et {{playerName}} ont convenu d'une trêve de ${truceYears} ans.`
        };
    },
    
    chatMessageClass: "positive-action-message"
};
