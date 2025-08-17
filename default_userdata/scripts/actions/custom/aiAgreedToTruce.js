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
    description: `Execute when {{aiName}} and {{playerName}} agree to a mutual truce for a certain number of years.`,
    
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
        return `{{aiName}} and {{playerName}} agreed to a ${truceYears}-year truce.`;
    },
    
    chatMessageClass: "positive-action-message"
};
