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
    description: `当{{aiName}}和{{playerName}}同意达成一定年限的相互休战协议时执行。`,
    
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
        return `{{aiName}}和{{playerName}}同意了${truceYears}年的休战协议。`;
    },
    
    chatMessageClass: "positive-action-message"
};
