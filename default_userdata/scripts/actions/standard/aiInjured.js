//Made by: MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "aiInjured",
    args: [
        {
            name: "injuryType",
            type: "string",
            desc: "Type of injury inflicted on {{aiName}} by {{playerName}}. Possible values: injured if simple injure, remove_eye, blind if it last eye, cut_leg, cut_balls, disfigured"
        }
    ],
    description: {
        en: `Executed when {{playerName}} injures {{aiName}} in various ways based on the injuryType parameter.`,
        zh: `当{{playerName}}根据injuryType参数以各种方式伤害{{aiName}}时执行`,
        ru: `Выполняется, когда {{playerName}} наносит увечья {{aiName}} различными способами в зависимости от параметра injuryType.`,
        fr: `Exécuté lorsque {{playerName}} blesse {{aiName}} de diverses manières en fonction du paramètre injuryType.`
    },
    
    check: (gameData) => {
        // Always return true for now
        return true;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
        let ai = gameData.getAi();
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
                        global_var:talk_second_scope = {
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
                        global_var:talk_second_scope = {
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
                        global_var:talk_second_scope = {
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
                        global_var:talk_second_scope = {
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
                        global_var:talk_second_scope = {
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
                        global_var:talk_second_scope = {
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
				global_var:talk_second_scope = {
					add_trait = ${mentalTrait}
				}
			`);
		}
        
        // Injure ai character based on existing traits on any injure
		if (ai.hasTrait('Brutally Mauled')) {
            // Replace Wounded_3 with Maimed (15% chance)
            if (Math.random() < 0.25) {
                runGameEffect(`
                    global_var:talk_second_scope = {
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
                    global_var:talk_second_scope = {
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
                    global_var:talk_second_scope = {
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
                global_var:talk_second_scope = {
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
					en: `You gouged out one of {{aiName}}'s eyes.`,
					zh: `你挖去了{{aiName}}的一只眼睛。`,
					ru: `Вы выкололи один из глаз {{aiName}}.`,
					fr: `Vous avez crevé l'un des yeux de {{aiName}}.`
				};
			case 'blind':
				return {
					en: `You blinded {{aiName}}.`,
					zh: `你使{{aiName}}失明了。`,
					ru: `Вы ослепили {{aiName}}.`,
					fr: `Vous avez aveuglé {{aiName}}.`
				};
			case 'cut_leg':
				return {
					en: `You cut off {{aiName}}'s leg.`,
					zh: `你砍断了{{aiName}}的腿。`,
					ru: `Вы отрубили ногу {{aiName}}.`,
					fr: `Vous avez coupé la jambe de {{aiName}}.`
				};
			case 'cut_balls':
				return {
					en: `You castrated {{aiName}}.`,
					zh: `你阉割了{{aiName}}。`,
					ru: `Вы кастрировали {{aiName}}.`,
					fr: `Vous avez castré {{aiName}}.`
				};
			case 'disfigured':
				return {
					en: `You disfigured {{aiName}}.`,
					zh: `你毁容了{{aiName}}。`,
					ru: `Вы изуродовали {{aiName}}.`,
					fr: `Vous avez défiguré {{aiName}}.`
				};
			default:
				return {
					en: `You injured {{aiName}}.`,
					zh: `你伤害了{{aiName}}。`,
					ru: `Вы ранили {{aiName}}.`,
					fr: `Vous avez blessé {{aiName}}.`
				};
		}
	},
		
    chatMessageClass: "negative-action-message"
};
