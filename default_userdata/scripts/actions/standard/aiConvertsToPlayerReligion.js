//Made by: MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "aiConvertsToPlayerReligion",
    args: [
        {
            name: "isWillinglyConverted",
            type: "boolean",
            desc: { 
                en: "required argument. Should be equal to (true) if {{aiName}} converts willingly and to (false) if forcefully",
                zh: "必需参数。如果{{aiName}}自愿皈依，则应为(true)，如果强制皈依，则为(false)",
                ru: "обязательный аргумент. Должен быть равен (true), если {{aiName}} переходит добровольно, и (false), если принудительно",
                fr: "argument requis. Doit être égal à (true) si {{aiName}} se convertit volontairement et à (false) si c'est par la force",
                es: "argumento requerido. Debe ser igual a (true) si {{aiName}} se convierte voluntariamente y a (false) si es por la fuerza",
                de: "erforderliches Argument. Sollte (true) sein, wenn {{aiName}} freiwillig konvertiert, und (false), wenn gewaltsam",
                ja: "必須引数。{{aiName}}が自発的に改宗する場合は(true)、強制的な場合は(false)に等しくなければなりません",
                ko: "필수 인수. {{aiName}}가 자발적으로 개종하면 (true), 강제로면 (false)와 같아야 합니다",
                pl: "wymagany argument. Powinien być równy (true), jeśli {{aiName}} konwertuje dobrowolnie, i (false), jeśli siłą"
            }
        }
    ],
    description: {
        en: `Executed when {{aiName}} converts to {{playerName}}'s religion, either willingly or forcefully.`,
        zh: `当{{aiName}}自愿或被迫改变信仰，皈依{{playerName}}的宗教时执行`,
        ru: `Выполняется, когда {{aiName}} переходит в религию {{playerName}}, добровольно или принудительно.`,
        fr: `Exécuté lorsque {{aiName}} se convertit à la religion de {{playerName}}, de plein gré ou par la force.`,
        es: `Ejecutado cuando {{aiName}} se convierte a la religión de {{playerName}}, voluntariamente o por la fuerza.`,
        de: `Wird ausgeführt, wenn {{aiName}} zur Religion von {{playerName}} konvertiert, freiwillig oder gewaltsam.`,
        ja: `{{aiName}}が{{playerName}}の宗教に改宗したときに実行されます。自発的または強制的に。`,
        ko: `{{aiName}}가 {{playerName}}의 종교로 개종할 때 실행됩니다. 자발적이거나 강제로.`,
        pl: `Wykonywane, gdy {{aiName}} konwertuje na religię {{playerName}}, dobrowolnie lub siłą.`
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
        return {
            en: `{{aiName}} converted to your religion.`,
            zh: `{{aiName}}皈依了你的宗教`,
            ru: `{{aiName}} перешел в вашу религию.`,
            fr: `{{aiName}} s'est converti à votre religion.`,
            es: `{{aiName}} se convirtió a tu religión.`,
            de: `{{aiName}} hat sich zu deiner Religion bekehrt.`,
            ja: `{{aiName}}はあなたの宗教に改宗しました。`,
            ko: `{{aiName}}가 당신의 종교로 개종했습니다.`,
            pl: `{{aiName}} przeszedł na twoją religię.`
        }
    },
    chatMessageClass: "neutral-action-message"
}

