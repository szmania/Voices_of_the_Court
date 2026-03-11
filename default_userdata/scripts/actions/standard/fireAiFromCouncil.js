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
        fr: `Exécuté lorsque {{playerName}} décide de renvoyer ou de démettre {{aiName}} de son conseil.`,
        es: `Ejecutado cuando {{playerName}} decide despedir o destituir a {{aiName}} de su consejo.`,
        de: `Wird ausgeführt, wenn {{playerName}} beschließt, {{aiName}} aus seinem Rat zu entlassen oder abzusetzen.`,
        ja: `{{playerName}}が{{aiName}}を評議会から解雇または解任することを決めたときに実行されます。`,
        ko: `{{playerName}}가 {{aiName}}를 의회에서 해고하거나 해임하기로 결정했을 때 실행됩니다.`,
        pl: `Wykonywane, gdy {{playerName}} decyduje się zwolnić lub odwołać {{aiName}} z rady.`
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
            en: `You fired {{aiName}} from the council.`,
            zh: `你将{{aiName}}从内阁中开除`,
            ru: `Вы уволили {{aiName}} из совета.`,
            fr: `Vous avez renvoyé {{aiName}} du conseil.`,
            es: `Despediste a {{aiName}} del consejo.`,
            de: `Du hast {{aiName}} aus dem Rat entlassen.`,
            ja: `あなたは{{aiName}}を評議会から解雇しました。`,
            ko: `당신은 {{aiName}}를 의회에서 해고했습니다.`,
            pl: `Zwolniłeś {{aiName}} z rady.`
        }
    },
    chatMessageClass: "negative-action-message"
}
