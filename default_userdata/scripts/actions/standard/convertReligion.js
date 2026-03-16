//Made by: MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "convertReligion",
    args: [
        {
            name: "isWillinglyConverted",
            type: "boolean",
            desc: { 
                en: "required argument. Should be equal to (true) if {{character2Name}} converts willingly and to (false) if forcefully",
                zh: "必需参数。如果{{character2Name}}自愿皈依，则应为(true)，如果强制皈依，则为(false)",
                ru: "обязательный аргумент. Должен быть равен (true), если {{character2Name}} переходит добровольно, и (false), если принудительно",
                fr: "argument requis. Doit être égal à (true) si {{character2Name}} se convertit volontairement et à (false) si c'est par la force",
                es: "argumento requerido. Debe ser igual a (true) si {{character2Name}} se convierte voluntariamente y a (false) si es por la fuerza",
                de: "erforderliches Argument. Sollte (true) sein, wenn {{character2Name}} freiwillig konvertiert, und (false), wenn gewaltsam",
                ja: "必須引数。{{character2Name}}が自発的に改宗する場合は(true)、強制的な場合は(false)に等しくなければなりません",
                ko: "필수 인수. {{character2Name}}가 자발적으로 개종하면 (true), 강제로면 (false)와 같아야 합니다",
                pl: "wymagany argument. Powinien być równy (true), jeśli {{character2Name}} konwertuje dobrowolnie, i (false), jeśli siłą"
            }
        }
    ],
    description: {
        en: `Executed when a character converts to another's religion. The source (character1) is the CONVERTER (their religion is adopted). The target (character2) is the one being CONVERTED.`,
        zh: `当一个角色自愿或被迫改变信仰，皈依另一个角色的宗教时执行`,
        ru: `Выполняется, когда один персонаж переходит в религию другого, добровольно или принудительно.`,
        fr: `Exécuté lorsqu'un personnage se convertit à la religion d'un autre, de plein gré ou par la force.`,
        es: `Ejecutado cuando un personaje se convierte a la religión de otro, voluntariamente o por la fuerza.`,
        de: `Wird ausgeführt, wenn ein Charakter zur Religion eines anderen konvertiert, freiwillig oder gewaltsam.`,
        ja: `あるキャラクターが別のキャラクターの宗教に改宗したときに実行されます。自発的または強制的に。`,
        ko: `한 캐릭터가 다른 캐릭터의 종교로 개종할 때 실행됩니다. 자발적이거나 강제로.`,
        pl: `Wykonywane, gdy jedna postać konwertuje na religię drugiej, dobrowolnie lub siłą.`
    },

	
    /**
     * @param {GameData} gameData 
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) => {
        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);
        if (!source || !target) return false;
		return (target.faith != source.faith);
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     * @param {number} sourceId
     * @param {number} targetId
     */
    run: (gameData, runGameEffect, args, sourceId, targetId) => {
		if (args[0]) { // if willingly
			runGameEffect(`
				random_list = {
					10 = {
						global_var:votcce_action_target = {
							save_temporary_scope_value_as = {
								name = tmp
								value = global_var:votcce_action_target.faith
							}
							set_character_faith = global_var:votcce_action_source.faith
							make_character_crypto_religionist_effect = {
								CRYPTO_RELIGION = scope:tmp
							}
				}	
					}
					90 = {
						global_var:votcce_action_target = {
							set_character_faith = global_var:votcce_action_source.faith
						}
					}
				}
			`);
		} else {
			runGameEffect(`
				random_list = {
					60 = {
						global_var:votcce_action_target = {
							save_temporary_scope_value_as = {
								name = tmp
								value = global_var:votcce_action_target.faith
							}
							set_character_faith = global_var:votcce_action_source.faith
							make_character_crypto_religionist_effect = {
								CRYPTO_RELIGION = scope:tmp
							}
				}	
					}
					40 = {
						global_var:votcce_action_target = {
							set_character_faith = global_var:votcce_action_source.faith
						}
					}
				}
			`);

		}
 
    },
    chatMessage: (args) =>{
        return {
            en: `{{character2Name}} converted to {{character1Name}}'s religion.`,
            zh: `{{character2Name}}皈依了{{character1Name}}的宗教`,
            ru: `{{character2Name}} перешел в религию {{character1Name}}.`,
            fr: `{{character2Name}} s'est converti à la religion de {{character1Name}}.`,
            es: `{{character2Name}} se convirtió a la religión de {{character1Name}}.`,
            de: `{{character2Name}} hat sich zu {{character1Name}}s Religion bekehrt.`,
            ja: `{{character2Name}}は{{character1Name}}の宗教に改宗しました。`,
            ko: `{{character2Name}}가 {{character1Name}}의 종교로 개종했습니다.`,
            pl: `{{character2Name}} przeszedł na religię {{character1Name}}.`
        }
    },
    chatMessageClass: "neutral-action-message"
}

