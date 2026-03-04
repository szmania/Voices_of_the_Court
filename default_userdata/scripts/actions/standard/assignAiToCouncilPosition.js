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
    description: {
        en: `Executed when {{playerName}} appoints {{aiName}} to a council position (Chancellor, Steward, Spymaster, or Marshal).`,
        zh: `仅在{{playerName}}宣布{{aiName}}现在被任命到其内阁时运行！警告！仅在{{playerName}}决定任命{{aiName}}为掌玺大臣、财政总管、间谍首脑、军事统帅、长史、司户、司马、察事、宰相、大司库、大将军、大监察官时执行`,
        ru: `Выполняется, когда {{playerName}} назначает {{aiName}} на должность в совете (канцлер, управляющий, тайный советник или маршал).`,
    fr: `Exécuté lorsque {{playerName}} nomme {{aiName}} à un poste au conseil (chancelier, intendant, maître des espions ou maréchal).`,
    es: `Ejecutado cuando {{playerName}} nombra a {{aiName}} para un puesto en el consejo (canciller, administrador, maestro de espías o mariscal).`,
    de: `Wird ausgeführt, wenn {{playerName}} {{aiName}} zu einem Ratsposten ernennt (Kanzler, Verwalter, Spionagemeister oder Marschall).`,
    ja: `{{playerName}}が{{aiName}}を評議会のポストに任命したときに実行されます（宰相、執事、スパイマスター、または元帥）。`,
    ko: `{{playerName}}가 {{aiName}}를 의회 직책에 임명했을 때 실행됩니다 (총리, 관리인, 첩보대장 또는 원수).`,
    pl: `Wykonywane, gdy {{playerName}} mianuje {{aiName}} na stanowisko w radzie (kanclerz, zarządca, mistrz szpiegów lub marszałek).`
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
        return {
            en: `You appointed {{aiName}} as ${args[0]} on the council.`,
            zh: `你任命{{aiName}}为内阁的${args[0]}`,
            ru: `Вы назначили {{aiName}} на должность ${args[0]} в совете.`,
    fr: `Vous avez nommé {{aiName}} au poste de ${args[0]} au conseil.`,
    es: `Nombraste a {{aiName}} como ${args[0]} en el consejo.`,
    de: `Du hast {{aiName}} als ${args[0]} in den Rat berufen.`,
    ja: `あなたは{{aiName}}を評議会の${args[0]}に任命しました。`,
    ko: `당신은 {{aiName}}를 의회 ${args[0]}로 임명했습니다.`,
    pl: `Mianowałeś {{aiName}} na stanowisko ${args[0]} w radzie.`
        }
    },
    chatMessageClass: "positive-action-message"
}

function cleanAndLowercase(text) {
    return text.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
}
