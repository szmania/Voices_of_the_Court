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
    signature: "fireFromCouncil",
    args: [],
    description: {
        en: `Executed when a character decides to fire or dismiss another character from their council.`,
        zh: `当一个角色决定从其内阁中解雇/开除/退休另一个角色时执行。`,
        ru: `Выполняется, когда персонаж решает уволить или отстранить другого персонажа из своего совета.`,
        fr: `Exécuté lorsqu'un personnage décide de renvoyer ou de démettre un autre personnage de son conseil.`,
        es: `Ejecutado cuando un personaje decide despedir o destituir a otro personaje de su consejo.`,
        de: `Wird ausgeführt, wenn ein Charakter beschließt, einen anderen Charakter aus seinem Rat zu entlassen oder abzusetzen.`,
        ja: `あるキャラクターが別のキャラクターを評議会から解雇または解任することを決めたときに実行されます。`,
        ko: `한 캐릭터가 다른 캐릭터를 의회에서 해고하거나 해임하기로 결정했을 때 실행됩니다.`,
        pl: `Wykonywane, gdy postać decyduje się zwolnić lub odwołać inną postać z rady.`
    },

    /**
     * @param {GameData} gameData 
     * @param {number} initiatorId
     * @param {number} targetId
     */
    check: (gameData, initiatorId, targetId) =>{
        const initiator = gameData.getCharacterById(initiatorId);
        const target = gameData.getCharacterById(targetId);
        return initiator && target;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     * @param {number} initiatorId
     * @param {number} targetId
     */
    run: (gameData, runGameEffect, args, initiatorId, targetId) => {
        runGameEffect(`
            if = {
            limit = {
                global_var:votcce_action_target = {
                    exists = liege
                    liege = global_var:votcce_action_source
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
            global_var:votcce_action_source = { fire_councillor = global_var:votcce_action_target }
            }
        `);
    },    

    chatMessage: (args) =>{
        return {
            en: `{{character1Name}} fired {{character2Name}} from the council.`,
            zh: `{{character1Name}}将{{character2Name}}从内阁中开除。`,
            ru: `{{character1Name}} уволил {{character2Name}} из совета.`,
            fr: `{{character1Name}} a renvoyé {{character2Name}} du conseil.`,
            es: `{{character1Name}} despidió a {{character2Name}} del consejo.`,
            de: `{{character1Name}} hat {{character2Name}} aus dem Rat entlassen.`,
            ja: `{{character1Name}}は{{character2Name}}を評議会から解雇しました。`,
            ko: `{{character1Name}}가 {{character2Name}}를 의회에서 해고했습니다.`,
            pl: `{{character1Name}} zwolnił {{character2Name}} z rady.`
        }
    },
    chatMessageClass: "negative-action-message"
}
