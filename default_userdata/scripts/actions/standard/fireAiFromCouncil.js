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
    signature: "fireAiFromCouncil",
    args: [],
    description: `Execute if {{playerName}} decides to fire/dismiss/retire {{aiName}} from {{playerName}}'s council.`,

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
        runGameEffect(`
            trigger = {
                global_var:talk_second_scope = {
                    exists = liege
                    liege = global_var:talk_first_scope
                    OR = {
                        has_council_position = councillor_chancellor
                        has_council_position = councillor_marshal
                        has_council_position = councillor_steward
                        has_council_position = councillor_spymaster
                        has_council_position = councillor_court_chaplain
                    }
                    can_be_fired_from_council_trigger = { COURT_OWNER = root }
                }
            }
            global_var:talk_first_scope = { fire_councillor = global_var:talk_second_scope }
        `);
    },    

    chatMessage: (args) =>{
        return `You fired {{aiName}} from council`
    },
    chatMessageClass: "negative-action-message"
}