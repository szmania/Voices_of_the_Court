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
                en: "type of prison {{character2Name}} is sent to by {{character1Name}} (Must explicitly mention type).",
                zh: "{{character1Name}}将{{character2Name}}送往的监狱类型（必须明确提及类型）。",
                ru: "тип тюрьмы, в которую {{character1Name}} отправляет {{character2Name}} (должен явно упоминать тип).",
                fr: "type de prison où {{character1Name}} envoie {{character2Name}} (doit mentionner explicitement le type).",
                es: "tipo de prisión a la que {{character1Name}} envía a {{character2Name}} (debe mencionar explícitamente el tipo).",
                de: "Art des Gefängnisses, in das {{character1Name}} {{character2Name}} schickt (muss den Typ explizit erwähnen).",
                ja: "{{character1Name}}が{{character2Name}}を送る刑務所の種類（種類を明示的に言及する必要があります）。",
                ko: "{{character1Name}}가 {{character2Name}}를 보내는 감옥 유형(유형을 명시적으로 언급해야 함).",
                pl: "rodzaj więzienia, do którego {{character1Name}} wysyła {{character2Name}} (musi wyraźnie wspomnieć typ)."
            },
        }
    ],
    description: {
        en: `Executed when a character is imprisoned by another. The source (character1) is the IMPRISONER. The target (character2) is the one being IMPRISONED.`,
        zh: `当一个角色被另一个角色监禁时执行。`,
        ru: `Выполняется, когда один персонаж заключен в тюрьму другим.`,
        fr: `Exécuté lorsqu'un personnage est emprisonné par un autre.`,
        es: `Ejecutado cuando un personaje es encarcelado por otro.`,
        de: `Wird ausgeführt, wenn ein Charakter von einem anderen inhaftiert wird.`,
        ja: `あるキャラクターが別のキャラクターによって投獄されたときに実行されます。`,
        ko: `한 캐릭터가 다른 캐릭터에 의해 투옥되었을 때 실행됩니다.`,
        pl: `Wykonywane, gdy jedna postać zostaje uwięziona przez inną.`
    },
    
    /**
     * @param {GameData} gameData 
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) => {
        const target = gameData.getCharacterById(targetId);
        if (!target) return false;

        const source = gameData.getCharacterById(sourceId);
        if (!source) return false;

        // Check if target is already a prisoner of the source
        const relationToSource = target.relationsToCharacters.find(r => r.id === sourceId);
        return !(relationToSource && relationToSource.relations.includes("Prisoner"));
    },
    
    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     * @param {number} sourceId
     * @param {number} targetId
     */
    run: (gameData, runGameEffect, args, sourceId, targetId) => {
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
                    en: `{{character2Name}} is under house arrest by {{character1Name}}.`,
                    zh: `{{character2Name}}被{{character1Name}}软禁。`,
                    ru: `{{character2Name}} под домашним арестом у {{character1Name}}.`,
                    fr: `{{character2Name}} est assigné à résidence par {{character1Name}}.`,
                    es: `{{character2Name}} está bajo arresto domiciliario por {{character1Name}}.`,
                    de: `{{character2Name}} steht unter Hausarrest von {{character1Name}}.`,
                    ja: `{{character2Name}}は{{character1Name}}によって自宅軟禁されています。`,
                    ko: `{{character2Name}}가 {{character1Name}}에 의해 가택 연금 중입니다.`,
                    pl: `{{character2Name}} jest w areszcie domowym nałożonym przez {{character1Name}}.`
                };
            case 'dungeon':
                return {
                    en: `{{character2Name}} is thrown into the dungeon by {{character1Name}}.`,
                    zh: `{{character2Name}}被{{character1Name}}关进地牢。`,
                    ru: `{{character1Name}} бросил {{character2Name}} в темницу.`,
                    fr: `{{character2Name}} est jeté au cachot par {{character1Name}}.`,
                    es: `{{character2Name}} es arrojado al calabozo por {{character1Name}}.`,
                    de: `{{character2Name}} wurde von {{character1Name}} in den Kerker geworfen.`,
                    ja: `{{character2Name}}は{{character1Name}}によって地下牢に投げ込まれました。`,
                    ko: `{{character2Name}}가 {{character1Name}}에 의해 지하감옥에 던져졌습니다.`,
                    pl: `{{character2Name}} został rzucony do lochu przez {{character1Name}}.`
                };
            default:
                return {
                    en: `{{character2Name}} is imprisoned by {{character1Name}}.`,
                    zh: `{{character2Name}}被{{character1Name}}监禁。`,
                    ru: `{{character2Name}} заключен в тюрьму {{character1Name}}.`,
                    fr: `{{character2Name}} est emprisonné par {{character1Name}}.`,
                    es: `{{character2Name}} está encarcelado por {{character1Name}}.`,
                    de: `{{character2Name}} ist von {{character1Name}} eingekerkert.`,
                    ja: `{{character2Name}}は{{character1Name}}によって投獄されています。`,
                    ko: `{{character2Name}}가 {{character1Name}}에 의해 투옥되었습니다.`,
                    pl: `{{character2Name}} jest uwięziony przez {{character1Name}}.`
                };
        }
    },
    
    chatMessageClass: "negative-action-message"
};
