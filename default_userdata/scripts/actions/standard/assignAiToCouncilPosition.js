/*                                               
    _/_/_/_/                      _/      _/   
   _/        _/_/_/  _/      _/    _/  _/      
  _/_/_/  _/    _/  _/      _/      _/         
 _/      _/    _/    _/  _/      _/  _/        
_/        _/_/_/      _/      _/      _/    
v0.1.1
*/

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "assignAiToCouncilPosition",
    args: [
        {
            name: "council_position",
            type: "string",
            desc: "{{playerName}}决定将{{aiName}}任命到内阁的职位。请注意！您只能从以下选项中选择一个：掌玺大臣、财政总管、间谍首脑、军事统帅、长史、司户、司马、察事、宰相、大司库、大将军、大监察官"
        }   
    ],
    description: `仅在{{playerName}}宣布{{aiName}}现在被任命到其内阁时运行！警告！仅在{{playerName}}决定任命{{aiName}}为掌玺大臣、财政总管、间谍首脑、军事统帅、长史、司户、司马、察事、宰相、大司库、大将军、大监察官时执行`,

    /**
     * @param {GameData} gameData 
     */
    check: (gameData) =>{
        return true;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
        const council_position = args[0];
        switch (council_position) {
            case "长史":
            case "宰相":
            case "掌玺大臣":
                runGameEffect(`
                    if = {
                        limit = {
                            global_var:talk_second_scope = {
                                exists = liege
                                liege = global_var:talk_first_scope
                                can_be_chancellor_trigger = { COURT_OWNER = global_var:talk_first_scope }
                            }
                        }
                        global_var:talk_first_scope = {
                            scope:council_position = flag:chancellor
                            fire_councillor = cp:councillor_chancellor
                            assign_councillor_type = {
                                    type = councillor_chancellor
                                    target = global_var:talk_second_scope
                            }
                        }
                    }
                `);
                break;
            case "财政总管":
            case "司户":
            case "大司库":
                runGameEffect(`
                    if = {
                        limit = {
                            global_var:talk_second_scope = {
                                exists = liege
                                liege = global_var:talk_first_scope
                            }
                        }
                        global_var:talk_first_scope = {
                            scope:council_position = flag:steward
                            fire_councillor = cp:councillor_steward
                            assign_councillor_type = {
                                    type = councillor_steward
                                    target = global_var:talk_second_scope
                            }
                        }
                    }
                `);
                break;
            case "军事统帅":
            case "司马":
            case "大将军":
                runGameEffect(`
                    if = {
                        limit = {
                            global_var:talk_second_scope = {
                                exists = liege
                                liege = global_var:talk_first_scope
                                can_be_marshal_trigger = { COURT_OWNER = global_var:talk_first_scope }
                            }
                        }
                        global_var:talk_first_scope = {
                            scope:council_position = flag:marshal
                            fire_councillor = cp:councillor_marshal
                            assign_councillor_type = {
                                    type = councillor_marshal
                                    target = global_var:talk_second_scope
                            }
                        }
                    }
                `);
                break;
            case "大监察官":
            case "察事":
            case "间谍首脑":
                runGameEffect(`
                    if = {
                        limit = {
                            global_var:talk_second_scope = {
                                exists = liege
                                liege = global_var:talk_first_scope
                                can_be_spymaster_trigger = { COURT_OWNER = global_var:talk_first_scope }
                            }
                        }
                        global_var:talk_first_scope = {
                            scope:council_position = flag:spymaster
                            fire_councillor = cp:councillor_spymaster
                            assign_councillor_type = {
                                    type = councillor_spymaster
                                    target = global_var:talk_second_scope
                            }
                        }
                    }
                `);
                break;
        }
    },    

    chatMessage: (args) =>{
        return `你任命{{aiName}}为内阁的${args[0]}`
    },
    chatMessageClass: "positive-action-message"
}

function cleanAndLowercase(text) {
    return text.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
}