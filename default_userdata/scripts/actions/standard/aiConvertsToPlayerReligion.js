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
    description: {
        en: `Executed when {{aiName}} converts to {{playerName}}'s religion, either willingly or forcefully.`,
        zh: `当{{aiName}}自愿或被迫改变信仰，皈依{{playerName}}的宗教时执行`,
        ru: `Выполняется, когда {{aiName}} переходит в религию {{playerName}}, добровольно или принудительно.`,
        fr: `Exécuté lorsque {{aiName}} se convertit à la religion de {{playerName}}, de plein gré ou par la force.`
    },

	
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
        return `{{aiName}}皈依了你的宗教`
    },
    chatMessageClass: "neutral-action-message"
}

