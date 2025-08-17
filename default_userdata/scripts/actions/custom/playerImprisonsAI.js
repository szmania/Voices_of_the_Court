//Made by: Troller (little modifications by MrAndroPC)

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "playerImprisonsAI",
    args: [
        {
            name: "prisonType",
            type: "string",
            desc: `type of prison {{aiName}} is sent to by {{playerName}} (Must explicitly mention type). Possible values: default if not specified, house_arrest, dungeon`,
        }
    ],
    description: `execute when {{aiName}} gets explicitly imprisoned by {{playerName}}`,
    
    check: (gameData) => {
        let ai = gameData.getAi();
        
        return (!ai.relationsToPlayer.includes("Prisoner"))
    },
    
    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
		let prisonType = args && args[0] ? args[0].toString().trim() : "default";
		
		console.log(`prisonType (before switch): '${prisonType}'`);
		switch (prisonType) {
			case "house_arrest":
                runGameEffect(`
                    if = {
                        limit = {
                            global_var:talk_second_scope = { target_is_liege_or_above = global_var:talk_first_scope }
                        }
                        imprison_character_effect = {
                            TARGET = global_var:talk_second_scope
                            IMPRISONER = global_var:talk_first_scope
                        }
                        global_var:talk_first_scope = { consume_imprisonment_reasons = global_var:talk_second_scope }
                    }
                    else = {
                        rightfully_imprison_character_effect = {
                                TARGET = global_var:talk_second_scope
                                IMPRISONER = global_var:talk_first_scope
                        }            
                    }
                `);
                break;
                
            case "dungeon":
                runGameEffect(`
                    if = {
                        limit = {
                            global_var:talk_second_scope = { target_is_liege_or_above = global_var:talk_first_scope }
                        }
                        imprison_character_effect = {
                            TARGET = global_var:talk_second_scope
                            IMPRISONER = global_var:talk_first_scope
                        }
                        global_var:talk_second_scope = {
                            change_prison_type = dungeon
                        }
                        global_var:talk_first_scope = { consume_imprisonment_reasons = global_var:talk_second_scope }
                    }
                    else = {
                        rightfully_imprison_character_effect = {
                                TARGET = global_var:talk_second_scope
                                IMPRISONER = global_var:talk_first_scope
                        }        
                        global_var:talk_second_scope = {
                            change_prison_type = dungeon
                        }
                    }                        
                `);
                break;

            default:
				console.log(`Default case triggered, prisonType: '${prisonType}'`);
                runGameEffect(`
                    if = {
                        limit = {
                            global_var:talk_second_scope = { target_is_liege_or_above = global_var:talk_first_scope }
                        }
                        imprison_character_effect = {
                            TARGET = global_var:talk_second_scope
                            IMPRISONER = global_var:talk_first_scope
                        }
                        global_var:talk_first_scope = { consume_imprisonment_reasons = global_var:talk_second_scope }
                    }
                    else = {
                        rightfully_imprison_character_effect = {
                                TARGET = global_var:talk_second_scope
                                IMPRISONER = global_var:talk_first_scope
                        }            
                    }
                `);
        }
    },
    
    chatMessage: (args) => {
        let prisonType = args[0];
        switch (prisonType) {
            case 'house_arrest':
                return "{{aiName}} was taken into house arrest.";
            case 'dungeon':
                return "{{aiName}} was taken to the dungeon.";
            default:
                return "{{aiName}} was imprisoned.";
        }
    },
    
    chatMessageClass: "negative-action-message"
};
