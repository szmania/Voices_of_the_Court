//Made by: Troller (little modifications by MrAndroPC)

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "playerImprisonsAI",
    args: [
        {
            name: "prisonType",
            type: "string",
            options: [
                { value: 'default', display: { en: 'Default Prison', zh: '默认监狱', ru: 'Обычная тюрьма', fr: 'Prison par défaut', es: 'Prisión por defecto', de: 'Standardgefängnis' }},
                { value: 'house_arrest', display: { en: 'House Arrest', zh: '软禁', ru: 'Домашний арест', fr: 'Assignation à résidence', es: 'Arresto domiciliario', de: 'Hausarrest' }},
                { value: 'dungeon', display: { en: 'Dungeon', zh: '地牢', ru: 'Темница', fr: 'Donjon', es: 'Calabozo', de: 'Kerker' }}
            ],
            desc: `type of prison {{aiName}} is sent to by {{playerName}} (Must explicitly mention type).`,
        }
    ],
    description: {
        en: `Executed when {{aiName}} is explicitly imprisoned by {{playerName}}.`,
        zh: `当{{aiName}}被{{playerName}}明确监禁时执行`,
        ru: `Выполняется, когда {{aiName}} явно заключен в тюрьму {{playerName}}.`,
        fr: `Exécuté lorsque {{aiName}} est explicitement emprisonné par {{playerName}}.`,
        es: `Ejecutado cuando {{aiName}} es explícitamente encarcelado por {{playerName}}.`,
        de: `Wird ausgeführt, wenn {{aiName}} ausdrücklich von {{playerName}} eingekerkert wird.`,
        ja: `{{aiName}}が{{playerName}}によって明示的に投獄されたときに実行されます。`,
        ko: `{{aiName}}가 {{playerName}}에 의해 명시적으로 투옥되었을 때 실행됩니다.`,
        pl: `Wykonywane, gdy {{aiName}} jest wyraźnie uwięziony przez {{playerName}}.`
    },
    
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
                return {
                    en: `{{aiName}} is under house arrest.`,
                    zh: `{{aiName}}被软禁。`,
                    ru: `{{aiName}} под домашним арестом.`,
                    fr: `{{aiName}} est aux arrêts domiciliaires.`,
                    es: `{{aiName}} está bajo arresto domiciliario.`,
                    de: `{{aiName}} steht unter Hausarrest.`,
                    ja: `{{aiName}}は自宅軟禁されています。`,
                    ko: `{{aiName}}가 가택 연금 중입니다.`,
                    pl: `{{aiName}} jest w areszcie domowym.`
                };
            case 'dungeon':
                return {
                    en: `{{aiName}} is thrown into the dungeon.`,
                    zh: `{{aiName}}被关进地牢。`,
                    ru: `{{aiName}} брошен в темницу.`,
                    fr: `{{aiName}} est jeté au cachot.`,
                    es: `{{aiName}} es arrojado al calabozo.`,
                    de: `{{aiName}} wurde in den Kerker geworfen.`,
                    ja: `{{aiName}}は地下牢に投げ込まれました。`,
                    ko: `{{aiName}}가 지하감옥에 던져졌습니다.`,
                    pl: `{{aiName}} został rzucony do lochu.`
                };
            default:
                return {
                    en: `{{aiName}} is imprisoned.`,
                    zh: `{{aiName}}被监禁。`,
                    ru: `{{aiName}} заключен в тюрьму.`,
                    fr: `{{aiName}} est emprisonné.`,
                    es: `{{aiName}} está encarcelado.`,
                    de: `{{aiName}} ist eingekerkert.`,
                    ja: `{{aiName}}は投獄されています。`,
                    ko: `{{aiName}}가 투옥되었습니다.`,
                    pl: `{{aiName}} jest uwięziony.`
                };
        }
    },
    
    chatMessageClass: "negative-action-message"
};
