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
            options: [
                { value: "御医", display: { en: "Court Physician", zh: "御医", ru: "Придворный врач", fr: "Médecin de cour", es: "Médico de la corte", de: "Hofarzt", ja: "宮廷医師", ko: "궁정 의사", pl: "Lekarz dworski" }},
                { value: "天鹅官", display: { en: "Keeper of Swans", zh: "天鹅官", ru: "Смотритель лебедей", fr: "Gardien des cygnes", es: "Guardián de los cisnes", de: "Schwanenwärter", ja: "白鳥官", ko: "백조 관리자", pl: "Strażnik łabędzi" }},
                { value: "旅行领队", display: { en: "Travel Leader", zh: "旅行领队", ru: "Лидер путешествий", fr: "Chef de voyage", es: "Líder de viaje", de: "Reiseleiter", ja: "旅行隊長", ko: "여행 리더", pl: "Przywódca podróży" }},
                { value: "马厩总管", display: { en: "Master of Horse", zh: "马厩总管", ru: "Конюший", fr: "Maître des chevaux", es: "Maestro de caballos", de: "Pferdemeister", ja: "厩舎長", ko: "마구간 총관", pl: "Mistrz koni" }},
                { value: "宫廷小丑", display: { en: "Court Jester", zh: "宫廷小丑", ru: "Придворный шут", fr: "Bouffon de cour", es: "Bufón de la corte", de: "Hofnarr", ja: "宮廷道化師", ko: "궁정 어릿광대", pl: "Nadworny błazen" }},
                { value: "狩猎主管", display: { en: "Master of Hunt", zh: "狩猎主管", ru: "Мастер охоты", fr: "Maître de chasse", es: "Maestro de caza", de: "Jagdmeister", ja: "狩猟長", ko: "사냥 총관", pl: "Mistrz polowania" }},
                { value: "大施赈官", display: { en: "High Almoner", zh: "大施赈官", ru: "Верховный милостынедатель", fr: "Grand aumônier", es: "Gran limosnero", de: "Großalmosenier", ja: "大施与官", ko: "대시진관", pl: "Wielki jałmużnik" }},
                { value: "执杯官", display: { en: "Cupbearer", zh: "执杯官", ru: "Виночерпий", fr: "Échanson", es: "Copero", de: "Mundschenk", ja: "杯官", ko: "잔 따르는 관원", pl: "Podczaszy" }},
                { value: "总管", display: { en: "Seneschal", zh: "总管", ru: "Сенешаль", fr: "Sénéchal", es: "Senescal", de: "Seneschall", ja: "執事長", ko: "총관", pl: "Seneszał" }},
                { value: "古物收藏家", display: { en: "Antiquarian", zh: "古物收藏家", ru: "Антиквар", fr: "Antiquaire", es: "Anticuaria", de: "Antiquitätenhändler", ja: "古物収集家", ko: "골동품 수집가", pl: "Antykwariusz" }},
                { value: "导师", display: { en: "Court Tutor", zh: "导师", ru: "Придворный наставник", fr: "Précepteur de cour", es: "Tutor de la corte", de: "Hoflehrer", ja: "宮廷教師", ko: "궁정 교사", pl: "Nauczyciel dworski" }},
                { value: "建筑师", display: { en: "Royal Architect", zh: "建筑师", ru: "Королевский архитектор", fr: "Architecte royal", es: "Arquitecto real", de: "Königlicher Architekt", ja: "王室建築家", ko: "왕실 건축가", pl: "Królewski architekt" }},
                { value: "宫廷诗人", display: { en: "Court Poet", zh: "宫廷诗人", ru: "Придворный поэт", fr: "Poète de cour", es: "Poeta de la corte", de: "Hofdichter", ja: "宮廷詩人", ko: "궁정 시인", pl: "Nadworny poeta" }},
                { value: "侍卫", display: { en: "Bodyguard", zh: "侍卫", ru: "Телохранитель", fr: "Garde du corps", es: "Guardaespaldas", de: "Leibwächter", ja: "護衛", ko: "보디가드", pl: "Ochroniarz" }},
                { value: "宫廷冠军", display: { en: "Champion", zh: "宫廷冠军", ru: "Чемпион", fr: "Champion", es: "Campeón", de: "Champion", ja: "宮廷チャンピオン", ko: "궁정 챔피언", pl: "Champion" }},
                { value: "音乐家", display: { en: "Court Musician", zh: "音乐家", ru: "Придворный музыкант", fr: "Musicien de cour", es: "Músico de la corte", de: "Hofmusiker", ja: "宮廷音楽家", ko: "궁정 음악가", pl: "Nadworny muzyk" }},
                { value: "试食官", display: { en: "Food Taster", zh: "试食官", ru: "Дегустатор пищи", fr: "Goûteur", es: "Catador de comida", de: "Vorkoster", ja: "試食官", ko: "시식관", pl: "Próbujący jedzenia" }},
                { value: "侍女", display: { en: "Lady-in-Waiting", zh: "侍女", ru: "Фрейлина", fr: "Dame d'honneur", es: "Dama de compañía", de: "Hofdame", ja: "侍女", ko: "시녀", pl: "Dworzanka" }},
                { value: "首席太监", display: { en: "Chief Eunuch", zh: "首席太监", ru: "Главный евнух", fr: "Eunuque en chef", es: "Eunuco jefe", de: "Obereunuch", ja: "首席宦官", ko: "수석 환관", pl: "Główny eunuch" }},
                { value: "宫廷园丁", display: { en: "Court Gardener", zh: "宫廷园丁", ru: "Придворный садовник", fr: "Jardinier de cour", es: "Jardinero de la corte", de: "Hofgärtner", ja: "宮廷庭師", ko: "궁정 정원사", pl: "Nadworny ogrodnik" }},
                { value: "大法官", display: { en: "Chief Qadi", zh: "大法官", ru: "Главный кади", fr: "Cadi en chef", es: "Cadí jefe", de: "Oberkadi", ja: "大法官", ko: "대법관", pl: "Główny kadi" }},
                { value: "乳母", display: { en: "Wet Nurse", zh: "乳母", ru: "Кормилица", fr: "Nourrice", es: "Nodriza", de: "Amme", ja: "乳母", ko: "유모", pl: "Mamka" }},
                { value: "侍从官", display: { en: "Akolouthos", zh: "侍从官", ru: "Аколуф", fr: "Akolouthos", es: "Akolouthos", de: "Akoluth", ja: "侍従官", ko: "시종관", pl: "Akoluta" }}
            ],
            desc: { 
                en: "The court position to which {{playerName}} decides to assign {{aiName}}.",
                zh: "{{playerName}}决定将{{aiName}}分配到宫廷的职位。",
                ru: "Придворная должность, на которую {{playerName}} решает назначить {{aiName}}.",
                fr: "La charge curiale à laquelle {{playerName}} décide d'assigner {{aiName}}.",
                es: "El puesto en la corte al que {{playerName}} decide asignar a {{aiName}}.",
                de: "Die Hofposition, zu der {{playerName}} {{aiName}} ernennt.",
                ja: "{{playerName}}が{{aiName}}を任命することを決めた宮廷のポスト。",
                ko: "{{playerName}}가 {{aiName}}를 배정하기로 결정한 궁정 직책.",
                pl: "Stanowisko dworskie, na które {{playerName}} decyduje się przydzielić {{aiName}}."
            }
        } 
    ],
    description: {
        en: `Executed when {{playerName}} appoints {{aiName}} to a court position in their court.`,
        zh: `当{{playerName}}决定将{{aiName}}分配到{{playerName}}宫廷的宫廷职位时执行。`,
        ru: `Выполняется, когда {{playerName}} назначает {{aiName}} на придворную должность в своем дворе.`,
        fr: `Exécuté lorsque {{playerName}} nomme {{aiName}} à une charge curiale dans sa cour.`,
        es: `Ejecutado cuando {{playerName}} nombra a {{aiName}} para un puesto en su corte.`,
        de: `Wird ausgeführt, wenn {{playerName}} {{aiName}} zu einer Hofposition ernennt.`,
        ja: `{{playerName}}が{{aiName}}を宮廷のポストに任命したときに実行されます。`,
        ko: `{{playerName}}가 {{aiName}}를 궁정 직책에 임명했을 때 실행됩니다.`,
        pl: `Wykonywane, gdy {{playerName}} mianuje {{aiName}} na stanowisko dworskie.`
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
        return {
            en: `You appointed {{aiName}} to the position of ${args[0]}.`,
            zh: `你任命{{aiName}}为${args[0]}职位`,
            ru: `Вы назначили {{aiName}} на должность ${args[0]}.`,
            fr: `Vous avez nommé {{aiName}} au poste de ${args[0]}.`,
            es: `Nombraste a {{aiName}} al puesto de ${args[0]}.`,
            de: `Du hast {{aiName}} zum ${args[0]} ernannt.`,
            ja: `あなたは{{aiName}}を${args[0]}のポストに任命しました。`,
            ko: `당신은 {{aiName}}를 ${args[0]} 직책에 임명했습니다.`,
            pl: `Mianowałeś {{aiName}} na stanowisko ${args[0]}.`
        }
    },
    chatMessageClass: "neutral-action-message"
}
