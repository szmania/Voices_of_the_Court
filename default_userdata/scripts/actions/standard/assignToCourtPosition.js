/*                                               
    _/_/_/_/                      _/      _/   
   _/        _/_/_/  _/      _/    _/  _/      
  _/_/_/  _/    _/  _/      _/      _/         
 _/      _/    _/    _/  _/      _/  _/        
_/        _/_/_/      _/      _/      _/    
v0.1.0
*/

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
const action = {
    signature: "assignToCourtPosition",
    args: [
        {
            name: "court_position",
            type: "string",
            options: [
                { value: "court_physician", display: { en: "Court Physician", zh: "御医", ru: "Придворный врач", fr: "Médecin de cour", es: "Médico de la corte", de: "Hofarzt", ja: "宮廷医師", ko: "궁정 의사", pl: "Lekarz dworski" }},
                { value: "keeper_of_swans", display: { en: "Keeper of Swans", zh: "天鹅官", ru: "Смотритель лебедей", fr: "Gardien des cygnes", es: "Guardián de los cisnes", de: "Schwanenwärter", ja: "白鳥官", ko: "백조 관리자", pl: "Strażnik łabędzi" }},
                { value: "travel_leader", display: { en: "Travel Leader", zh: "旅行领队", ru: "Лидер путешествий", fr: "Chef de voyage", es: "Líder de viaje", de: "Reiseleiter", ja: "旅行隊長", ko: "여행 리더", pl: "Przywódca podróży" }},
                { value: "master_of_horse", display: { en: "Master of Horse", zh: "马厩总管", ru: "Конюший", fr: "Maître des chevaux", es: "Maestro de caballos", de: "Pferdemeister", ja: "厩舎長", ko: "마구간 총관", pl: "Mistrz koni" }},
                { value: "court_jester", display: { en: "Court Jester", zh: "宫廷小丑", ru: "Придворный шут", fr: "Bouffon de cour", es: "Bufón de la corte", de: "Hofnarr", ja: "宮廷道化師", ko: "궁정 어릿광대", pl: "Nadworny błazen" }},
                { value: "master_of_hunt", display: { en: "Master of Hunt", zh: "狩猎主管", ru: "Мастер охоты", fr: "Maître de chasse", es: "Maestro de caza", de: "Jagdmeister", ja: "狩猟長", ko: "사냥 총관", pl: "Mistrz polowania" }},
                { value: "high_almoner", display: { en: "High Almoner", zh: "大施赈官", ru: "Верховный милостынедатель", fr: "Grand aumônier", es: "Gran limosnero", de: "Großalmosenier", ja: "大施与官", ko: "대시진관", pl: "Wielki jałmużnik" }},
                { value: "cupbearer", display: { en: "Cupbearer", zh: "执杯官", ru: "Виночерпий", fr: "Échanson", es: "Copero", de: "Mundschenk", ja: "杯官", ko: "잔 따르는 관원", pl: "Podczaszy" }},
                { value: "seneschal", display: { en: "Seneschal", zh: "总管", ru: "Сенешаль", fr: "Sénéchal", es: "Senescal", de: "Seneschall", ja: "執事長", ko: "총관", pl: "Seneszał" }},
                { value: "antiquarian", display: { en: "Antiquarian", zh: "古物收藏家", ru: "Антиквар", fr: "Antiquaire", es: "Anticuaria", de: "Antiquitätenhändler", ja: "古物収集家", ko: "골동품 수집가", pl: "Antykwariusz" }},
                { value: "court_tutor", display: { en: "Court Tutor", zh: "导师", ru: "Придворный наставник", fr: "Précepteur de cour", es: "Tutor de la corte", de: "Hoflehrer", ja: "宮廷教師", ko: "궁정 교사", pl: "Nauczyciel dworski" }},
                { value: "royal_architect", display: { en: "Royal Architect", zh: "建筑师", ru: "Королевский архитектор", fr: "Architecte royal", es: "Arquitecto real", de: "Königlicher Architekt", ja: "王室建築家", ko: "왕실 건축가", pl: "Królewski architekt" }},
                { value: "court_poet", display: { en: "Court Poet", zh: "宫廷诗人", ru: "Придворный поэт", fr: "Poète de cour", es: "Poeta de la corte", de: "Hofdichter", ja: "宮廷詩人", ko: "궁정 시인", pl: "Nadworny poeta" }},
                { value: "bodyguard", display: { en: "Bodyguard", zh: "侍卫", ru: "Телохранитель", fr: "Garde du corps", es: "Guardaespaldas", de: "Leibwächter", ja: "護衛", ko: "보디가드", pl: "Ochroniarz" }},
                { value: "champion", display: { en: "Champion", zh: "宫廷冠军", ru: "Чемпион", fr: "Champion", es: "Campeón", de: "Champion", ja: "宮廷チャンピオン", ko: "궁정 챔피언", pl: "Champion" }},
                { value: "court_musician", display: { en: "Court Musician", zh: "音乐家", ru: "Придворный музыкант", fr: "Musicien de cour", es: "Músico de la corte", de: "Hofmusiker", ja: "宮廷音楽家", ko: "궁정 음악가", pl: "Nadworny muzyk" }},
                { value: "food_taster", display: { en: "Food Taster", zh: "试食官", ru: "Дегустатор пищи", fr: "Goûteur", es: "Catador de comida", de: "Vorkoster", ja: "試食官", ko: "시식관", pl: "Próbujący jedzenia" }},
                { value: "lady_in_waiting", display: { en: "Lady-in-Waiting", zh: "侍女", ru: "Фрейлина", fr: "Dame d'honneur", es: "Dama de compañía", de: "Hofdame", ja: "侍女", ko: "시녀", pl: "Dworzanka" }},
                { value: "chief_eunuch", display: { en: "Chief Eunuch", zh: "首席太监", ru: "Главный евнух", fr: "Eunuque en chef", es: "Eunuco jefe", de: "Obereunuch", ja: "首席宦官", ko: "수석 환관", pl: "Główny eunuch" }},
                { value: "court_gardener", display: { en: "Court Gardener", zh: "宫廷园丁", ru: "Придворный садовник", fr: "Jardinier de cour", es: "Jardinero de la corte", de: "Hofgärtner", ja: "宮廷庭師", ko: "궁정 정원사", pl: "Nadworny ogrodnik" }},
                { value: "chief_qadi", display: { en: "Chief Qadi", zh: "大法官", ru: "Главный кади", fr: "Cadi en chef", es: "Cadí jefe", de: "Oberkadi", ja: "大法官", ko: "대법관", pl: "Główny kadi" }},
                { value: "wet_nurse", display: { en: "Wet Nurse", zh: "乳母", ru: "Кормилица", fr: "Nourrice", es: "Nodriza", de: "Amme", ja: "乳母", ko: "유모", pl: "Mamka" }},
                { value: "akolouthos", display: { en: "Akolouthos", zh: "侍从官", ru: "Аколуф", fr: "Akolouthos", es: "Akolouthos", de: "Akoluth", ja: "侍従官", ko: "시종관", pl: "Akoluta" }}
            ],
            desc: { 
                en: "The court position to which {{character1Name}} decides to assign {{character2Name}}.",
                zh: "{{character1Name}}决定将{{character2Name}}分配到宫廷的职位。",
                ru: "Придворная должность, на которую {{character1Name}} решает назначить {{character2Name}}.",
                fr: "La charge curiale à laquelle {{character1Name}} décide d'assigner {{character2Name}}.",
                es: "El puesto en la corte al que {{character1Name}} decide asignar a {{character2Name}}.",
                de: "Die Hofposition, zu der {{character1Name}} {{character2Name}} ernennt.",
                ja: "{{character1Name}}が{{character2Name}}を任命することを決めた宮廷のポスト。",
                ko: "{{character1Name}}가 {{character2Name}}를 배정하기로 결정한 궁정 직책.",
                pl: "Stanowisko dworskie, na które {{character1Name}} decyduje się przydzielić {{character2Name}}."
            }
        } 
    ],
    description: {
        en: `Executed when a character appoints another to a court position in their court.`,
        zh: `当一个角色决定将另一个角色分配到其宫廷的宫廷职位时执行。`,
        ru: `Выполняется, когда один персонаж назначает другого на придворную должность в своем дворе.`,
        fr: `Exécuté lorsqu'un personnage nomme un autre à une charge curiale dans sa cour.`,
        es: `Ejecutado cuando un personaje nombra a otro para un puesto en su corte.`,
        de: `Wird ausgeführt, wenn ein Charakter einen anderen zu einer Hofposition ernennt.`,
        ja: `あるキャラクターが別のキャラクターを宮廷のポストに任命したときに実行されます。`,
        ko: `한 캐릭터가 다른 캐릭터를 궁정 직책에 임명했을 때 실행됩니다.`,
        pl: `Wykonywane, gdy jedna postać mianuje drugą na stanowisko dworskie.`
    },

    /**
     * @param {GameData} gameData 
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) =>{
        return true;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     * @param {number} sourceId
     * @param {number} targetId
     */

    run: (gameData, runGameEffect, args, sourceId, targetId) => {
        const court_position = args[0];
        switch (court_position) {
            case "court_physician":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = court_physician_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:votcce_action_target
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
                        recipient = global_var:votcce_action_target
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
                        recipient = global_var:votcce_action_target
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
                        recipient = global_var:votcce_action_target
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
                        recipient = global_var:votcce_action_target
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
                        recipient = global_var:votcce_action_target
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
                        recipient = global_var:votcce_action_target
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
                        recipient = global_var:votcce_action_target
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
                        recipient = global_var:votcce_action_target
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
                        recipient = global_var:votcce_action_target
                        court_position = antiquarian_court_position
                    }
                `);
                break;
            case "court_tutor":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = court_tutor_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:votcce_action_target
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
                        recipient = global_var:votcce_action_target
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
                        recipient = global_var:votcce_action_target
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
                        recipient = global_var:votcce_action_target
                        court_position = bodyguard_court_position
                    }
                `);
                break;
            case "champion":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = champion_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:votcce_action_target
                        court_position = champion_court_position
                    }
                `);
                break;
            case "court_musician":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = court_musician_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:votcce_action_target
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
                        recipient = global_var:votcce_action_target
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
                        recipient = global_var:votcce_action_target
                        court_position = lady_in_waiting_court_position
                    }
                `);
                break;
            case "chief_eunuch":
                runGameEffect(`
                    revoke_court_position = {
                        court_position = chief_eunuch_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:votcce_action_target
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
                        recipient = global_var:votcce_action_target
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
                        recipient = global_var:votcce_action_target
                        court_position = chief_qadi_court_position
                    }
                `);
                break;
            case "wet_nurse":
                runGameEffect(`
                    if={
                        limit = {
                            global_var:votcce_action_target = {
                            is_female = yes
                            }
                        }
                        revoke_court_position = {
                            court_position = wet_nurse_court_position
                            }
                        appoint_court_position = {
                            recipient = global_var:votcce_action_target
                            court_position = wet_nurse_court_position
                            }
                        }
                `);
                break;
            case "akolouthos":
                runGameEffect(`
                    if = {
                    limit = {
                        global_var:votcce_action_target = {
                            is_male = yes
                        }
                    }
                    revoke_court_position = {
                        court_position = akolouthos_court_position
                    }
                    
                    appoint_court_position = {
                        recipient = global_var:votcce_action_target
                        court_position = akolouthos_court_position
                    }
                    }
                `);
                break;
        }
    },    

    chatMessage: (args) =>{
        const positionValue = args[0];
        const positionOption = action.args[0].options.find(opt => opt.value === positionValue);
        
        const positionNames = positionOption ? positionOption.display : {
            en: positionValue, zh: positionValue, ru: positionValue, fr: positionValue, es: positionValue, de: positionValue, ja: positionValue, ko: positionValue, pl: positionValue
        };

        return {
            en: `{{character1Name}} appointed {{character2Name}} to the position of ${positionNames.en}.`,
            zh: `{{character1Name}}任命{{character2Name}}为${positionNames.zh}职位`,
            ru: `{{character1Name}} назначил {{character2Name}} на должность ${positionNames.ru}.`,
            fr: `{{character1Name}} a nommé {{character2Name}} au poste de ${positionNames.fr}.`,
            es: `{{character1Name}} nombró a {{character2Name}} al puesto de ${positionNames.es}.`,
            de: `{{character1Name}} hat {{character2Name}} zum ${positionNames.de} ernannt.`,
            ja: `{{character1Name}}は{{character2Name}}を${positionNames.ja}のポストに任命しました。`,
            ko: `{{character1Name}}는 {{character2Name}}를 ${positionNames.ko} 직책에 임명했습니다.`,
            pl: `{{character1Name}} mianował {{character2Name}} na stanowisko ${positionNames.pl}.`
        }
    },
    chatMessageClass: "neutral-action-message"
}
module.exports = action;
