/*                                               
    _/_/_/_/                      _/      _/   
   _/        _/_/_/  _/      _/    _/  _/      
  _/_/_/  _/    _/  _/      _/      _/         
 _/      _/    _/    _/  _/      _/  _/        
_/        _/_/_/      _/      _/      _/    
v0.1.0
*/

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "assignAiToCourtPosition",
    args: [
        {
            name: "court_position",
            type: "string",
            desc: "{{playerName}}决定将{{aiName}}分配到宫廷的职位。请注意！您只能从以下选项中选择一个：御医、天鹅官、旅行领队、马厩总管、宫廷小丑、狩猎主管、大施赈官、执杯官、总管、古物收藏家、导师、建筑师、宫廷诗人、侍卫、宫廷冠军、音乐家、试食官、侍女、首席太监、宫廷园丁、大法官、乳母、侍从官"
        } 
    ],
    description: `当{{playerName}}决定将{{aiName}}分配到{{playerName}}宫廷的宫廷职位时执行。`,

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
        const court_position = args[0];
        switch (court_position) {
            case "御医":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = court_physician_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:talk_second_scope
                        court_position = court_physician_court_position
                    }
                `);
                break;
            case "天鹅官":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = keeper_of_swans_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:talk_second_scope
                        court_position = keeper_of_swans_court_position
                    }
                `);
                break;
            case "旅行领队":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = travel_leader_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:talk_second_scope
                        court_position = travel_leader_court_position
                    }
                `);
                break;
            case "马厩总管":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = master_of_horse_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:talk_second_scope
                        court_position = master_of_horse_court_position
                    }
                `);
                break;
            case "宫廷小丑":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = court_jester_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:talk_second_scope
                        court_position = court_jester_court_position
                    }
                `);
                break;
            case "狩猎主管":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = master_of_hunt_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:talk_second_scope
                        court_position = master_of_hunt_court_position
                    }
                `);
                break;
            case "大施赈官":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = high_almoner_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:talk_second_scope
                        court_position = high_almoner_court_position
                    }
                `);
                break;
            case "执杯官":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = cupbearer_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:talk_second_scope
                        court_position = cupbearer_court_position
                    }
                `);
                break;
            case "总管":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = seneschal_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:talk_second_scope
                        court_position = seneschal_court_position
                    }
                `);
                break;
            case "古物收藏家":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = antiquarian_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:talk_second_scope
                        court_position = antiquarian_court_position
                    }
                `);
                break;
            case "导师":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = court_tutor_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:talk_second_scope
                        court_position = court_tutor_court_position
                    }
                `);
                break;
            case "建筑师":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = royal_architect_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:talk_second_scope
                        court_position = royal_architect_court_position
                    }
                `);
                break;
            case "宫廷诗人":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = court_poet_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:talk_second_scope
                        court_position = court_poet_court_position
                    }
                `);
                break;
            case "侍卫":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = bodyguard_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:talk_second_scope
                        court_position = bodyguard_court_position
                    }
                `);
                break;
            case "宫廷冠军":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = champion_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:talk_second_scope
                        court_position = champion_court_position
                    }
                `);
                break;
            case "音乐家":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = court_musician_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:talk_second_scope
                        court_position = court_musician_court_position
                    }
                `);
                break;
            case "试食官":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = food_taster_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:talk_second_scope
                        court_position = food_taster_court_position
                    }
                `);
                break;
            case "侍女":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = lady_in_waiting_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:talk_second_scope
                        court_position = lady_in_waiting_court_position
                    }
                `);
                break;
            case "首席太监":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = chief_eunuch_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:talk_second_scope
                        court_position = chief_eunuch_court_position
                    }
                `);
                break;
            case "宫廷园丁":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = court_gardener_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:talk_second_scope
                        court_position = court_gardener_court_position
                    }
                `);
                break;
            case "大法官":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = chief_qadi_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:talk_second_scope
                        court_position = chief_qadi_court_position
                    }
                `);
                break;
            case "乳母":
                runGameEffect(`
                    if={
                        limit = {
                            global_var:talk_second_scope = {
                            is_female = yes
                            }
                        }
                        revoke_court_position = {
                            court_position = wet_nurse_court_position
                            }
                        appoint_court_position = {
                            recipient = global_var:talk_second_scope
                            court_position = wet_nurse_court_position
                            }
                        }
                `);
                break;
            case "侍从官":
                runGameEffect(`
                    if = {
                    limit = {
                        global_var:talk_second_scope = {
                            is_male = yes
                        }
                    }
                    revoke_court_position = {
                        court_position = akolouthos_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:talk_second_scope
                        court_position = akolouthos_court_position
                    }
                    }
                `);
                break;
        }
    },    

    chatMessage: (args) =>{
        return `你任命{{aiName}}为${args[0]}职位`
    },
    chatMessageClass: "neutral-action-message"
}
