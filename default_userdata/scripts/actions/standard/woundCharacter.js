//Made by: MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "woundCharacter",
    args: [
        {
            name: "injuryType",
            type: "string",
            options: [
                { value: 'injured', display: { en: 'Injured', zh: '受伤', ru: 'Ранен', fr: 'Blessé', es: 'Herido', de: 'Verletzt', ja: '負傷', ko: '부상', pl: 'Ranny' }},
                { value: 'remove_eye', display: { en: 'Remove Eye', zh: '摘除眼睛', ru: 'Удалить глаз', fr: 'Retirer un œil', es: 'Quitar un ojo', de: 'Auge entfernen', ja: '目を摘出', ko: '눈 제거', pl: 'Usunąć oko' }},
                { value: 'blind', display: { en: 'Blind', zh: '失明', ru: 'Ослепить', fr: 'Aveugler', es: 'Cegar', de: 'Blenden', ja: '盲目', ko: '실명', pl: 'Oślepić' }},
                { value: 'cut_leg', display: { en: 'Cut Leg', zh: '断腿', ru: 'Отрубить ногу', fr: 'Couper la jambe', es: 'Cortar la pierna', de: 'Bein abschneiden', ja: '足切断', ko: '다리 절단', pl: 'Odciąć nogę' }},
                { value: 'cut_balls', display: { en: 'Castrate', zh: '阉割', ru: 'Кастрировать', fr: 'Castrer', es: 'Castrar', de: 'Kastrieren', ja: '去勢', ko: '거세', pl: 'Kastrować' }},
                { value: 'disfigured', display: { en: 'Disfigure', zh: '毁容', ru: 'Обезобразить', fr: 'Défigurer', es: 'Desfigurar', de: 'Entstellen', ja: '顔面損傷', ko: '얼굴 훼손', pl: 'Zniekształcić' }}
            ],
            desc: { 
                en: "Type of injury inflicted on {{character2Name}} by {{character1Name}}.",
                zh: "{{character1Name}}对{{character2Name}}造成的伤害类型。",
                ru: "Тип травмы, нанесенной {{character1Name}} {{character2Name}}.",
                fr: "Type de blessure infligée à {{character2Name}} par {{character1Name}}.",
                es: "Tipo de lesión infligida a {{character2Name}} por {{character1Name}}.",
                de: "Art der Verletzung, die {{character1Name}} {{character2Name}} zufügt.",
                ja: "{{character1Name}}が{{character2Name}}に与える傷害の種類。",
                ko: "{{character1Name}}가 {{character2Name}}에게 가하는 부상 유형.",
                pl: "Rodzaj obrażeń zadanych {{character2Name}} przez {{character1Name}}."
            }
        }
    ],
    description: {
        en: `Executed when a character injures another in various ways based on the injuryType parameter.`,
        zh: `当一个角色根据injuryType参数以各种方式伤害另一个角色时执行`,
        ru: `Выполняется, когда один персонаж наносит увечья другому различными способами в зависимости от параметра injuryType.`,
        fr: `Exécuté lorsqu'un personnage blesse un autre de diverses manières en fonction du paramètre injuryType.`,
        es: `Ejecutado cuando un personaje hiere a otro de diversas maneras según el parámetro injuryType.`,
        de: `Wird ausgeführt, wenn ein Charakter einen anderen auf verschiedene Weisen verletzt, basierend auf dem Parameter injuryType.`,
        ja: `あるキャラクターがinjuryTypeパラメータに基づいて様々な方法で別のキャラクターを傷つけたときに実行されます。`,
        ko: `한 캐릭터가 injuryType 매개변수에 따라 다양한 방법으로 다른 캐릭터를 다칠 때 실행됩니다.`,
        pl: `Wykonywane, gdy jedna postać rani drugą na różne sposoby w zależności od parametru injuryType.`
    },
    
    /**
     * @param {GameData} gameData
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) => {
        // Always return true for now
        return true;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     * @param {number} sourceId
     * @param {number} targetId
     */
    run: (gameData, runGameEffect, args, sourceId, targetId) => {
        const ai = gameData.getCharacterById(targetId);
        if (!ai) return;
        let injuryType = args[0]

        console.log(`Injury type received: ${injuryType}`); // debug log for injuryType


        switch (injuryType) {
    
            case "remove_eye":
                console.log(`${ai.hasTrait("One-Eyed")} | ${ai.hasTrait('One-Eyed')}`);
                for (let trait of ai.traits) {
                    console.log("Trait: " + trait.name);
                }
                console.log("Executing remove_eye effect"); // Debug log
                if (ai.hasTrait("One-Eyed")) {
                    runGameEffect(`
                        global_var:votcce_action_target = {
                            add_trait = blind
                            remove_trait = one_eyed
                        }
                    `);
                    gameData.getAi().addTrait({
                        category: "health",
                        name: "Blind",
                        desc: `${ai.shortName} is blind`
                    });
                } else {
                    runGameEffect(`
                        global_var:votcce_action_target = {
                            add_trait = one_eyed
                        }
                    `);
                    gameData.getAi().addTrait({
                        category: "health",
                        name: "One-Eyed",
                        desc: `${ai.shortName} is one-eyed`
                    });
                }
                break;

            case "blind":
                console.log("Executing blind effect"); // Debug log
                if (!ai.hasTrait('Blind')) {
                    runGameEffect(`
                        global_var:votcce_action_target = {
                            add_trait = blind
                        }
                    `);
                    gameData.getAi().addTrait({
                        category: "health",
                        name: "Blind",
                        desc: `${ai.shortName} is blind`
                    });
                }
                break;

            case "cut_leg":
                console.log("Executing cut_leg effect"); // Debug log
                if (!ai.hasTrait('One-Legged')) {
                    runGameEffect(`
                        global_var:votcce_action_target = {
                            add_trait = one_legged
                        }
                    `);
                    gameData.getAi().addTrait({
                        category: "health",
                        name: "One-Legged",
                        desc: `${ai.shortName} is one-legged`
                    });
                }
                break;

            case "cut_balls":
                console.log("Executing cut_balls effect"); // Debug log
                    runGameEffect(`
                        global_var:votcce_action_target = {
	                        add_trait = eunuch_1
	                        torture_memory_effect = {
		                        VICTIM = scope:recipient
		                        TORTURER = scope:actor  
		                        TYPE = castrated
	                            }                            
                        }
                        
                    `);
                    gameData.getAi().addTrait({
                        category: "health",
                        name: "Eunuch",
                        desc: `${ai.shortName} is an eunuch`
                    });
                break;

            case "disfigured":
                console.log("Executing disfigured effect"); // Debug log
                if (!ai.hasTrait('Disfigured')) {
                    runGameEffect(`
                        global_var:votcce_action_target = {
                            add_trait = disfigured
                        }
                    `);
                    gameData.getAi().addTrait({
                        category: "health",
                        name: "Disfigured",
                        desc: `${ai.shortName} is disfigured`
                    });
                }
                break;

            default:
				{}
        }

		// Randomly apply lunatic or possessed with a 5% chance after any injury
		if (Math.random() < 0.05 && !(ai.hasTrait('lunatic_1') || ai.hasTrait('possessed_1'))) {
			const mentalTrait = Math.random() < 0.5 ? 'lunatic_1' : 'possessed_1';
			runGameEffect(`
				global_var:votcce_action_target = {
					add_trait = ${mentalTrait}
				}
			`);
		}
        
        // Injure ai character based on existing traits on any injure
		if (ai.hasTrait('Brutally Mauled')) {
            // Replace Wounded_3 with Maimed (15% chance)
            if (Math.random() < 0.25) {
                runGameEffect(`
                    global_var:votcce_action_target = {
                        remove_trait = wounded_3
                        add_trait = maimed
                    }
                `);
                gameData.getAi().removeTrait("Brutally Mauled");
                gameData.getAi().addTrait({
                    category: "health",
                    name: "Maimed",
                    desc: `${ai.shortName} is maimed`
                });
            }
        } else if (ai.hasTrait('Severely Injured')) {
            // Replace Wounded_2 with Wounded_3 (20% chance)
            if (Math.random() < 0.40) {
                runGameEffect(`
                    global_var:votcce_action_target = {
                        remove_trait = wounded_2
                        add_trait = wounded_3
                    }
                `);
                gameData.getAi().removeTrait("Severely Injured");
                gameData.getAi().addTrait({
                    category: "health",
                    name: "Brutally Mauled",
                    desc: `${ai.shortName} is heavily wounded`
                });
            }
        } else if (ai.hasTrait('Wounded')) {
            // Replace Wounded_1 with Wounded_2 (30% chance)
            if (Math.random() < 0.65) {
                runGameEffect(`
                    global_var:votcce_action_target = {
                        remove_trait = wounded_1
                        add_trait = wounded_2
                    }
                `);
                gameData.getAi().removeTrait("Wounded");
                gameData.getAi().addTrait({
                    category: "health",
                    name: "Severely Injured",
                    desc: `${ai.shortName} is really wounded`
                });
            }
        } else {
            // If the AI has no wounded traits, add Wounded_1
            runGameEffect(`
                global_var:votcce_action_target = {
                    add_trait = wounded_1
                }
            `);
            gameData.getAi().addTrait({
                category: "health",
                name: "Wounded",
                desc: `${ai.shortName} is wounded`
            });
        }

    },

	chatMessage: (args) => {
		let injuryType = args[0];
		switch (injuryType) {
			case 'remove_eye':
				return {
					en: `{{character1Name}} gouged out one of {{character2Name}}'s eyes.`,
					zh: `{{character1Name}}挖去了{{character2Name}}的一只眼睛。`,
					ru: `{{character1Name}} выкололи один из глаз {{character2Name}}.`,
					fr: `{{character1Name}} a crevé l'un des yeux de {{character2Name}}.`,
					es: `{{character1Name}} le sacó un ojo a {{character2Name}}.`,
					de: `{{character1Name}} hat {{character2Name}} ein Auge ausgestochen.`,
					ja: `{{character1Name}}は{{character2Name}}の片目をえぐり出しました。`,
					ko: `{{character1Name}}은 {{character2Name}}의 한쪽 눈을 도려냈습니다.`,
					pl: `{{character1Name}} wydłubał jedno z oczu {{character2Name}}.`
				};
			case 'blind':
				return {
					en: `{{character1Name}} blinded {{character2Name}}.`,
					zh: `{{character1Name}}使{{character2Name}}失明了。`,
					ru: `{{character1Name}} ослепил {{character2Name}}.`,
					fr: `{{character1Name}} a aveuglé {{character2Name}}.`,
					es: `{{character1Name}} cegó a {{character2Name}}.`,
					de: `{{character1Name}} hat {{character2Name}} geblendet.`,
					ja: `{{character1Name}}は{{character2Name}}を盲目にしました。`,
					ko: `{{character1Name}}은 {{character2Name}}를 실명시켰습니다.`,
					pl: `{{character1Name}} oślepił {{character2Name}}.`
				};
			case 'cut_leg':
				return {
					en: `{{character1Name}} cut off {{character2Name}}'s leg.`,
					zh: `{{character1Name}}砍断了{{character2Name}}的腿。`,
					ru: `{{character1Name}} отрубили ногу {{character2Name}}.`,
					fr: `{{character1Name}} a coupé la jambe de {{character2Name}}.`,
					es: `{{character1Name}} le cortó la pierna a {{character2Name}}.`,
					de: `{{character1Name}} hat {{character2Name}} das Bein abgeschnitten.`,
					ja: `{{character1Name}}は{{character2Name}}の足を切断しました。`,
					ko: `{{character1Name}}은 {{character2Name}}의 다리를 잘랐습니다.`,
					pl: `{{character1Name}} odciął nogę {{character2Name}}.`
				};
			case 'cut_balls':
				return {
					en: `{{character1Name}} castrated {{character2Name}}.`,
					zh: `{{character1Name}}阉割了{{character2Name}}。`,
					ru: `{{character1Name}} кастрировал {{character2Name}}.`,
					fr: `{{character1Name}} a castré {{character2Name}}.`,
					es: `{{character1Name}} castró a {{character2Name}}.`,
					de: `{{character1Name}} hat {{character2Name}} kastriert.`,
					ja: `{{character1Name}}は{{character2Name}}を去勢しました。`,
					ko: `{{character1Name}}은 {{character2Name}}를 거세했습니다.`,
					pl: `{{character1Name}} skastrował {{character2Name}}.`
				};
			case 'disfigured':
				return {
					en: `{{character1Name}} disfigured {{character2Name}}.`,
					zh: `{{character1Name}}毁容了{{character2Name}}。`,
					ru: `{{character1Name}} изуродовали {{character2Name}}.`,
					fr: `{{character1Name}} a défiguré {{character2Name}}.`,
					es: `{{character1Name}} desfiguró a {{character2Name}}.`,
					de: `{{character1Name}} hat {{character2Name}} entstellt.`,
					ja: `{{character1Name}}は{{character2Name}}の顔を傷つけました。`,
					ko: `{{character1Name}}은 {{character2Name}}의 얼굴을 훼손했습니다.`,
					pl: `{{character1Name}} zniekształcił {{character2Name}}.`
				};
			default:
				return {
					en: `{{character1Name}} injured {{character2Name}}.`,
					zh: `{{character1Name}}伤害了{{character2Name}}。`,
					ru: `{{character1Name}} ранил {{character2Name}}.`,
					fr: `{{character1Name}} a blessé {{character2Name}}.`,
					es: `{{character1Name}} hirió a {{character2Name}}.`,
					de: `{{character1Name}} hat {{character2Name}} verletzt.`,
					ja: `{{character1Name}}は{{character2Name}}を傷つけました。`,
					ko: `{{character1Name}}은 {{character2Name}}를 다쳤습니다.`,
					pl: `{{character1Name}} zranił {{character2Name}}.`
				};
		}
	},
		
    chatMessageClass: "negative-action-message"
};
