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
    description: {
        en: `Executed when {{playerName}} decides to fire or dismiss {{aiName}} from their council.`,
        zh: `当{{playerName}}决定从{{playerName}}的内阁中解雇/开除/退休{{aiName}}时执行。`,
        ru: `Выполняется, когда {{playerName}} решает уволить или отстранить {{aiName}} из своего совета.`,
        fr: `Exécuté lorsque {{playerName}} décide de renvoyer ou de démettre {{aiName}} de son conseil.`
    },

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
            if = {
            limit = {
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
            }
        `);
    },    

    chatMessage: (args) =>{
        return `你将{{aiName}}从内阁中开除`
    },
    chatMessageClass: "negative-action-message"
}
