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
            options: [
                { value: 'chancellor', display: { en: 'Chancellor', zh: '掌玺大臣', ru: 'Канцлер', fr: 'Chancelier', es: 'Canciller', de: 'Kanzler', ja: '宰相', ko: '수상', pl: 'Kanclerz' }},
                { value: 'steward', display: { en: 'Steward', zh: '财政总管', ru: 'Управляющий', fr: 'Intendant', es: 'Mayordomo', de: 'Verwalter', ja: '家令', ko: '재상', pl: 'Zarządca' }},
                { value: 'spymaster', display: { en: 'Spymaster', zh: '间谍首脑', ru: 'Мастер шпионов', fr: 'Maître-espion', es: 'Maestro de espías', de: 'Spionagemeister', ja: '密偵頭', ko: '첩보관', pl: 'Mistrz szpiegów' }},
                { value: 'marshal', display: { en: 'Marshal', zh: '军事统帅', ru: 'Маршал', fr: 'Maréchal', es: 'Mariscal', de: 'Marschall', ja: '元帥', ko: '원수', pl: 'Marszałek' }},
                { value: 'chancellor', display: { en: 'Chief of Staff', zh: '长史', ru: 'Начальник штаба', fr: 'Chef d\'état-major', es: 'Jefe de Estado Mayor', de: 'Stabschef', ja: '参謀長', ko: '참모총장', pl: 'Szef sztabu' }},
                { value: 'steward', display: { en: 'Household Manager', zh: '司户', ru: 'Управляющий хозяйством', fr: 'Gestionnaire du ménage', es: 'Administrador del hogar', de: 'Haushaltsmanager', ja: '家政管理者', ko: '가정 관리자', pl: 'Zarządca gospodarstwa' }},
                { value: 'marshal', display: { en: 'Master of Horse', zh: '司马', ru: 'Конюший', fr: 'Maître des chevaux', es: 'Maestro de caballos', de: 'Pferdemeister', ja: '馬術長', ko: '마술장', pl: 'Mistrz koni' }},
                { value: 'spymaster', display: { en: 'Investigator', zh: '察事', ru: 'Следователь', fr: 'Enquêteur', es: 'Investigador', de: 'Ermittler', ja: '調査官', ko: '수사관', pl: 'Śledczy' }},
                { value: 'chancellor', display: { en: 'Prime Minister', zh: '宰相', ru: 'Премьер-министр', fr: 'Premier ministre', es: 'Primer ministro', de: 'Premierminister', ja: '首相', ko: '총리', pl: 'Premier' }},
                { value: 'steward', display: { en: 'Grand Treasurer', zh: '大司库', ru: 'Великий казначей', fr: 'Grand trésorier', es: 'Gran tesorero', de: 'Großschatzmeister', ja: '大蔵卿', ko: '대사고', pl: 'Wielki skarbnik' }},
                { value: 'marshal', display: { en: 'Grand General', zh: '大将军', ru: 'Великий генерал', fr: 'Grand général', es: 'Gran general', de: 'Großgeneral', ja: '大将軍', ko: '대장군', pl: 'Wielki generał' }},
                { value: 'spymaster', display: { en: 'Grand Censor', zh: '大监察官', ru: 'Великий цензор', fr: 'Grand censeur', es: 'Gran censor', de: 'Großzensor', ja: '大監察官', ko: '대감찰관', pl: 'Wielki cenzor' }}
            ],
            desc: { 
                en: "The council position to which {{playerName}} decides to appoint {{aiName}}.",
                zh: "{{playerName}}决定将{{aiName}}任命到内阁的职位。",
                ru: "Должность в совете, на которую {{playerName}} решает назначить {{aiName}}.",
                fr: "Le poste au conseil auquel {{playerName}} décide de nommer {{aiName}}.",
                es: "El puesto en el consejo al que {{playerName}} decide nombrar a {{aiName}}.",
                de: "Der Ratsposten, zu dem {{playerName}} {{aiName}} ernennt.",
                ja: "{{playerName}}が{{aiName}}を任命することを決めた評議会のポスト。",
                ko: "{{playerName}}가 {{aiName}}를 임명하기로 결정한 의회 직책.",
                pl: "Stanowisko w radzie, na które {{playerName}} decyduje się mianować {{aiName}}."
            }
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
            case "chancellor":
                runGameEffect(`
                    if = {
                        limit = {
                            global_var:votcce_action_target = {
                                exists = liege
                                liege = global_var:votcce_action_source
                                can_be_chancellor_trigger = { COURT_OWNER = global_var:votcce_action_source }
                            }
                        }
                        global_var:votcce_action_source = {
                            scope:council_position = flag:chancellor
                            fire_councillor = cp:councillor_chancellor
                            assign_councillor_type = {
                                    type = councillor_chancellor
                                    target = global_var:votcce_action_target
                            }
                        }
                    }
                `);
                break;
            case "steward":
                runGameEffect(`
                    if = {
                        limit = {
                            global_var:votcce_action_target = {
                                exists = liege
                                liege = global_var:votcce_action_source
                            }
                        }
                        global_var:votcce_action_source = {
                            scope:council_position = flag:steward
                            fire_councillor = cp:councillor_steward
                            assign_councillor_type = {
                                    type = councillor_steward
                                    target = global_var:votcce_action_target
                            }
                        }
                    }
                `);
                break;
            case "marshal":
                runGameEffect(`
                    if = {
                        limit = {
                            global_var:votcce_action_target = {
                                exists = liege
                                liege = global_var:votcce_action_source
                                can_be_marshal_trigger = { COURT_OWNER = global_var:votcce_action_source }
                            }
                        }
                        global_var:votcce_action_source = {
                            scope:council_position = flag:marshal
                            fire_councillor = cp:councillor_marshal
                            assign_councillor_type = {
                                    type = councillor_marshal
                                    target = global_var:votcce_action_target
                            }
                        }
                    }
                `);
                break;
            case "spymaster":
                runGameEffect(`
                    if = {
                        limit = {
                            global_var:votcce_action_target = {
                                exists = liege
                                liege = global_var:votcce_action_source
                                can_be_spymaster_trigger = { COURT_OWNER = global_var:votcce_action_source }
                            }
                        }
                        global_var:votcce_action_source = {
                            scope:council_position = flag:spymaster
                            fire_councillor = cp:councillor_spymaster
                            assign_councillor_type = {
                                    type = councillor_spymaster
                                    target = global_var:votcce_action_target
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
