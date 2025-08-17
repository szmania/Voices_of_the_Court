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
            desc: "The court position to which the {{playerName}} decided to assign {{aiName}}. BE CAREFULL! You must choose ONLY from this variants: physician, keeper_of_swans, travel_leader, master_of_horse, court_jester, master_of_hunt, high_almoner, cupbearer, seneschal, antiquarian, tutor, royal_architect, court_poet, bodyguard, court_champion, musician, food_taster, lady_in_waiting, garuda, chief_eunuch, court_gardener, chief_qadi, wet_nurse, akolouthos"
        } 
    ],
    description: `Execute if {{playerName}} decides to assign {{aiName}} to court position of {{playerName}}'s council.`,

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
            case "physician":
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
            case "keeper_of_swans":
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
            case "travel_leader":
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
            case "master_of_horse":
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
            case "court_jester":
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
            case "master_of_hunt":
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
            case "high_almoner":
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
            case "cupbearer":
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
            case "seneschal":
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
            case "antiquarian":
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
            case "tutor":
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
            case "royal_architect":
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
            case "court_poet":
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
            case "bodyguard":
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
            case "court_champion":
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
            case "musician":
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
            case "food_taster":
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
            case "lady_in_waiting":
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
            case "garuda":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = garuda_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:talk_second_scope
                        court_position = garuda_court_position
                    }
                `);
                break;
            case "chief_eunuch":
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
            case "court_gardener":
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
            case "chief_qadi":
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
            case "wet_nurse":
                runGameEffect(`
                    trigger = {
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
                `);
                break;
            case "akolouthos":
                runGameEffect(`
                    trigger = {
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
                `);
                break;
        }
    },    

    chatMessage: (args) =>{
        return `You assign {{aiName}} to ${args[0]} position`
    },
    chatMessageClass: "neutral-action-message"
}
