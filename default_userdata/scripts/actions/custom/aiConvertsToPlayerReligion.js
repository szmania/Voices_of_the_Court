//Made by: MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "aiConvertsToPlayerReligion",
    args: [
        {
            name: "isWillinglyConverted",
            type: "boolean",
            desc: "required argument. Should be equal to (true) if {{aiName}} converts willingly and to (false) if forcefully"
        }
    ],
    description: `execute when {{aiName}} converts to {{playerName}} faith either willingly or forcefully against {{aiName}} wish`,

	
    /**
     * @param {GameData} gameData 
     */
    check: (gameData) => {
		
		let ai = gameData.getAi();
		let player = gameData.getPlayer();
		return (ai.faith != player.faith);
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
		if (args[0]) { // if willingly
			runGameEffect(`
				random_list = {
					10 = {
						global_var:talk_second_scope = {
							save_temporary_scope_value_as = {
								name = tmp
								value = global_var:talk_second_scope.faith
							}
							set_character_faith = global_var:talk_first_scope.faith
							make_character_crypto_religionist_effect = {
								CRYPTO_RELIGION = scope:tmp
							}
				}	
					}
					90 = {
						global_var:talk_second_scope = {
							set_character_faith = global_var:talk_first_scope.faith
						}
					}
				}
			`);
		} else {
			runGameEffect(`
				random_list = {
					60 = {
						global_var:talk_second_scope = {
							save_temporary_scope_value_as = {
								name = tmp
								value = global_var:talk_second_scope.faith
							}
							set_character_faith = global_var:talk_first_scope.faith
							make_character_crypto_religionist_effect = {
								CRYPTO_RELIGION = scope:tmp
							}
				}	
					}
					40 = {
						global_var:talk_second_scope = {
							set_character_faith = global_var:talk_first_scope.faith
						}
					}
				}
			`);

		}
 
    },
    chatMessage: (args) =>{
        return `{{aiName}} converted into your religion`
    },
    chatMessageClass: "neutral-action-message"
}

