//Made by: Troller (little modifications by MrAndroPC)

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "imprisonCharacter",
    args: [
        {
            name: "prisonType",
            type: "string",
            options: [
                { value: 'default', display: { en: 'Default Prison', zh: '默认监狱', ru: 'Обычная тюрьма', fr: 'Prison par défaut', es: 'Prisión por defecto', de: 'Standardgefängnis', ja: 'デフォルト刑務所', ko: '기본 감옥', pl: 'Domyślne więzienie' }},
                { value: 'house_arrest', display: { en: 'House Arrest', zh: '软禁', ru: 'Домашний арест', fr: 'Assignation à résidence', es: 'Arresto domiciliario', de: 'Hausarrest', ja: '自宅軟禁', ko: '가택 연금', pl: 'Areszt domowy' }},
                { value: 'dungeon', display: { en: 'Dungeon', zh: '地牢', ru: 'Темница', fr: 'Donjon', es: 'Calabozo', de: 'Kerker', ja: '地下牢', ko: '지하감옥', pl: 'Loch' }}
            ],
            desc: { 
                en: "type of prison {{aiName}} is sent to by {{playerName}} (Must explicitly mention type).",
                zh: "{{playerName}}将{{aiName}}送往的监狱类型（必须明确提及类型）。",
                ru: "тип тюрьмы, в которую {{playerName}} отправляет {{aiName}} (должен явно упоминать тип).",
                fr: "type de prison où {{playerName}} envoie {{aiName}} (doit mentionner explicitement le type).",
                es: "tipo de prisión a la que {{playerName}} envía a {{aiName}} (debe mencionar explícitamente el tipo).",
                de: "Art des Gefängnisses, in das {{playerName}} {{aiName}} schickt (muss den Typ explizit erwähnen).",
                ja: "{{playerName}}が{{aiName}}を送る刑務所の種類（種類を明示的に言及する必要があります）。",
                ko: "{{playerName}}가 {{aiName}}를 보내는 감옥 유형(유형을 명시적으로 언급해야 함).",
                pl: "rodzaj więzienia, do którego {{playerName}} wysyła {{aiName}} (musi wyraźnie wspomnieć typ)."
            },
        }
    ],
    description: {
        en: `Executed when a character is imprisoned by another.`,
        zh: `当一个角色被另一个角色监禁时执行。`,
        ru: `Выполняется, когда один персонаж заключен в тюрьму другим.`,
        fr: `Exécuté lorsqu'un personnage est emprisonné par un autre.`,
        es: `Ejecutado cuando un personaje es encarcelado por otro.`,
        de: `Wird ausgeführt, wenn ein Charakter von einem anderen inhaftiert wird.`,
        ja: `あるキャラクターが別のキャラクターによって投獄されたときに実行されます。`,
        ko: `한 캐릭터가 다른 캐릭터에 의해 투옥되었을 때 실행됩니다.`,
        pl: `Wykonywane, gdy jedna postać zostaje uwięziona przez inną.`
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
                            global_var:votcce_action_target = { target_is_liege_or_above = global_var:votcce_action_source }
                        }
                        imprison_character_effect = {
                            TARGET = global_var:votcce_action_target
                            IMPRISONER = global_var:votcce_action_source
                        }
                        global_var:votcce_action_source = { consume_imprisonment_reasons = global_var:votcce_action_target }
                    }
                    else = {
                        rightfully_imprison_character_effect = {
                                TARGET = global_var:votcce_action_target
                                IMPRISONER = global_var:votcce_action_source
                        }            
                    }
                `);
                break;
                
            case "dungeon":
                runGameEffect(`
                    if = {
                        limit = {
                            global_var:votcce_action_target = { target_is_liege_or_above = global_var:votcce_action_source }
                        }
                        imprison_character_effect = {
                            TARGET = global_var:votcce_action_target
                            IMPRISONER = global_var:votcce_action_source
                        }
                        global_var:votcce_action_target = {
                            change_prison_type = dungeon
                        }
                        global_var:votcce_action_source = { consume_imprisonment_reasons = global_var:votcce_action_target }
                    }
                    else = {
                        rightfully_imprison_character_effect = {
                                TARGET = global_var:votcce_action_target
                                IMPRISONER = global_var:votcce_action_source
                        }        
                        global_var:votcce_action_target = {
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
                            global_var:votcce_action_target = { target_is_liege_or_above = global_var:votcce_action_source }
                        }
                        imprison_character_effect = {
                            TARGET = global_var:votcce_action_target
                            IMPRISONER = global_var:votcce_action_source
                        }
                        global_var:votcce_action_source = { consume_imprisonment_reasons = global_var:votcce_action_target }
                    }
                    else = {
                        rightfully_imprison_character_effect = {
                                TARGET = global_var:votcce_action_target
                                IMPRISONER = global_var:votcce_action_source
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
