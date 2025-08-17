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
    description: `execute when the {{playerName}} injures the {{aiName}} in various ways, based on the injuryType argument`,
    
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
                if (ai.sheHe == 'he' && (!ai.hasTrait('Eunuch') || !ai.hasTrait('Beardless Eunuch'))) {
                    runGameEffect(`
                        global_var:talk_second_scope = {
                            if = {
                                limit = {
                                  age < 12
                                }
                                ep3_child_castration_effect = yes
                            }
                            else = {
                                ep3_youth_castration_effect = yes
                            }
                        }
                    `);
                    gameData.getAi().addTrait({
                        category: "health",
                        name: "Eunuch",
                        desc: `${ai.shortName} is an eunuch`
                    });
                }
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
        let injuryType = args[0]
		switch (injuryType) {
			case 'remove_eye':
				return "You have removed an eye from the {{aiName}} character.";
			case 'blind':
				return "You have blinded the {{aiName}} character.";
			case 'cut_leg':
				return "You have cut off the {{aiName}} character's leg.";
			case 'cut_balls':
				return "You have castrated the {{aiName}} character.";
			case 'disfigured':
				return "You have disfigured the {{aiName}} character.";
			default:
				return "You have injured the {{aiName}} character.";
		}
	},
		
    chatMessageClass: "negative-action-message"
};
