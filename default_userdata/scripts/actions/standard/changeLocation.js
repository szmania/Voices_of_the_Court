//Made by: GitHub Sync

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "changeLocation",
    args: [
        {
            name: "location",
            type: "string",
            options: [
                { value: 'alley_night', display: { en: 'Alley (Night)', zh: '小巷（夜晚）', ru: 'Переулок (ночь)', fr: 'Ruelle (Nuit)', es: 'Callejón (Noche)', de: 'Gasse (Nacht)', ja: '路地（夜）', ko: '골목 (밤)', pl: 'Zaułek (Noc)' }},
                { value: 'alley_day', display: { en: 'Alley (Day)', zh: '小巷（白天）', ru: 'Переулок (день)', fr: 'Ruelle (Jour)', es: 'Callejón (Día)', de: 'Gasse (Tag)', ja: '路地（昼）', ko: '골목 (낮)', pl: 'Zaułek (Dzień)' }},
                { value: 'armory', display: { en: 'Armory', zh: '军械库', ru: 'Оружейная', fr: 'Armurerie', es: 'Armería', de: 'Waffenkammer', ja: '武器庫', ko: '무기고', pl: 'Zbrojownia' }},
                { value: 'battlefield', display: { en: 'Battlefield', zh: '战场', ru: 'Поле боя', fr: 'Champ de bataille', es: 'Campo de batalla', de: 'Schlachtfeld', ja: '戦場', ko: '전장', pl: 'Pole bitwy' }},
                { value: 'temple', display: { en: 'Temple', zh: '寺庙', ru: 'Храм', fr: 'Temple', es: 'Templo', de: 'Tempel', ja: '寺院', ko: '사원', pl: 'Świątynia' }},
                { value: 'corridor_night', display: { en: 'Corridor (Night)', zh: '走廊（夜晚）', ru: 'Коридор (ночь)', fr: 'Couloir (Nuit)', es: 'Pasillo (Noche)', de: 'Korridor (Nacht)', ja: '廊下（夜）', ko: '복도 (밤)', pl: 'Korytarz (Noc)' }},
                { value: 'corridor_day', display: { en: 'Corridor (Day)', zh: '走廊（白天）', ru: 'Коридор (день)', fr: 'Couloir (Jour)', es: 'Pasillo (Día)', de: 'Korridor (Tag)', ja: '廊下（昼）', ko: '복도 (낮)', pl: 'Korytarz (Dzień)' }},
                { value: 'council_chamber', display: { en: 'Council Chamber', zh: '议事厅', ru: 'Зал совета', fr: 'Salle du conseil', es: 'Cámara del consejo', de: 'Ratskammer', ja: '評議会室', ko: '의회실', pl: 'Sala rady' }},
                { value: 'courtyard', display: { en: 'Courtyard', zh: '庭院', ru: 'Внутренний двор', fr: 'Cour', es: 'Patio', de: 'Innenhof', ja: '中庭', ko: '안뜰', pl: 'Dziedziniec' }},
                { value: 'dungeon', display: { en: 'Dungeon', zh: '地牢', ru: 'Подземелье', fr: 'Donjon', es: 'Mazmorra', de: 'Verlies', ja: '地下牢', ko: '지하 감옥', pl: 'Loch' }},
                { value: 'ocean', display: { en: 'Ocean', zh: '海洋', ru: 'Океан', fr: 'Océan', es: 'Océano', de: 'Ozean', ja: '海', ko: '바다', pl: 'Ocean' }},
                { value: 'terrain_travel', display: { en: 'Traveling Terrain', zh: '旅行地形', ru: 'Местность для путешествий', fr: 'Terrain de voyage', es: 'Terreno de viaje', de: 'Reisegelände', ja: '旅行地形', ko: '여행 지형', pl: 'Teren podróży' }},
                { value: 'docks', display: { en: 'Docks', zh: '码头', ru: 'Доки', fr: 'Docks', es: 'Muelles', de: 'Docks', ja: '波止場', ko: '부두', pl: 'Doki' }},
                { value: 'farmland', display: { en: 'Farmland', zh: '农田', ru: 'Сельскохозяйственные угодья', fr: 'Terres agricoles', es: 'Tierras de cultivo', de: 'Ackerland', ja: '農地', ko: '농지', pl: 'Ziemia uprawna' }},
                { value: 'feast', display: { en: 'Feast', zh: '宴会', ru: 'Пир', fr: 'Festin', es: 'Banquete', de: 'Festmahl', ja: '饗宴', ko: '연회', pl: 'Uczta' }},
                { value: 'gallows', display: { en: 'Gallows', zh: '绞刑架', ru: 'Виселица', fr: 'Potence', es: 'Horca', de: 'Galgen', ja: '絞首台', ko: '교수대', pl: 'Szubienica' }},
                { value: 'garden', display: { en: 'Garden', zh: '花园', ru: 'Сад', fr: 'Jardin', es: 'Jardín', de: 'Garten', ja: '庭園', ko: '정원', pl: 'Ogród' }},
                { value: 'market', display: { en: 'Market', zh: '市场', ru: 'Рынок', fr: 'Marché', es: 'Mercado', de: 'Markt', ja: '市場', ko: '시장', pl: 'Targ' }},
                { value: 'village', display: { en: 'Village', zh: '村庄', ru: 'Деревня', fr: 'Village', es: 'Aldea', de: 'Dorf', ja: '村', ko: '마을', pl: 'Wioska' }},
                { value: 'burning_building', display: { en: 'Burning Building', zh: '燃烧的建筑', ru: 'Горящее здание', fr: 'Bâtiment en feu', es: 'Edificio en llamas', de: 'Brennendes Gebäude', ja: '燃える建物', ko: '불타는 건물', pl: 'Płonący budynek' }},
                { value: 'sitting_room', display: { en: 'Sitting Room', zh: '客厅', ru: 'Гостиная', fr: 'Salon', es: 'Sala de estar', de: 'Wohnzimmer', ja: '居間', ko: '거실', pl: 'Pokój dzienny' }},
                { value: 'bedchamber', display: { en: 'Bedchamber', zh: '寝室', ru: 'Спальня', fr: 'Chambre à coucher', es: 'Dormitorio', de: 'Schlafgemach', ja: '寝室', ko: '침실', pl: 'Sypialnia' }},
                { value: 'study', display: { en: 'Study', zh: '书房', ru: 'Кабинет', fr: 'Bureau', es: 'Estudio', de: 'Arbeitszimmer', ja: '書斎', ko: '서재', pl: 'Gabinet' }},
                { value: 'relaxing_room', display: { en: 'Relaxing Room', zh: '休息室', ru: 'Комната отдыха', fr: 'Salle de détente', es: 'Sala de relajación', de: 'Ruheraum', ja: '休憩室', ko: '휴게실', pl: 'Pokój relaksacyjny' }},
                { value: 'physicians_study', display: { en: 'Physician\'s Study', zh: '医师书房', ru: 'Кабинет врача', fr: 'Bureau du médecin', es: 'Estudio del médico', de: 'Arbeitszimmer des Arztes', ja: '医者の書斎', ko: '의사의 서재', pl: 'Gabinet lekarza' }},
                { value: 'tavern', display: { en: 'Tavern', zh: '酒馆', ru: 'Таверна', fr: 'Taverne', es: 'Taberna', de: 'Taverne', ja: '酒場', ko: '선술집', pl: 'Tawerna' }},
                { value: 'throne_room', display: { en: 'Throne Room', zh: '王座室', ru: 'Тронный зал', fr: 'Salle du trône', es: 'Salón del trono', de: 'Thronsaal', ja: '玉座の間', ko: '왕좌의 방', pl: 'Sala tronowa' }},
                { value: 'estate', display: { en: 'Estate', zh: '庄园', ru: 'Поместье', fr: 'Domaine', es: 'Finca', de: 'Anwesen', ja: '不動産', ko: '사유지', pl: 'Posiadłość' }},
                { value: 'army_camp', display: { en: 'Army Camp', zh: '军营', ru: 'Военный лагерь', fr: 'Camp militaire', es: 'Campamento militar', de: 'Heerlager', ja: '軍のキャンプ', ko: '군대 캠프', pl: 'Obóz wojskowy' }},
                { value: 'bath_house', display: { en: 'Bath House', zh: '澡堂', ru: 'Баня', fr: 'Bains publics', es: 'Casa de baños', de: 'Badehaus', ja: '風呂屋', ko: '목욕탕', pl: 'Łaźnia' }},
                { value: 'runestone', display: { en: 'Runestone', zh: '符文石', ru: 'Рунический камень', fr: 'Pierre runique', es: 'Piedra rúnica', de: 'Runenstein', ja: 'ルーンストーン', ko: '룬스톤', pl: 'Kamień runiczny' }},
                { value: 'runestone_circle', display: { en: 'Runestone Circle', zh: '符文石圈', ru: 'Круг рунических камней', fr: 'Cercle de pierres runiques', es: 'Círculo de piedras rúnicas', de: 'Runenstein-Kreis', ja: 'ルーンストーンサークル', ko: '룬스톤 서클', pl: 'Krąg kamieni runicznych' }},
                { value: 'beached_longships', display: { en: 'Beached Longships', zh: '搁浅的长船', ru: 'Вытащенные на берег драккары', fr: 'Drakkars échoués', es: 'Drakkars varados', de: 'Gestrandete Langschiffe', ja: '浜に揚げられたロングシップ', ko: '해변에 정박한 롱십', pl: 'Wylądowane drakkary' }},
                { value: 'kitchen', display: { en: 'Kitchen', zh: '厨房', ru: 'Кухня', fr: 'Cuisine', es: 'Cocina', de: 'Küche', ja: '台所', ko: '주방', pl: 'Kuchnia' }},
                { value: 'bonfire', display: { en: 'Bonfire', zh: '篝火', ru: 'Костер', fr: 'Feu de joie', es: 'Hoguera', de: 'Lagerfeuer', ja: '焚き火', ko: '모닥불', pl: 'Ognisko' }},
                { value: 'wine_cellar', display: { en: 'Wine Cellar', zh: '酒窖', ru: 'Винный погреб', fr: 'Cave à vin', es: 'Bodega', de: 'Weinkeller', ja: 'ワインセラー', ko: '와인 저장고', pl: 'Piwnica na wino' }},
                { value: 'crossroads_inn', display: { en: 'Crossroads Inn', zh: '十字路口客栈', ru: 'Таверна на перекрестке', fr: 'Auberge du carrefour', es: 'Posada del cruce de caminos', de: 'Gasthaus am Scheideweg', ja: '十字路の宿屋', ko: '교차로 여관', pl: 'Gospoda na rozdrożu' }},
                { value: 'cave', display: { en: 'Cave', zh: '洞穴', ru: 'Пещера', fr: 'Grotte', es: 'Cueva', de: 'Höhle', ja: '洞窟', ko: '동굴', pl: 'Jaskinia' }},
                { value: 'tournament', display: { en: 'Tournament', zh: '锦标赛', ru: 'Турнир', fr: 'Tournoi', es: 'Torneo', de: 'Turnier', ja: 'トーナメント', ko: '토너먼트', pl: 'Turniej' }},
                { value: 'holy_site', display: { en: 'Holy Site', zh: '圣地', ru: 'Святое место', fr: 'Lieu saint', es: 'Lugar sagrado', de: 'Heiliger Ort', ja: '聖地', ko: '성지', pl: 'Święte miejsce' }},
                { value: 'travel_bridge', display: { en: 'Travel Bridge', zh: '旅行桥', ru: 'Мост для путешествий', fr: 'Pont de voyage', es: 'Puente de viaje', de: 'Reisebrücke', ja: '旅の橋', ko: '여행 다리', pl: 'Most podróżny' }},
                { value: 'hunt_forest_hut', display: { en: 'Forest Hut (Hunt)', zh: '森林小屋（狩猎）', ru: 'Лесная хижина (охота)', fr: 'Hutte forestière (Chasse)', es: 'Cabaña del bosque (Caza)', de: 'Waldhütte (Jagd)', ja: '森の小屋（狩猟）', ko: '숲속 오두막 (사냥)', pl: 'Chata w lesie (Polowanie)' }},
                { value: 'hunt_forest_cave', display: { en: 'Forest Cave (Hunt)', zh: '森林洞穴（狩猎）', ru: 'Лесная пещера (охота)', fr: 'Grotte forestière (Chasse)', es: 'Cueva del bosque (Caza)', de: 'Waldhöhle (Jagd)', ja: '森の洞窟（狩猟）', ko: '숲속 동굴 (사냥)', pl: 'Jaskinia w lesie (Polowanie)' }},
                { value: 'hunt_foggy_forest', display: { en: 'Foggy Forest (Hunt)', zh: '多雾的森林（狩猎）', ru: 'Туманный лес (охота)', fr: 'Forêt brumeuse (Chasse)', es: 'Bosque neblinoso (Caza)', de: 'Nebliger Wald (Jagd)', ja: '霧の森（狩猟）', ko: '안개 낀 숲 (사냥)', pl: 'Mglisty las (Polowanie)' }},
                { value: 'dog_kennels', display: { en: 'Dog Kennels', zh: '狗舍', ru: 'Собачьи будки', fr: 'Chenils', es: 'Perreras', de: 'Hundezwinger', ja: '犬小屋', ko: '개집', pl: 'Psiarnie' }},
                { value: 'hunt_poachers_camp', display: { en: 'Poacher\'s Camp (Hunt)', zh: '偷猎者营地（狩猎）', ru: 'Лагерь браконьеров (охота)', fr: 'Camp de braconniers (Chasse)', es: 'Campamento de cazadores furtivos (Caza)', de: 'Wildererlager (Jagd)', ja: '密猟者のキャンプ（狩猟）', ko: '밀렵꾼의 캠프 (사냥)', pl: 'Obóz kłusowników (Polowanie)' }},
                { value: 'hunt_activity_camp', display: { en: 'Activity Camp (Hunt)', zh: '活动营地（狩猎）', ru: 'Лагерь для активностей (охота)', fr: 'Camp d\'activités (Chasse)', es: 'Campamento de actividades (Caza)', de: 'Aktivitätscamp (Jagd)', ja: 'アクティビティキャンプ（狩猟）', ko: '활동 캠프 (사냥)', pl: 'Obóz aktywności (Polowanie)' }},
                { value: 'wedding_ceremony', display: { en: 'Wedding Ceremony', zh: '婚礼', ru: 'Свадебная церемония', fr: 'Cérémonie de mariage', es: 'Ceremonia de boda', de: 'Hochzeitszeremonie', ja: '結婚式', ko: '결혼식', pl: 'Ceremonia ślubna' }},
                { value: 'involved_activity', display: { en: 'Involved Activity', zh: '参与活动', ru: 'Вовлеченная деятельность', fr: 'Activité impliquée', es: 'Actividad involucrada', de: 'Beteiligte Aktivität', ja: '関与する活動', ko: '참여 활동', pl: 'Zaangażowana aktywność' }},
                { value: 'nursery', display: { en: 'Nursery', zh: '育儿室', ru: 'Детская', fr: 'Nursery', es: 'Guardería', de: 'Kinderzimmer', ja: '保育園', ko: '육아실', pl: 'Żłobek' }},
                { value: 'university', display: { en: 'University', zh: '大学', ru: 'Университет', fr: 'Université', es: 'Universidad', de: 'Universität', ja: '大学', ko: '대학교', pl: 'Uniwersytet' }},
                { value: 'catacombs', display: { en: 'Catacombs', zh: '地下墓穴', ru: 'Катакомбы', fr: 'Catacombes', es: 'Catacumbas', de: 'Katakomben', ja: 'カタコンベ', ko: '카타콤', pl: 'Katakumby' }},
                { value: 'condemned_village', display: { en: 'Condemned Village', zh: '被谴责的村庄', ru: 'Осужденная деревня', fr: 'Village condamné', es: 'Aldea condenada', de: 'Verdammtes Dorf', ja: '非難された村', ko: '저주받은 마을', pl: 'Potępiona wioska' }},
                { value: 'funeral_pyre', display: { en: 'Funeral Pyre', zh: '葬礼柴堆', ru: 'Погребальный костер', fr: 'Bûcher funéraire', es: 'Pira funeraria', de: 'Scheiterhaufen', ja: '葬送の薪', ko: '장작더미', pl: 'Stos pogrzebowy' }},
                { value: 'legendary_battlefield', display: { en: 'Legendary Battlefield', zh: '传说中的战场', ru: 'Легендарное поле боя', fr: 'Champ de bataille légendaire', es: 'Campo de batalla legendario', de: 'Legendäres Schlachtfeld', ja: '伝説の戦場', ko: '전설적인 전장', pl: 'Legendarne pole bitwy' }},
                { value: 'constantinople', display: { en: 'Constantinople', zh: '君士坦丁堡', ru: 'Константинополь', fr: 'Constantinople', es: 'Constantinopla', de: 'Konstantinopel', ja: 'コンスタンティノープル', ko: '콘스탄티노플', pl: 'Konstantynopol' }},
                { value: 'city_gate', display: { en: 'City Gate', zh: '城门', ru: 'Городские ворота', fr: 'Porte de la ville', es: 'Puerta de la ciudad', de: 'Stadttor', ja: '都市の門', ko: '도시의 문', pl: 'Brama miejska' }},
                { value: 'relaxing_tent', display: { en: 'Relaxing Tent', zh: '休闲帐篷', ru: 'Палатка для отдыха', fr: 'Tente de détente', es: 'Tienda de relajación', de: 'Entspannungszelt', ja: 'リラックスできるテント', ko: '휴식 텐트', pl: 'Namiot relaksacyjny' }},
                { value: 'survey', display: { en: 'Survey', zh: '调查', ru: 'Опрос', fr: 'Sondage', es: 'Encuesta', de: 'Umfrage', ja: '調査', ko: '설문조사', pl: 'Ankieta' }},
                { value: 'terrain_settlement', display: { en: 'Settlement', zh: '定居点', ru: 'Поселение', fr: 'Colonie', es: 'Asentamiento', de: 'Siedlung', ja: '集落', ko: '정착지', pl: 'Osada' }},
                { value: 'terrain_settlement_no_owner', display: { en: 'Unowned Settlement', zh: '无主定居点', ru: 'Бесхозное поселение', fr: 'Colonie sans propriétaire', es: 'Asentamiento sin dueño', de: 'Unbesessene Siedlung', ja: '所有者のいない集落', ko: '주인 없는 정착지', pl: 'Osada bez właściciela' }},
                { value: 'campfire', display: { en: 'Campfire', zh: '营火', ru: 'Костер', fr: 'Feu de camp', es: 'Fogata', de: 'Lagerfeuer', ja: 'キャンプファイヤー', ko: '캠프파이어', pl: 'Ognisko' }},
                { value: 'camp', display: { en: 'Camp', zh: '营地', ru: 'Лагерь', fr: 'Camp', es: 'Campamento', de: 'Lager', ja: 'キャンプ', ko: '캠프', pl: 'Obóz' }},
                { value: 'camp_night', display: { en: 'Camp (Night)', zh: '营地（夜晚）', ru: 'Лагерь (ночь)', fr: 'Camp (Nuit)', es: 'Campamento (Noche)', de: 'Lager (Nacht)', ja: 'キャンプ（夜）', ko: '캠프 (밤)', pl: 'Obóz (Noc)' }},
                { value: 'military_tent', display: { en: 'Military Tent', zh: '军用帐篷', ru: 'Военная палатка', fr: 'Tente militaire', es: 'Tienda militar', de: 'Militärzelt', ja: '軍用テント', ko: '군용 텐트', pl: 'Namiot wojskowy' }},
                { value: 'village_festival', display: { en: 'Village Festival', zh: '乡村节日', ru: 'Деревенский фестиваль', fr: 'Fête de village', es: 'Festival del pueblo', de: 'Dorffest', ja: '村祭り', ko: '마을 축제', pl: 'Festiwal wiejski' }},
                { value: 'coast', display: { en: 'Coast', zh: '海岸', ru: 'Побережье', fr: 'Côte', es: 'Costa', de: 'Küste', ja: '海岸', ko: '해안', pl: 'Wybrzeże' }},
                { value: 'city_steppe', display: { en: 'Steppe City', zh: '草原城市', ru: 'Степной город', fr: 'Ville de la steppe', es: 'Ciudad de la estepa', de: 'Steppenstadt', ja: 'ステップの都市', ko: '초원 도시', pl: 'Miasto na stepie' }},
                { value: 'examination_room', display: { en: 'Examination Room', zh: '检查室', ru: 'Смотровой кабинет', fr: 'Salle d\'examen', es: 'Sala de examen', de: 'Untersuchungsraum', ja: '診察室', ko: '검사실', pl: 'Gabinet badań' }},
                { value: 'chinese_city', display: { en: 'Chinese City', zh: '中国城市', ru: 'Китайский город', fr: 'Ville chinoise', es: 'Ciudad china', de: 'Chinesische Stadt', ja: '中国の都市', ko: '중국 도시', pl: 'Chińskie miasto' }},
                { value: 'japanese_city', display: { en: 'Japanese City', zh: '日本城市', ru: 'Японский город', fr: 'Ville japonaise', es: 'Ciudad japonesa', de: 'Japanische Stadt', ja: '日本の都市', ko: '일본 도시', pl: 'Japońskie miasto' }}
            ],
            desc: {
                en: "the new location where {{character1Name}} moves to",
                zh: "{{character1Name}}移动到的新位置",
                ru: "новое место, куда переезжает {{character1Name}}",
                fr: "le nouvel endroit où {{character1Name}} déménage",
                es: "la nueva ubicación a la que se muda {{character1Name}}",
                de: "der neue Ort, an den {{character1Name}} umzieht",
                ja: "{{character1Name}}が移動する新しい場所",
                ko: "{{character1Name}}가 이동하는 새로운 위치",
                pl: "nowa lokalizacja, do której przenosi się {{character1Name}}"
            }
        }
    ],
    description: {
        en: `Executed when a character changes location.`,
        zh: `当一个角色改变位置时执行。`,
        ru: `Выполняется, когда персонаж меняет местоположение.`,
        fr: `Exécuté lorsqu'un personnage change de lieu.`,
        es: `Ejecutado cuando un personaje cambia de ubicación.`,
        de: `Wird ausgeführt, wenn ein Charakter den Ort wechselt.`,
        ja: `キャラクターが場所を変更したときに実行されます。`,
        ko: `캐릭터가 위치를 변경할 때 실행됩니다.`,
        pl: `Wykonywane, gdy postać zmienia lokalizację.`
    },

    /**
     * @param {GameData} gameData
     * @param {number} initiatorId
     * @param {number} targetId
     */
    check: (gameData, initiatorId, targetId) => {
        return true;
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
            global_var:votcce_action_source = {
                move_character_to_location_effect = {
                    LOCATION = ${args[0]}
                }
            }
        `);
    },
    chatMessage: (args) =>{
        return {
            en: `{{character1Name}} moved to ${args[0]}.`,
            zh: `{{character1Name}}移动到了${args[0]}。`,
            ru: `{{character1Name}} переместился в ${args[0]}.`,
            fr: `{{character1Name}} s'est déplacé vers ${args[0]}.`,
            es: `{{character1Name}} se trasladó a ${args[0]}.`,
            de: `{{character1Name}} ist nach ${args[0]} gezogen.`,
            ja: `{{character1Name}}は${args[0]}に移動しました。`,
            ko: `{{character1Name}}가 ${args[0]}(으)로 이동했습니다.`,
            pl: `{{character1Name}} przeniósł się do ${args[0]}.`
        }
    },
    chatMessageClass: "neutral-action-message"
}
