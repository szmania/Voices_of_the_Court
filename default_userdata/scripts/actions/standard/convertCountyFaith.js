//Made by: software_engineer_ck3

function normalizeFaithKey(key) {
    if (!key) return null;
    key = String(key).toLowerCase().replace(/[^a-z0-9_]/g, "");
    return key.length >= 2 && key.length <= 64 ? key : null;
}

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

module.exports = {
    signature: "convertCountyFaith",
    args: [
        {
            name: "quickPickFaith",
            type: "enum",
            options: [
                { value: 'akom_pagan', display: { en: 'Akom Pagan', zh: '阿科姆异教', ru: 'Акомское язычество', fr: 'Paganisme Akom', es: 'Paganismo Akom', de: 'Akom-Heidentum', ja: 'アコム異教', ko: '아콤 이교', pl: 'Pogaństwo Akom', pt: 'Paganismo Akom', tr: 'Akom Paganizmi' }},
                { value: 'aluk', display: { en: 'Aluk', zh: '阿卢克', ru: 'Алюк', fr: 'Aluk', es: 'Aluk', de: 'Aluk', ja: 'アルク', ko: '알룩', pl: 'Aluk', pt: 'Aluk', tr: 'Aluk' }},
                { value: 'baltic_pagan', display: { en: 'Baltic Pagan', zh: '波罗的海异教', ru: 'Балтийское язычество', fr: 'Paganisme Balte', es: 'Paganismo Báltico', de: 'Baltisches Heidentum', ja: 'バルト異教', ko: '발트 이교', pl: 'Pogaństwo Bałtyckie', pt: 'Paganismo Báltico', tr: 'Baltık Paganizmi' }},
                { value: 'basque_pagan', display: { en: 'Basque Pagan', zh: '巴斯克异教', ru: 'Баскское язычество', fr: 'Paganisme Basque', es: 'Paganismo Vasco', de: 'Baskisches Heidentum', ja: 'バスク異教', ko: '바스크 이교', pl: 'Pogaństwo Baskijskie', pt: 'Paganismo Basco', tr: 'Bask Paganizmi' }},
                { value: 'bilikuism', display: { en: 'Bilikuism', zh: '比利库主义', ru: 'Биликуизм', fr: 'Bilikuisme', es: 'Bilicuísmo', de: 'Bilikuisimus', ja: 'ビリクイズム', ko: '빌리쿠이즘', pl: 'Bilikuizm', pt: 'Bilikuísmo', tr: 'Bilikuizm' }},
                { value: 'pulugaism', display: { en: 'Pulugaism', zh: '普鲁高主义', ru: 'Пулугаизм', fr: 'Pulugaisme', es: 'Pulugaismo', de: 'Pulugaismus', ja: 'プルガイズム', ko: '풀루가이즘', pl: 'Pulugaizm', pt: 'Pulugaismo', tr: 'Pulugaizm' }},
                { value: 'bimoism', display: { en: 'Bimoism', zh: '比莫主义', ru: 'Бимоизм', fr: 'Bimoïsme', es: 'Bimoísmo', de: 'Bimoismus', ja: 'ビモイズム', ko: '비모이즘', pl: 'Bimoizm', pt: 'Bimoísmo', tr: 'Bimoizm' }},
                { value: 'bon_faith', display: { en: 'Bön Faith', zh: '苯教', ru: 'Бонская вера', fr: 'Foi Bön', es: 'Fe Bön', de: 'Bön-Glaube', ja: 'ボン教', ko: '뵌 신앙', pl: 'Wiara Bön', pt: 'Fé Bön', tr: 'Bon İnancı' }},
                { value: 'theravada_faith', display: { en: 'Theravada Faith', zh: '上座部佛教', ru: 'Тхеравада', fr: 'Foi Theravada', es: 'Fe Theravada', de: 'Theravada-Glaube', ja: '上座部仏教', ko: '테라바다 신앙', pl: 'Wiara Therawada', pt: 'Fé Teravada', tr: 'Theravada İnancı' }},
                { value: 'mahayana_faith', display: { en: 'Mahayana Faith', zh: '大乘佛教', ru: 'Махаяна', fr: 'Foi Mahayana', es: 'Fe Mahayana', de: 'Mahayana-Glaube', ja: '大乗仏教', ko: '대승 신앙', pl: 'Wiara Mahajana', pt: 'Fé Mahayana', tr: 'Mahayana İnancı' }},
                { value: 'maitreya_faith', display: { en: 'Maitreya Faith', zh: '弥勒信仰', ru: 'Майтрейя', fr: 'Foi Maitreya', es: 'Fe Maitreya', de: 'Maitreya-Glaube', ja: '弥勒信仰', ko: '미륵 신앙', pl: 'Wiara Majtreja', pt: 'Fé Maitreya', tr: 'Maitreya İnancı' }},
                { value: 'vajrayana_faith', display: { en: 'Vajrayana Faith', zh: '金刚乘', ru: 'Ваджраяна', fr: 'Foi Vajrayana', es: 'Fe Vajrayana', de: 'Vajrayana-Glaube', ja: '金剛乗', ko: '바즈라야나 신앙', pl: 'Wiara Wadżrajana', pt: 'Fé Vajrayana', tr: 'Vajrayana İnancı' }},
                { value: 'christian_faith', display: { en: 'Christian Faith', zh: '基督教', ru: 'Христианская вера', fr: 'Foi Chrétienne', es: 'Fe Cristiana', de: 'Christlicher Glaube', ja: 'キリスト教', ko: '기독교 신앙', pl: 'Wiara Chrześcijańska', pt: 'Fé Cristã', tr: 'Hristiyan İnancı' }},
                { value: 'catholic', display: { en: 'Catholic', zh: '天主教', ru: 'Католичество', fr: 'Catholicisme', es: 'Catolicismo', de: 'Katholizismus', ja: 'カトリック', ko: '가톨릭', pl: 'Katolicyzm', pt: 'Catolicismo', tr: 'Katolik' }},
                { value: 'orthodox', display: { en: 'Orthodox', zh: '东正教', ru: 'Православие', fr: 'Orthodoxie', es: 'Ortodoxia', de: 'Orthodoxie', ja: '正教', ko: '정교회', pl: 'Prawosławie', pt: 'Ortodoxia', tr: 'Ortodoks' }},
                { value: 'miaphysitism', display: { en: 'Miaphysitism', zh: '一性论', ru: 'Миафизитство', fr: 'Miaohysitisme', es: 'Miafisismo', de: 'Miaohysitismus', ja: '単性論', ko: '단성론', pl: 'Miafizytyzm', pt: 'Miafisitismo', tr: 'Miyafizitizm' }},
                { value: 'armenian_apostolic', display: { en: 'Armenian Apostolic', zh: '亚美尼亚使徒教', ru: 'Армянская Апостольская', fr: 'Apostolique Arménien', es: 'Apostólico Armenio', de: 'Armenisch-Apostolisch', ja: 'アルメニア使徒教', ko: '아르메니아 사도교', pl: 'Ormiański Apostolski', pt: 'Apostólico Armênio', tr: 'Ermeni Apostolik' }},
                { value: 'conversos', display: { en: 'Conversos', zh: '皈依者', ru: 'Конверсос', fr: 'Conversos', es: 'Conversos', de: 'Conversos', ja: 'コンベルソ', ko: '개종자', pl: 'Konwersi', pt: 'Conversos', tr: 'Conversos' }},
                { value: 'cathar', display: { en: 'Cathar', zh: '卡特里派', ru: 'Катары', fr: 'Cathare', es: 'Cátaro', de: 'Katharer', ja: 'カタリ派', ko: '카타르파', pl: 'Katarzy', pt: 'Cátaros', tr: 'Kathar' }},
                { value: 'waldensian', display: { en: 'Waldensian', zh: '瓦勒度派', ru: 'Вальденсы', fr: 'Vaudois', es: 'Valdense', de: 'Waldenser', ja: 'ワルドー派', ko: '왈도파', pl: 'Waldensi', pt: 'Valdenses', tr: 'Valdens' }},
                { value: 'lollard', display: { en: 'Lollard', zh: '罗拉德派', ru: 'Лоллиды', fr: 'Lollard', es: 'Lolardo', de: 'Lollarden', ja: 'ロラード派', ko: '롤라드파', pl: 'Lollardzi', pt: 'Lolardos', tr: 'Lollard' }},
                { value: 'hussite', display: { en: 'Hussite', zh: '胡斯派', ru: 'Гуситы', fr: 'Hussite', es: 'Husita', de: 'Hussiten', ja: 'フス派', ko: '후스파', pl: 'Husyci', pt: 'Hussita', tr: 'Husit' }},
                { value: 'joachimite', display: { en: 'Joachimite', zh: '约阿希姆派', ru: 'Иоахимиты', fr: 'Joachimite', es: 'Joaquimita', de: 'Joachimiten', ja: 'ヨアヒム派', ko: '요아힘파', pl: 'Joachimici', pt: 'Joaquimita', tr: 'Joahimit' }},
                { value: 'iconoclast', display: { en: 'Iconoclast', zh: '圣像破坏者', ru: 'Иконоборец', fr: 'Iconoclaste', es: 'Iconoclasta', de: 'Ikonoklast', ja: 'イコノクラスト', ko: '성상파괴자', pl: 'Ikonoklasta', pt: 'Iconoclasta', tr: 'İkonoklast' }},
                { value: 'bogomilist', display: { en: 'Bogomilist', zh: '波格米勒派', ru: 'Богомилы', fr: 'Bogomile', es: 'Bogomilo', de: 'Bogomilen', ja: 'ボゴミル派', ko: '보고밀파', pl: 'Bogomili', pt: 'Bogomilo', tr: 'Bogomil' }},
                { value: 'paulician', display: { en: 'Paulician', zh: '保利西亚派', ru: 'Павликиане', fr: 'Paulicien', es: 'Pauliciano', de: 'Paulikianer', ja: 'パウリキア派', ko: '바울파', pl: 'Paulicjanie', pt: 'Pauliciano', tr: 'Paulikian' }},
                { value: 'nestorian', display: { en: 'Nestorian', zh: '聂斯脱里派', ru: 'Несториане', fr: 'Nestorien', es: 'Nestoriano', de: 'Nestorianer', ja: 'ネストリウス派', ko: '네스토리우스파', pl: 'Nestorianizm', pt: 'Nestoriano', tr: 'Nesturi' }},
                { value: 'messalian', display: { en: 'Messalian', zh: '美萨利安派', ru: 'Мессалиане', fr: 'Messalien', es: 'Mesaliano', de: 'Messalianer', ja: 'メッサリアン派', ko: '메살리아파', pl: 'Mesalianie', pt: 'Mesaliano', tr: 'Mesalyan' }},
                { value: 'adamites', display: { en: 'Adamites', zh: '亚当派', ru: 'Адамиты', fr: 'Adamites', es: 'Adamitas', de: 'Adamiten', ja: 'アダマイト', ko: '아담파', pl: 'Adamici', pt: 'Adamitas', tr: 'Adamitler' }},
                { value: 'bosnian_church', display: { en: 'Bosnian Church', zh: '波斯尼亚教会', ru: 'Боснийская церковь', fr: 'Église Bosnienne', es: 'Iglesia Bosnia', de: 'Bosnische Kirche', ja: 'ボスニア教会', ko: '보스니아 교회', pl: 'Kościół Bośniacki', pt: 'Igreja Bósnia', tr: 'Boşnak Kilisesi' }},
                { value: 'adoptionist', display: { en: 'Adoptionist', zh: '嗣子说', ru: 'Адопционизм', fr: 'Adoptionisme', es: 'Adopcionismo', de: 'Adoptianismus', ja: '養子縁組説', ko: '양자론', pl: 'Adopcjonizm', pt: 'Adocionismo', tr: 'Evlat Edinmeci' }},
                { value: 'confucian_faith', display: { en: 'Confucian Faith', zh: '儒教', ru: 'Конфуцианство', fr: 'Foi Confucianiste', es: 'Fe Confuciana', de: 'Konfuzianismus', ja: '儒教', ko: '유교 신앙', pl: 'Wiara Konfucjańska', pt: 'Fé Confuciana', tr: 'Konfüçyüs İnancı' }},
                { value: 'dayawism', display: { en: 'Dayawism', zh: '达亚维主义', ru: 'Даявизм', fr: 'Dayawisme', es: 'Dayawismo', de: 'Dayawismus', ja: 'ダヤウィズム', ko: '다야위즘', pl: 'Dayawizm', pt: 'Dayawismo', tr: 'Dayawizm' }},
                { value: 'donyipoloism', display: { en: 'Donyi-Poloism', zh: '多尼-波洛主义', ru: 'Доньи-Полоизм', fr: 'Donyi-Poloïsme', es: 'Donyi-Poloísmo', de: 'Donyi-Poloismus', ja: 'ドニポロイズム', ko: '도니이폴로이즘', pl: 'Donyi-Poloizm', pt: 'Donyi-Poloísmo', tr: 'Donyi-Poloizm' }},
                { value: 'sedism', display: { en: 'Sedism', zh: '塞德主义', ru: 'Седизм', fr: 'Sédism', es: 'Sedismo', de: 'Sedismus', ja: 'セディズム', ko: '세디즘', pl: 'Sedizm', pt: 'Sedismo', tr: 'Sedizm' }},
                { value: 'manichaean_faith', display: { en: 'Manichaean Faith', zh: '摩尼教', ru: 'Манихейство', fr: 'Foi Manichéenne', es: 'Fe Maniquea', de: 'Manichäismus', ja: 'マニ教', ko: '마니교 신앙', pl: 'Wiara Manichejska', pt: 'Fé Maniqueísta', tr: 'Maniheist İnancı' }},
                { value: 'mandaean_faith', display: { en: 'Mandaean Faith', zh: '曼达教', ru: 'Мандаизм', fr: 'Foi Mandéenne', es: 'Fe Mandéa', de: 'Mandäismus', ja: 'マンダ教', ko: '만다야교 신앙', pl: 'Wiara Mandejska', pt: 'Fé Mandéia', tr: 'Mandae İnancı' }},
                { value: 'gnostic_faith', display: { en: 'Gnostic Faith', zh: '诺斯替教', ru: 'Гностицизм', fr: 'Foi Gnostique', es: 'Fe Gnóstica', de: 'Gnostizismus', ja: 'グノーシス主義', ko: '영지주의 신앙', pl: 'Wiara Gnostycka', pt: 'Fé Gnóstica', tr: 'Gnostik İnancı' }},
                { value: 'sethianism', display: { en: 'Sethianism', zh: '塞特主义', ru: 'Сетианство', fr: 'Sethianisme', es: 'Setianismo', de: 'Sethianismus', ja: 'セティアニズム', ko: '세트주의', pl: 'Setianizm', pt: 'Setianismo', tr: 'Sethianizm' }},
                { value: 'finnish_pagan', display: { en: 'Finnish Pagan', zh: '芬兰异教', ru: 'Финское язычество', fr: 'Paganisme Finnois', es: 'Paganismo Finlandés', de: 'Finnisches Heidentum', ja: 'フィンランド異教', ko: '핀란드 이교', pl: 'Pogaństwo Fińskie', pt: 'Paganismo Finlandês', tr: 'Finlandiya Paganizmi' }},
                { value: 'norse_pagan', display: { en: 'Norse Pagan', zh: '北欧异教', ru: 'Норвежское язычество', fr: 'Paganisme Nordique', es: 'Paganismo Nórdico', de: 'Nordisches Heidentum', ja: '北欧異教', ko: '노르드 이교', pl: 'Pogaństwo Nordyckie', pt: 'Paganismo Nórdico', tr: 'Nors Paganizmi' }},
                { value: 'hantuism', display: { en: 'Hantuism', zh: '汉图主义', ru: 'Хантуизм', fr: 'Hantuisme', es: 'Hantuismo', de: 'Hantuismus', ja: 'ハントゥイズム', ko: '한투이즘', pl: 'Hantuizm', pt: 'Hantuismo', tr: 'Hantuizm' }},
                { value: 'hellenic_pagan', display: { en: 'Hellenic Pagan', zh: '希腊异教', ru: 'Эллинское язычество', fr: 'Paganisme Hellénique', es: 'Paganismo Helénico', de: 'Hellenisches Heidentum', ja: 'ヘレニック異教', ko: '헬레닉 이교', pl: 'Pogaństwo Hellenistyczne', pt: 'Paganismo Helênico', tr: 'Helen Paganizmi' }},
                { value: 'vaishnava_faith', display: { en: 'Vaishnava Faith', zh: '毗湿奴派', ru: 'Вайшнавизм', fr: 'Foi Vaishnava', es: 'Fe Vaishnava', de: 'Vaishnava-Glaube', ja: 'ヴィシュヌ派', ko: '비슈누파 신앙', pl: 'Wiara Wisznuicka', pt: 'Fé Vaishnava', tr: 'Vaishnava İnancı' }},
                { value: 'shaiva_faith', display: { en: 'Shaiva Faith', zh: '湿婆派', ru: 'Шиваизм', fr: 'Foi Shaiva', es: 'Fe Shaiva', de: 'Shaiva-Glaube', ja: 'シヴァ派', ko: '시바파 신앙', pl: 'Wiara Śiwaicka', pt: 'Fé Shaiva', tr: 'Shaiva İnancı' }},
                { value: 'shakta_faith', display: { en: 'Shakta Faith', zh: '沙克塔派', ru: 'Шактизм', fr: 'Foi Shakta', es: 'Fe Shakta', de: 'Shakta-Glaube', ja: 'シャクティ派', ko: '샤크타 신앙', pl: 'Wiara Śaktyjska', pt: 'Fé Shakta', tr: 'Shakta İnancı' }},
                { value: 'smartism', display: { en: 'Smartism', zh: '斯马尔特主义', ru: 'Смартизм', fr: 'Smartisme', es: 'Smartismo', de: 'Smartismus', ja: 'スマルティズム', ko: '스마르티즘', pl: 'Smartyzm', pt: 'Smartismo', tr: 'Smartizm' }},
                { value: 'saura', display: { en: 'Saura', zh: '绍拉派', ru: 'Саура', fr: 'Saura', es: 'Saura', de: 'Saura', ja: 'サウラ派', ko: '사우라', pl: 'Saura', pt: 'Saura', tr: 'Saura' }},
                { value: 'dab_qhuas', display: { en: 'Dab Qhuas', zh: '达布库阿斯', ru: 'Даб Куас', fr: 'Dab Qhuas', es: 'Dab Qhuas', de: 'Dab Qhuas', ja: 'ダブクアス', ko: '답 쿠아스', pl: 'Dab Qhuas', pt: 'Dab Qhuas', tr: 'Dab Qhuas' }},
                { value: 'sadr_al_islam', display: { en: 'Sadr al-Islam', zh: '伊斯兰教之首', ru: 'Садр аль-Ислам', fr: 'Sadr al-Islam', es: 'Sadr al-Islam', de: 'Sadr al-Islam', ja: 'サドル・アル・イスラム', ko: '사드르 알 이슬람', pl: 'Sadr al-Islam', pt: 'Sadr al-Islam', tr: 'Sadr al-İslam' }},
                { value: 'sunni', display: { en: 'Sunni', zh: '逊尼派', ru: 'Суннизм', fr: 'Sunnisme', es: 'Suni', de: 'Sunnitentum', ja: 'スンニ派', ko: '수니파', pl: 'Sunnizm', pt: 'Suni', tr: 'Sünni' }},
                { value: 'shia', display: { en: 'Shia', zh: '什叶派', ru: 'Шиизм', fr: 'Chiisme', es: 'Chiíta', de: 'Schiitentum', ja: 'シーア派', ko: '시아파', pl: 'Szyizm', pt: 'Xiita', tr: 'Şii' }},
                { value: 'kharijite', display: { en: 'Kharijite', zh: '哈瓦利吉派', ru: 'Хариджиты', fr: 'Kharijisme', es: 'Jariyita', de: 'Charidschiten', ja: 'ハワーリジュ派', ko: '카와리지파', pl: 'Charydżyzm', pt: 'Carijita', tr: 'Harici' }},
                { value: 'masmudi', display: { en: 'Masmudi', zh: '马斯穆迪', ru: 'Масмуди', fr: 'Masmudi', es: 'Masmudi', de: 'Masmudi', ja: 'マスムディ', ko: '마스무디', pl: 'Masmudi', pt: 'Masmudi', tr: 'Masmudi' }},
                { value: 'quranist', display: { en: 'Quranist', zh: '古兰经派', ru: 'Коранизм', fr: 'Coraniste', es: 'Coranista', de: 'Koranismus', ja: 'クルアーン主義者', ko: '쿠란주의자', pl: 'Koraniści', pt: 'Coranista', tr: 'Kuranist' }},
                { value: 'druze', display: { en: 'Druze', zh: '德鲁兹派', ru: 'Друзы', fr: 'Druze', es: 'Druso', de: 'Drusen', ja: 'ドゥルーズ派', ko: '드루즈파', pl: 'Druzowie', pt: 'Druso', tr: 'Dürzi' }},
                { value: 'qarmatian', display: { en: 'Qarmatian', zh: '卡尔马特派', ru: 'Карматы', fr: 'Qarmate', es: 'Cármata', de: 'Karmaten', ja: 'カルマト派', ko: '카르마티아파', pl: 'Karmaci', pt: 'Cármata', tr: 'Karmati' }},
                { value: 'jain_faith', display: { en: 'Jain Faith', zh: '耆那教', ru: 'Джайнизм', fr: 'Foi Jaïn', es: 'Fe Jainista', de: 'Jainismus', ja: 'ジャイナ教', ko: '자이나교 신앙', pl: 'Wiara Dżinijska', pt: 'Fé Jainista', tr: 'Caynist İnancı' }},
                { value: 'rabbinic_faith', display: { en: 'Rabbinic Faith', zh: '拉比教', ru: 'Раввинизм', fr: 'Foi Rabbinique', es: 'Fe Rabínica', de: 'Rabbinischer Glaube', ja: 'ラビ信仰', ko: '랍비 신앙', pl: 'Wiara Rabiniczna', pt: 'Fé Rabínica', tr: 'Rabinik İnancı' }},
                { value: 'karaism', display: { en: 'Karaism', zh: '卡拉派', ru: 'Караизм', fr: 'Karaïsme', es: 'Caraísmo', de: 'Karäismus', ja: 'カライ派', ko: '카라임파', pl: 'Karaizm', pt: 'Caraísmo', tr: 'Karaizm' }},
                { value: 'haymanot', display: { en: 'Haymanot', zh: '哈伊玛诺特', ru: 'Хаиманот', fr: 'Haymanot', es: 'Haymanot', de: 'Haymanot', ja: 'ハイマノット', ko: '하이마노트', pl: 'Haymanot', pt: 'Haymanot', tr: 'Haymanot' }},
                { value: 'malabarism', display: { en: 'Malabarism', zh: '马拉巴尔派', ru: 'Малабаризм', fr: 'Malabarisme', es: 'Malabarismo', de: 'Malabarismus', ja: 'マラバリズム', ko: '말라바르파', pl: 'Malabaryzm', pt: 'Malabarismo', tr: 'Malabarizm' }},
                { value: 'samaritan', display: { en: 'Samaritan', zh: '撒马利亚派', ru: 'Самаритянство', fr: 'Samaritain', es: 'Samaritano', de: 'Samaritaner', ja: 'サマリア人', ko: '사마리아인', pl: 'Samarytanizm', pt: 'Samaritano', tr: 'Samiriyeli' }},
                { value: 'kabarism', display: { en: 'Kabarism', zh: '卡巴主义', ru: 'Кабаризм', fr: 'Kabarisme', es: 'Kabarismo', de: 'Kabarismus', ja: 'カバリズム', ko: '카바르족', pl: 'Kabaryzm', pt: 'Kabarismo', tr: 'Kabarizm' }},
                { value: 'kaharingan', display: { en: 'Kaharingan', zh: '卡哈林安', ru: 'Кахаринган', fr: 'Kaharingan', es: 'Kaharingan', de: 'Kaharingan', ja: 'カハリンガン', ko: '카하링안', pl: 'Kaharingan', pt: 'Kaharingan', tr: 'Kaharingan' }},
                { value: 'kamuyism_pagan', display: { en: 'Kamuyism Pagan', zh: '神威异教', ru: 'Камуизм', fr: 'Paganisme Kamuyisme', es: 'Paganismo Camuyismo', de: 'Kamuyismus-Heidentum', ja: 'カムイイズム異教', ko: '카무이 이교', pl: 'Pogaństwo Kamuyizm', pt: 'Paganismo Camuyismo', tr: 'Kamuyizm Paganizmi' }},
                { value: 'kushitism_pagan', display: { en: 'Kushitism Pagan', zh: '库什异教', ru: 'Кушитское язычество', fr: 'Paganisme Kouchitique', es: 'Paganismo Cushita', de: 'Kuschitisches Heidentum', ja: 'クシット異教', ko: '쿠시 이교', pl: 'Pogaństwo Kuszyckie', pt: 'Paganismo Cushita', tr: 'Kuşit Paganizmi' }},
                { value: 'magyar_pagan', display: { en: 'Magyar Pagan', zh: '马扎尔异教', ru: 'Венгерское язычество', fr: 'Paganisme Magyar', es: 'Paganismo Magiar', de: 'Magyarisches Heidentum', ja: 'マジャール異教', ko: '마자르 이교', pl: 'Pogaństwo Węgierskie', pt: 'Paganismo Magiar', tr: 'Macar Paganizmi' }},
                { value: 'moism', display: { en: 'Moism', zh: '墨子教', ru: 'Моизм', fr: 'Moïsme', es: 'Moísmo', de: 'Moismus', ja: '墨家', ko: '묵가', pl: 'Moizm', pt: 'Moísmo', tr: 'Moizm' }},
                { value: 'mu', display: { en: 'Mu', zh: '穆', ru: 'Му', fr: 'Mu', es: 'Mu', de: 'Mu', ja: 'ム', ko: '무', pl: 'Mu', pt: 'Mu', tr: 'Mu' }},
                { value: 'kiratism', display: { en: 'Kiratism', zh: '基拉特主义', ru: 'Киратизм', fr: 'Kiratisme', es: 'Kiratismo', de: 'Kiratismus', ja: 'キラティズム', ko: '키라티즘', pl: 'Kiratyzm', pt: 'Kiratismo', tr: 'Kiratizm' }},
                { value: 'yumaism', display: { en: 'Yumaism', zh: '尤马主义', ru: 'Юмаизм', fr: 'Yumaïsme', es: 'Yumaísmo', de: 'Yumaismus', ja: 'ユマイズム', ko: '유마이즘', pl: 'Jumaizm', pt: 'Iumaísmo', tr: 'Yumaizm' }},
                { value: 'north_african_acham_pagan', display: { en: 'North African Acham Pagan', zh: '北非阿坎异教', ru: 'Североафриканское ачамское язычество', fr: 'Paganisme Acham Nord-Africain', es: 'Paganismo Acham del Norte de África', de: 'Nordafrikanisches Acham-Heidentum', ja: '北アフリカ・アチャム異教', ko: '북아프리카 아참 이교', pl: 'Pogaństwo Acham Północnoafrykańskie', pt: 'Paganismo Acham Norte-Africano', tr: 'Kuzey Afrika Aşam Paganizmi' }},
                { value: 'pagan', display: { en: 'Pagan', zh: '异教', ru: 'Язычество', fr: 'Païen', es: 'Pagano', de: 'Heidentum', ja: '異教', ko: '이교', pl: 'Pogaństwo', pt: 'Pagão', tr: 'Pagan' }},
                { value: 'rrmeaism', display: { en: 'Rrmeaism', zh: 'Rrmeaism', ru: 'Ррмеаизм', fr: 'Rrméaïsme', es: 'Rrmeaísmo', de: 'Rrmeaismus', ja: 'ルルマイズム', ko: '르메아이즘', pl: 'Rrmeaizm', pt: 'Rrmeaísmo', tr: 'Rrmeaizm' }},
                { value: 'melieism', display: { en: 'Melieism', zh: '梅利主义', ru: 'Мелиизм', fr: 'Méliïsme', es: 'Meliísmo', de: 'Meliismus', ja: 'メリイズム', ko: '멜리에이즘', pl: 'Melieizm', pt: 'Meliísmo', tr: 'Melieizm' }},
                { value: 'satsana_phi', display: { en: 'Satsana Phi', zh: '萨查那菲', ru: 'Сатсана Пхи', fr: 'Satsana Phi', es: 'Satsana Phi', de: 'Satsana Phi', ja: 'サツァナ・ピー', ko: '삿사나 피', pl: 'Satsana Phi', pt: 'Satsana Phi', tr: 'Satsana Phi' }},
                { value: 'shamanism', display: { en: 'Shamanism', zh: '萨满教', ru: 'Шаманизм', fr: 'Chamanisme', es: 'Chamanismo', de: 'Schamanismus', ja: 'シャーマニズム', ko: '샤머니즘', pl: 'Szamanizm', pt: 'Xamanismo', tr: 'Şamanizm' }},
                { value: 'shinto_faith', display: { en: 'Shinto Faith', zh: '神道教', ru: 'Синтоизм', fr: 'Foi Shinto', es: 'Fe Sintoísta', de: 'Shintoismus', ja: '神道', ko: '신도 신앙', pl: 'Wiara Shinto', pt: 'Fé Xintoísta', tr: 'Şinto İnancı' }},
                { value: 'siberian_pagan', display: { en: 'Siberian Pagan', zh: '西伯利亚异教', ru: 'Сибирское язычество', fr: 'Paganisme Sibérien', es: 'Paganismo Siberiano', de: 'Sibirisches Heidentum', ja: 'シベリア異教', ko: '시베리아 이교', pl: 'Pogaństwo Syberyjskie', pt: 'Paganismo Siberiano', tr: 'Sibirya Paganizmi' }},
                { value: 'slavic_pagan', display: { en: 'Slavic Pagan', zh: '斯拉夫异教', ru: 'Славянское язычество', fr: 'Paganisme Slave', es: 'Paganismo Eslavo', de: 'Slawisches Heidentum', ja: 'スラヴ異教', ko: '슬라브 이교', pl: 'Pogaństwo Słowiańskie', pt: 'Paganismo Eslavo', tr: 'Slav Paganizmi' }},
                { value: 'shangqing_faith', display: { en: 'Shangqing Faith', zh: '上清教', ru: 'Шанцин', fr: 'Foi Shangqing', es: 'Fe Shangqing', de: 'Shangqing-Glaube', ja: '上清派', ko: '상청 신앙', pl: 'Wiara Shangqing', pt: 'Fé Shangqing', tr: 'Shangqing İnancı' }},
                { value: 'zhengyi', display: { en: 'Zhengyi', zh: '正一教', ru: 'Женьи', fr: 'Zhengyi', es: 'Zhengyi', de: 'Zhengyi', ja: '正一派', ko: '정일교', pl: 'Zhengyi', pt: 'Zhengyi', tr: 'Zhengyi' }},
                { value: 'tengri_pagan', display: { en: 'Tengri Pagan', zh: '腾格里异教', ru: 'Тенгрианское язычество', fr: 'Paganisme Tengri', es: 'Paganismo Tengri', de: 'Tengri-Heidentum', ja: 'テングリ異教', ko: '텡그리 이교', pl: 'Pogaństwo Tengri', pt: 'Paganismo Tengri', tr: 'Tengri Paganizmi' }},
                { value: 'tolotang', display: { en: 'Tolotang', zh: '托洛唐', ru: 'Толотанг', fr: 'Tolotang', es: 'Tolotang', de: 'Tolotang', ja: 'トロタン', ko: '톨로탕', pl: 'Tolotang', pt: 'Tolotang', tr: 'Tolotang' }},
                { value: 'utaki', display: { en: 'Utaki', zh: '乌塔基', ru: 'Утаки', fr: 'Utaki', es: 'Utaki', de: 'Utaki', ja: 'うたき', ko: '우타키', pl: 'Utaki', pt: 'Utaki', tr: 'Utaki' }},
                { value: 'waaqism_pagan', display: { en: 'Waaqism Pagan', zh: '瓦克异教', ru: 'Ваакизм', fr: 'Paganisme Waaqisme', es: 'Paganismo Waaqismo', de: 'Waaqismus-Heidentum', ja: 'ワアクイズム異教', ko: '와아크 이교', pl: 'Pogaństwo Waaqizm', pt: 'Paganismo Waaqismo', tr: 'Waaqizm Paganizmi' }},
                { value: 'ngaiism_pagan', display: { en: 'Ngaiism Pagan', zh: '恩盖异教', ru: 'Нгаизм', fr: 'Paganisme Ngaiisme', es: 'Paganismo Ngaiismo', de: 'Ngaiismus-Heidentum', ja: 'ンガイイズム異教', ko: '응가이 이교', pl: 'Pogaństwo Ngaiizm', pt: 'Paganismo Ngaiismo', tr: 'Ngaiizm Paganizmi' }},
                { value: 'west_african_pagan', display: { en: 'West African Pagan', zh: '西非异教', ru: 'Западноафриканское язычество', fr: 'Paganisme Ouest-Africain', es: 'Paganismo de África Occidental', de: 'Westafrikanisches Heidentum', ja: '西アフリカ異教', ko: '서아프리카 이교', pl: 'Pogaństwo Zachodnioafrykańskie', pt: 'Paganismo da África Ocidental', tr: 'Batı Afrika Paganizmi' }},
                { value: 'west_african_bidu_pagan', display: { en: 'West African Bidu Pagan', zh: '西非比杜异教', ru: 'Западноафриканское бидуизм', fr: 'Paganisme Bidu Ouest-Africain', es: 'Paganismo Bidu de África Occidental', de: 'Westafrikanisches Bidu-Heidentum', ja: '西アフリカ・ビドゥ異教', ko: '서아프리카 비두 이교', pl: 'Pogaństwo Bidu Zachodnioafrykańskie', pt: 'Paganismo Bidu da África Ocidental', tr: 'Batı Afrika Bidu Paganizmi' }},
                { value: 'west_african_bori_pagan', display: { en: 'West African Bori Pagan', zh: '西非博里异教', ru: 'Западноафриканское бориизм', fr: 'Paganisme Bori Ouest-Africain', es: 'Paganismo Bori de África Occidental', de: 'Westafrikanisches Bori-Heidentum', ja: '西アフリカ・ボリ異教', ko: '서아프리카 보리 이교', pl: 'Pogaństwo Bori Zachodnioafrykańskie', pt: 'Paganismo Bori da África Ocidental', tr: 'Batı Afrika Bori Paganizmi' }},
                { value: 'west_african_orisha_pagan', display: { en: 'West African Orisha Pagan', zh: '西非奥里沙异教', ru: 'Западноафриканское оришаизм', fr: 'Paganisme Orisha Ouest-Africain', es: 'Paganismo Orisha de África Occidental', de: 'Westafrikanisches Orisha-Heidentum', ja: '西アフリカ・オリシャ異教', ko: '서아프리카 오리샤 이교', pl: 'Pogaństwo Orisha Zachodnioafrykańskie', pt: 'Paganismo Orisha da África Ocidental', tr: 'Batı Afrika Orişa Paganizmi' }},
                { value: 'west_african_roog_pagan', display: { en: 'West African Roog Pagan', zh: '西非鲁格异教', ru: 'Западноафриканское руугизм', fr: 'Paganisme Roog Ouest-Africain', es: 'Paganismo Roog de África Occidental', de: 'Westafrikanisches Roog-Heidentum', ja: '西アフリカ・ルーグ異教', ko: '서아프리카 루그 이교', pl: 'Pogaństwo Roog Zachodnioafrykańskie', pt: 'Paganismo Roog da África Ocidental', tr: 'Batı Afrika Roog Paganizmi' }},
                { value: 'yazidi_faith', display: { en: 'Yazidi Faith', zh: '雅兹迪教', ru: 'Езидизм', fr: 'Foi Yézidie', es: 'Fe Yazidí', de: 'Yezidentum', ja: 'ヤズィーディー教', ko: '야지디 신앙', pl: 'Wiara Jezydzka', pt: 'Fé Yazidi', tr: 'Yezidi İnancı' }},
                { value: 'mazdayasna', display: { en: 'Mazdayasna', zh: '马兹达教', ru: 'Маздаясна', fr: 'Mazdayasna', es: 'Mazdayasna', de: 'Mazdayasna', ja: 'マズダヤスナ', ko: '마즈다야스나', pl: 'Mazdajasna', pt: 'Mazdayasna', tr: 'Mazdayasna' }},
                { value: 'zurvanism', display: { en: 'Zurvanism', zh: '祖尔万教', ru: 'Зурванизм', fr: 'Zurvanisme', es: 'Zurvanismo', de: 'Zurvanismus', ja: 'ズルワーン主義', ko: '주르반주의', pl: 'Zurwanizm', pt: 'Zurvanismo', tr: 'Zurvanizm' }},
                { value: 'gayomarthianism', display: { en: 'Gayomarthianism', zh: '伽约马特主义', ru: 'Гайомартиянизм', fr: 'Gayomarthianisme', es: 'Gayomartianismo', de: 'Gayomartianismus', ja: 'ガヨマルティアニズム', ko: '가요마르트주의', pl: 'Gajomartianizm', pt: 'Gayomartianismo', tr: 'Gayomartiyanizm' }},
                { value: 'khurmazta', display: { en: 'Khurmazta', zh: '胡尔马兹塔', ru: 'Хурмазта', fr: 'Khurmazta', es: 'Khurmazta', de: 'Khurmazta', ja: 'フルマズタ', ko: '쿠르마즈타', pl: 'Khurmazta', pt: 'Khurmazta', tr: 'Khurmazta' }},
                { value: 'mazdakism', display: { en: 'Mazdakism', zh: '马兹达克教', ru: 'Маздакизм', fr: 'Mazdakisme', es: 'Mazdaquismo', de: 'Mazdakismus', ja: 'マズダク教', ko: '마즈다크교', pl: 'Mazdakizm', pt: 'Mazdaquismo', tr: 'Mazdakizm' }},
                { value: 'khurramism', display: { en: 'Khurramism', zh: '胡拉姆教', ru: 'Хуррамизм', fr: 'Khurramisme', es: 'Khurramismo', de: 'Churramismus', ja: 'フッラム教', ko: '쿠람교', pl: 'Churramizm', pt: 'Khurramismo', tr: 'Hurramizm' }},
                { value: 'urartuism', display: { en: 'Urartuism', zh: '乌拉尔图教', ru: 'Урартуизм', fr: 'Urartuisme', es: 'Urartuismo', de: 'Urartuismus', ja: 'ウラルトゥイズム', ko: '우라르투이즘', pl: 'Urartuizm', pt: 'Urartuismo', tr: 'Urartuizm' }},
                { value: 'afridunism', display: { en: 'Afridunism', zh: '阿弗里敦教', ru: 'Афридунизм', fr: 'Afridunisme', es: 'Afridunismo', de: 'Afridunismus', ja: 'アフリドゥニズム', ko: '아프리둔주의', pl: 'Afrydunizm', pt: 'Afridunismo', tr: 'Afridunizm' }},
                { value: 'zun_pagan', display: { en: 'Zun Pagan', zh: '尊异教', ru: 'Зунское язычество', fr: 'Paganisme Zun', es: 'Paganismo Zun', de: 'Zun-Heidentum', ja: 'ズン異教', ko: '쭌 이교', pl: 'Pogaństwo Zun', pt: 'Paganismo Zun', tr: 'Zun Paganizmi' }}
            ],
            desc: {
                en: "Quick-pick a faith to convert the county to (optional, defaults to source character's faith).",
                zh: "快速选择要将伯爵领转换为的信仰（可选，默认为源角色的信仰）。",
                ru: "Быстро выберите веру, в которую будет преобразовано графство (необязательно, по умолчанию — вера персонажа-источника).",
                fr: "Sélection rapide d'une foi pour convertir le comté (facultatif, par défaut la foi du personnage source).",
                es: "Selección rápida de una fe para convertir el condado (opcional, por defecto la fe del personaje de origen).",
                de: "Schnellauswahl eines Glaubens zur Konvertierung des Kreises (optional, Standard ist der Glaube des Quellcharakters).",
                ja: "郡を改宗させる信仰をクイックピック（オプション、デフォルトはソースキャラクターの信仰）。",
                ko: "백작령을 전환할 신앙을 빠르게 선택합니다(선택 사항, 기본값은 원본 캐릭터의 신앙).",
                pl: "Szybki wybór wiary, na którą ma zostać nawrócone hrabstwo (opcjonalnie, domyślnie wiara postaci źródłowej).",
                pt: "Seleção rápida de uma fé para converter o condado (opcional, padrão para a fé do personagem de origem).",
                tr: "İlçeyi dönüştürmek için hızlı bir inanç seçin (isteğe bağlı, varsayılan olarak kaynak karakterin inancına ayarlanır)."
            }
        },
        {
            name: "customFaithKey",
            type: "string",
            desc: {
                en: "Free-text faith key (e.g., 'islam_shia'). Overridden by quickPickFaith if selected. If both are empty, defaults to source character's faith.",
                zh: "自由文本信仰键（例如 'islam_shia'）。如果选择了快速选择信仰，则被覆盖。如果两者都为空，则默认为源角色的信仰。",
                ru: "Произвольный ключ веры (например, 'islam_shia'). Переопределяется быстрым выбором, если он выбран. Если оба пусты, по умолчанию используется вера персонажа-источника.",
                fr: "Clé de foi en texte libre (par exemple, 'islam_shia'). Remplacée par la sélection rapide si choisie. Si les deux sont vides, la foi du personnage source est utilisée par défaut.",
                es: "Clave de fe de texto libre (p. ej., 'islam_shia'). Anulada por quickPickFaith si se selecciona. Si ambos están vacíos, por defecto es la fe del personaje de origen.",
                de: "Freitext-Glaubensschlüssel (z. B. 'islam_shia'). Wird durch quickPickFaith überschrieben, falls ausgewählt. Wenn beide leer sind, wird standardmäßig der Glaube des Quellcharakters verwendet.",
                ja: "自由テキストの信仰キー（例：'islam_shia'）。クイックピック信仰が選択されている場合は上書きされます。両方が空の場合は、ソースキャラクターの信仰がデフォルトになります。",
                ko: "자유 텍스트 신앙 키(예: 'islam_shia'). 빠른 선택 신앙이 선택된 경우 무시됩니다. 둘 다 비어 있으면 원본 캐릭터의 신앙으로 기본 설정됩니다.",
                pl: "Dowolny klucz wiary (np. 'islam_shia'). Zastąpiony przez quickPickFaith, jeśli wybrano. Jeśli oba są puste, domyślnie używana jest wiara postaci źródłowej.",
                pt: "Chave de fé de texto livre (ex: 'islam_shia'). Substituído por quickPickFaith se selecionado. Se ambos estiverem vazios, o padrão é a fé do personagem de origem.",
                tr: "Serbest metin inanç anahtarı (örn. 'islam_shia'). Hızlı seçim inancı seçilirse geçersiz kılınır. Her ikisi de boşsa, varsayılan olarak kaynak karakterin inancı kullanılır."
            }
        }
    ],
    description: {
        en: `Executed when a landed ruler's capital county is converted to another character's faith. The source (character1) is the one whose faith is ADOPTED. The target (character2) is the landed ruler whose capital county converts.`,
        zh: `当一个领地统治者的首都伯爵领皈依另一个角色的信仰时执行。源（character1）是被采用信仰者，目标（character2）是首都伯爵领皈依的领地统治者。`,
        ru: `Выполняется, когда столичное графство правителя обращается в веру другого персонажа. Источник (персонаж 1) — тот, чья вера принимается. Цель (персонаж 2) — правитель, чьё столичное графство обращается.`,
        fr: `Exécuté lorsque le comté capital d'un dirigeant foncier est converti à la foi d'un autre personnage. La source (personnage 1) est celui dont la foi est adoptée. La cible (personnage 2) est le dirigeant foncier dont le comté capital se convertit.`,
        es: `Ejecutado cuando el condado capital de un gobernante con tierras se convierte a la fe de otro personaje. El origen (character1) es aquel cuya fe se adopta. El objetivo (character2) es el gobernante con tierras cuyo condado capital se convierte.`,
        de: `Wird ausgeführt, wenn die Hauptlandgrafschaft eines Herrschers zum Glauben eines anderen Charakters bekehrt wird. Die Quelle (Charakter 1) ist derjenige, dessen Glaube übernommen wird. Das Ziel (Charakter 2) ist der Herrscher, dessen Hauptlandgrafschaft konvertiert.`,
        ja: `領地統治者の首都伯領が別のキャラクターの信仰に改宗したときに実行されます。ソース（キャラクター1）は信仰が採用される側、ターゲット（キャラクター2）は首都伯領が改宗する領地統治者です。`,
        ko: `영지 통치자의 수도 백작령이 다른 캐릭터의 신앙으로 개종할 때 실행됩니다. 소스(캐릭터 1)는 신앙이 채택되는 쪽, 대상(캐릭터 2)은 수도 백작령이 개종하는 영지 통치자입니다.`,
        pl: `Wykonywane, gdy stołeczne hrabstwo władcy zostaje nawrócone na wiarę innej postaci. Źródło (postać 1) to ta, której wiara jest przyjmowana. Cel (postać 2) to władca, którego stołeczne hrabstwo ulega konwersji.`,
        pt: `Executado quando o condado capital de um governante com terras é convertido à fé de outro personagem. A fonte (character1) é aquele cuja fé é adotada. O alvo (character2) é o governante com terras cujo condado capital se converte.`,
        tr: `Toprak sahibi bir hükümdarın baş ilçesi başka bir karakterin inancına döndüğünde çalıştırılır. Kaynak (character1) inancı benimsenen taraftır. Hedef (character2) baş ilçesi dönen toprak sahibi hükümdardır.`
    },
    canPerformAtDistance: true,

    /**
     * @param {GameData} gameData
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) => {
        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);
        if (!source || !target) return false;
        if (sourceId === targetId) return false;
        if (!target.isLandedRuler) return false;

        const sourceFaith = String(source.faith || "").toLowerCase();
        const targetFaith = String(target.faith || "").toLowerCase();
        if (!sourceFaith || !targetFaith || sourceFaith === targetFaith) return false;

        return true;
    },

    /**
     * @param {GameData} gameData
     * @param {string[]} args
     * @param {number} sourceId
     * @param {number} targetId
     * @returns {{success: boolean, message?: string}}
     */
    preCheck: (gameData, args, sourceId, targetId) => {
        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);
        if (!source || !target) {
            return { success: false, message: "Source or target character not found." };
        }
        if (sourceId === targetId) {
            return { success: false, message: "A character cannot convert their own county's faith to themselves." };
        }
        if (!target.isLandedRuler) {
            return { success: false, message: "The target must hold a landed title for their capital county to convert faith." };
        }

        const sourceFaith = String(source.faith || "").toLowerCase();
        const targetFaith = String(target.faith || "").toLowerCase();
        if (!sourceFaith || !targetFaith || sourceFaith === targetFaith) {
            return { success: false, message: "The source and target must be of different faiths for a county faith conversion." };
        }
        return { success: true };
    },

    /**
     * @param {GameData} gameData
     * @param {Function} runGameEffect
     * @param {string[]} args
     * @param {number} sourceId
     * @param {number} targetId
     */
    run: (gameData, runGameEffect, args, sourceId, targetId) => {
        const target = gameData.getCharacterById(targetId);
        if (!target) return;

        runGameEffect(`
            global_var:votcce_action_target.capital_county = {
                set_county_faith = ${faithToConvert.startsWith('global_var:') ? faithToConvert : `faith:${faithToConvert}`}
            }`);
    },

    chatMessage: (args) => {
        const quickPickFaith = args && args[0] ? String(args[0]).trim() : "";
        const customFaithKey = args && args[1] ? String(args[1]).trim() : "";
        let displayFaith = "their source's faith";
        if (quickPickFaith) {
            const selectedOption = module.exports.args[0].options.find(opt => opt.value === quickPickFaith);
            displayFaith = selectedOption ? selectedOption.display.en : quickPickFaith;
        } else if (customFaithKey) {
            displayFaith = customFaithKey;
        }

        return {
            en: `{{character2Name}}'s capital county was converted to ${displayFaith}.`,
            zh: `{{character2Name}}的首都伯爵领皈依了${displayFaith}。`,
            ru: `Столичное графство {{character2Name}} было обращено в ${displayFaith}.`,
            fr: `Le comté capital de {{character2Name}} a été converti à ${displayFaith}.`,
            es: `El condado capital de {{character2Name}} fue convertido a ${displayFaith}.`,
            de: `Die Hauptlandgrafschaft von {{character2Name}} wurde zu ${displayFaith} bekehrt.`,
            ja: `{{character2Name}}の首都伯領は${displayFaith}に改宗しました。`,
            ko: `{{character2Name}}의 수도 백작령이 ${displayFaith}로 개종했습니다.`,
            pl: `Stołeczne hrabstwo {{character2Name}} zostało nawrócone na ${displayFaith}.`,
            pt: `O condado capital de {{character2Name}} foi convertido à ${displayFaith}.`,
            tr: `{{character2Name}}'nin baş ilçesi ${displayFaith} inancına döndürüldü.`
        };
    },
    chatMessageClass: "neutral-action-message"
};