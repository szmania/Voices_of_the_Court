//Made by: software_engineer_ck3

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

function normalizeCultureKey(value) {
  if (typeof value !== "string") return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[-\s]+/g, "_")
    .replace(/__+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

module.exports = {
    signature: "changeCulture",
    args: [
        {
            name: "quickPickCulture",
            type: "enum",
            options: [
                { value: 'acehnese', display: { en: 'Acehnese', zh: '哑齐', ru: 'Ачехцы', fr: 'acehnaise', es: 'acehnesa', de: 'Achinesisch', ja: 'アチェ', ko: '아체', pl: 'Aczinowie', pt: 'Acehnese', tr: 'Acehnese' } },
                { value: 'afar', display: { en: 'Afar', zh: '阿法尔', ru: 'Афары', fr: 'afare', es: 'afar', de: 'Afarisch', ja: 'アファル', ko: '아파르', pl: 'Afarska', pt: 'Afar', tr: 'Afar' } },
                { value: 'afghan', display: { en: 'Afghan', zh: '阿薄健', ru: 'Афганцы', fr: 'afghane', es: 'afgana', de: 'Afghanisch', ja: 'アフガン', ko: '아프간', pl: 'Afgańska', pt: 'Afghan', tr: 'Afghan' } },
                { value: 'ainu', display: { en: 'Ainu', zh: '阿伊努', ru: 'Айны', fr: 'aïnoue', es: 'ainu', de: 'Ainuisch', ja: 'アイヌ', ko: '아이누', pl: 'Ajnoska', pt: 'Ainu', tr: 'Ainu' } },
                { value: 'alan', display: { en: 'Alan', zh: '阿兰', ru: 'Аланы', fr: 'alaine', es: 'alana', de: 'Alanisch', ja: 'アラン', ko: '알란', pl: 'Alańska', pt: 'Alan', tr: 'Alan' } },
                { value: 'albanian', display: { en: 'Albanian', zh: '阿尔巴尼亚', ru: 'Албанцы', fr: 'albanaise', es: 'albanesa', de: 'Albanisch', ja: 'アルバニア', ko: '알바니아', pl: 'Albańska', pt: 'Albanian', tr: 'Albanian' } },
                { value: 'amis', display: { en: 'Amis', zh: '阿美', ru: 'Амис', fr: 'amis', es: 'amis', de: 'Amisisch', ja: 'アミ', ko: '아미스', pl: 'Ami', pt: 'Amis', tr: 'Amis' } },
                { value: 'ancient_egyptian', display: { en: 'Ancient Egyptian', zh: '古埃及', ru: 'Древние египтяне', fr: 'égyptienne ancienne', es: 'egipcia antigua', de: 'Alt-Ägyptisch', ja: '古代エジプト', ko: '고대 이집트', pl: 'Staroegipska', pt: 'Ancient Egyptian', tr: 'Ancient Egyptian' } },
                { value: 'anglo_saxon', display: { en: 'Anglo-Saxon', zh: '盎格鲁‑撒克逊', ru: 'Англосаксы', fr: 'anglo-saxonne', es: 'anglosajona', de: 'Angelsächsisch', ja: 'アングロ・サクソン', ko: '앵글로색슨', pl: 'Anglosaska', pt: 'Anglo-Saxon', tr: 'Anglo-Saxon' } },
                { value: 'aragonese', display: { en: 'Aragonese', zh: '阿拉贡', ru: 'Арагонцы', fr: 'aragonaise', es: 'aragonesa', de: 'Aragonisch', ja: 'アラゴン', ko: '아라곤', pl: 'Aragońska', pt: 'Aragonese', tr: 'Aragonese' } },
                { value: 'assamese', display: { en: 'Kamrupi', zh: '迦摩缕波', ru: 'Камрупы', fr: 'kamrupi', es: 'kamrupi', de: 'Kamrupisch', ja: 'カムルピ', ko: '캄루피', pl: 'Kamrupijska', pt: 'Kamrupi', tr: 'Kamrupi' } },
                { value: 'asturleonese', display: { en: 'Asturleonese', zh: '阿斯图尔‑莱昂', ru: 'Астурлеонцы', fr: 'asturléonaise', es: 'asturleonesa', de: 'Asturleonesisch', ja: 'アストゥリアス・レオン', ko: '아스투리아스레온', pl: 'Asturleońska', pt: 'Asturleonese', tr: 'Asturleonese' } },
                { value: 'avar', display: { en: 'Avar', zh: '阿瓦尔', ru: 'Авары', fr: 'avare', es: 'ávara', de: 'Awarisch', ja: 'アヴァール', ko: '아바르', pl: 'Awarska', pt: 'Avar', tr: 'Avar' } },
                { value: 'baekje', display: { en: 'Baekje', zh: '百济', ru: 'Пэкче', fr: 'baekje', es: 'baekje', de: 'Baekjeisch', ja: '百済', ko: '백제', pl: 'Baekjeańska', pt: 'Baekje', tr: 'Baekje' } },
                { value: 'bai', display: { en: 'Bai', zh: '白', ru: 'Бай', fr: 'bai', es: 'bai', de: 'Baisch', ja: 'バイ', ko: '백족', pl: 'Bai', pt: 'Bai', tr: 'Bai' } },
                { value: 'balhae', display: { en: 'Balhae', zh: '渤海', ru: 'Бохай', fr: 'balhae', es: 'balhae', de: 'Balhaeisch', ja: '渤海', ko: '발해', pl: 'Balhaeańska', pt: 'Balhae', tr: 'Balhae' } },
                { value: 'baloch', display: { en: 'Baloch', zh: '俾路支', ru: 'Белуджи', fr: 'baloutche', es: 'beluchi', de: 'Belutschisch', ja: 'バルーチ', ko: '발루치', pl: 'Beludżyjska', pt: 'Baloch', tr: 'Baloch' } },
                { value: 'baranis', display: { en: 'Baranis', zh: '巴拉尼斯', ru: 'Баранисы', fr: 'branès', es: 'baranis', de: 'Baranisch', ja: 'バラーニス', ko: '바라니스', pl: 'Baranijska', pt: 'Baranis', tr: 'Baranis' } },
                { value: 'bashkir', display: { en: 'Bashkir', zh: '巴什基尔', ru: 'Башкиры', fr: 'bachkire', es: 'bashkir', de: 'Baschkirisch', ja: 'バシキール', ko: '바슈키르', pl: 'Baszkirska', pt: 'Bashkir', tr: 'Bashkir' } },
                { value: 'basque', display: { en: 'Basque', zh: '巴斯克', ru: 'Баски', fr: 'basque', es: 'vasca', de: 'Baskisch', ja: 'バスク', ko: '바스크', pl: 'Baskijska', pt: 'Basque', tr: 'Basque' } },
                { value: 'bavarian', display: { en: 'Bavarian', zh: '巴伐利亚', ru: 'Баварцы', fr: 'bavaroise', es: 'bávara', de: 'Bayrisch', ja: 'バイエルン', ko: '바이에른', pl: 'Bawarska', pt: 'Bavarian', tr: 'Bavarian' } },
                { value: 'bavlim', display: { en: 'Bavli', zh: '巴比伦犹太', ru: 'Бавлимы', fr: 'bavlim', es: 'bavli', de: 'Bavlisch', ja: 'バブリム', ko: '바블림', pl: 'Bawlimska', pt: 'Bavli', tr: 'Bavli' } },
                { value: 'beja', display: { en: 'Beja', zh: '贝贾', ru: 'Беджа', fr: 'béja', es: 'beja', de: 'Bedschanisch', ja: 'ベジャ', ko: '베자', pl: 'Bedża', pt: 'Beja', tr: 'Beja' } },
                { value: 'bisayan', display: { en: 'Bisayan', zh: '毗舍耶', ru: 'Висайя', fr: 'bisaya', es: 'bisaya', de: 'Visayanisch', ja: 'ビサヤ', ko: '비사야', pl: 'Bisajska', pt: 'Bisayan', tr: 'Bisayan' } },
                { value: 'bobo', display: { en: 'Bobo', zh: '博博', ru: 'Бобо', fr: 'bobo', es: 'boba', de: 'Bobonisch', ja: 'ボボ', ko: '보보', pl: 'Boboska', pt: 'Bobo', tr: 'Bobo' } },
                { value: 'bolghar', display: { en: 'Bolghar', zh: '保加尔', ru: 'Булгары', fr: 'bolgare', es: 'protobúlgara', de: 'Bolgarisch', ja: 'ブルガール', ko: '볼가르', pl: 'Protobułgarska', pt: 'Bolghar', tr: 'Bolghar' } },
                { value: 'bosnian', display: { en: 'Bosnian', zh: '波斯尼亚', ru: 'Босняки', fr: 'bosniaque', es: 'bosnia', de: 'Bosnisch', ja: 'ボスニア', ko: '보스니아', pl: 'Bośniacka', pt: 'Bosnian', tr: 'Bosnian' } },
                { value: 'bouxcuengh', display: { en: 'Bouxcuengh', zh: '布僮', ru: 'Бучжуаны', fr: 'bouxcuengh', es: 'bouxcuengh', de: 'Zhuangisch', ja: 'チワン', ko: '좡족', pl: 'Bouxcuenghska', pt: 'Bouxcuengh', tr: 'Bouxcuengh' } },
                { value: 'bozo', display: { en: 'Bozo', zh: '博佐', ru: 'Бозо', fr: 'bozo', es: 'bozo', de: 'Bozonisch', ja: 'ボゾ', ko: '보조', pl: 'Bozoska', pt: 'Bozo', tr: 'Bozo' } },
                { value: 'brahui', display: { en: 'Brahui', zh: '布拉灰', ru: 'Брагуи', fr: 'brahouie', es: 'brahui', de: 'Brahuisch', ja: 'ブラーフイー', ko: '브라후이', pl: 'Brahuiska', pt: 'Brahui', tr: 'Brahui' } },
                { value: 'breton', display: { en: 'Breton', zh: '布列塔尼', ru: 'Бретонцы', fr: 'bretonne', es: 'bretona', de: 'Bretonisch', ja: 'ブルトン', ko: '브르타뉴', pl: 'Bretońska', pt: 'Breton', tr: 'Breton' } },
                { value: 'bugis', display: { en: 'Bugis', zh: '布吉', ru: 'Бугисы', fr: 'bouguinaise', es: 'bugis', de: 'Buginesisch', ja: 'ブギス', ko: '부기', pl: 'Bugiska', pt: 'Bugis', tr: 'Bugis' } },
                { value: 'bulgarian', display: { en: 'Bulgarian', zh: '保加利亚', ru: 'Болгары', fr: 'bulgare', es: 'búlgara', de: 'Bulgarisch', ja: 'ブルガリア', ko: '불가리아', pl: 'Bułgarska', pt: 'Bulgarian', tr: 'Bulgarian' } },
                { value: 'buryat', display: { en: 'Buryat', zh: '不里牙惕', ru: 'Буряты', fr: 'bouriate', es: 'buriata', de: 'Burjatisch', ja: 'ブリヤート', ko: '부랴트', pl: 'Buriacka', pt: 'Buryat', tr: 'Buryat' } },
                { value: 'carantanian', display: { en: 'Carantanian', zh: '卡兰塔尼亚', ru: 'Карантанцы', fr: 'carantanienne', es: 'carantiana', de: 'Karantanisch', ja: 'カランタニア', ko: '카란타니아', pl: 'Karantańska', pt: 'Carantanian', tr: 'Carantanian' } },
                { value: 'carthaginian', display: { en: 'Carthaginian', zh: '迦太基', ru: 'Карфагенцы', fr: 'carthaginoise', es: 'cartaginesa', de: 'Karthagisch', ja: 'カルタゴ', ko: '카르타고', pl: 'Kartagińska', pt: 'Carthaginian', tr: 'Carthaginian' } },
                { value: 'castilian', display: { en: 'Castilian', zh: '卡斯蒂利亚', ru: 'Кастильцы', fr: 'castillane', es: 'castellana', de: 'Kastilisch', ja: 'カスティーリャ', ko: '카스티야', pl: 'Kastylijska', pt: 'Castilian', tr: 'Castilian' } },
                { value: 'catalan', display: { en: 'Catalan', zh: '加泰罗尼亚', ru: 'Каталонцы', fr: 'catalane', es: 'catalana', de: 'Katalanisch', ja: 'カタルーニャ', ko: '카탈루냐', pl: 'Katalońska', pt: 'Catalan', tr: 'Catalan' } },
                { value: 'chuvash', display: { en: 'Chuvash', zh: '楚瓦什', ru: 'Чуваши', fr: 'tchouvache', es: 'chuvasia', de: 'Tschuwaschisch', ja: 'チュヴァシ', ko: '추바시', pl: 'Czuwaska', pt: 'Chuvash', tr: 'Chuvash' } },
                { value: 'cisalpine', display: { en: 'Cisalpine', zh: '山南', ru: 'Цизальпийцы', fr: 'cisalpine', es: 'cisalpina', de: 'Cisalpinisch', ja: 'チザルピーナ', ko: '키살피나', pl: 'Przedalpejska', pt: 'Cisalpine', tr: 'Cisalpine' } },
                { value: 'cornish', display: { en: 'Cornish', zh: '康沃尔', ru: 'Корнцы', fr: 'cornouaillaise', es: 'córnica', de: 'Kornisch', ja: 'コーンウォール', ko: '콘월', pl: 'Kornwalijska', pt: 'Cornish', tr: 'Cornish' } },
                { value: 'cuman', display: { en: 'Cuman', zh: '库曼', ru: 'Половцы', fr: 'coumane', es: 'cumana', de: 'Kumanisch', ja: 'クマン', ko: '쿠만', pl: 'Kumańska', pt: 'Cuman', tr: 'Cuman' } },
                { value: 'cumbrian', display: { en: 'Cumbrian', zh: '坎布里亚', ru: 'Кимбры', fr: 'cumbrienne', es: 'cumbria', de: 'Kumbrisch', ja: 'カンブリア', ko: '컴브리아', pl: 'Kumbryjska', pt: 'Cumbrian', tr: 'Cumbrian' } },
                { value: 'czech', display: { en: 'Czech', zh: '捷克', ru: 'Чехи', fr: 'tchèque', es: 'checa', de: 'Tschechisch', ja: 'チェコ', ko: '체코', pl: 'Czeska', pt: 'Czech', tr: 'Czech' } },
                { value: 'daju', display: { en: 'Daju', zh: '达朱', ru: 'Даго', fr: 'dadjo', es: 'daju', de: 'Dajunisch', ja: 'ダジュ', ko: '다주', pl: 'Dadżu', pt: 'Daju', tr: 'Daju' } },
                { value: 'danish', display: { en: 'Danish', zh: '丹麦', ru: 'Датчане', fr: 'danoise', es: 'danesa', de: 'Dänisch', ja: 'デンマーク', ko: '덴마크', pl: 'Duńska', pt: 'Danish', tr: 'Danish' } },
                { value: 'dayak', display: { en: 'Dayak', zh: '达雅', ru: 'Даяки', fr: 'dayak', es: 'dayak', de: 'Dayakisch', ja: 'ダヤク', ko: '다약', pl: 'Dajakowska', pt: 'Dayak', tr: 'Dayak' } },
                { value: 'daylamite', display: { en: 'Daylamite', zh: '答儿密', ru: 'Дейлемиты', fr: 'dailamite', es: 'dailamita', de: 'Dailamitisch', ja: 'ダイラム', ko: '다일람', pl: 'Dajlamicka', pt: 'Daylamite', tr: 'Daylamite' } },
                { value: 'dutch', display: { en: 'Dutch', zh: '荷兰', ru: 'Голландцы', fr: 'hollandaise', es: 'holandesa', de: 'Holländisch', ja: 'オランダ', ko: '네덜란드', pl: 'Holenderska', pt: 'Dutch', tr: 'Dutch' } },
                { value: 'edo', display: { en: 'Edo', zh: '埃多', ru: 'Эдо', fr: 'édo', es: 'eda', de: 'Edonisch', ja: 'エド', ko: '에도', pl: 'Edo', pt: 'Edo', tr: 'Edo' } },
                { value: 'egyptian', display: { en: 'Egyptian', zh: '埃及', ru: 'Египтяне', fr: 'égyptienne', es: 'egipcia', de: 'Ägyptisch', ja: 'エジプト', ko: '이집트', pl: 'Egipska', pt: 'Egyptian', tr: 'Egyptian' } },
                { value: 'emishi', display: { en: 'Emishi', zh: '虾夷', ru: 'Эмиси', fr: 'emishi', es: 'emishi', de: 'Emishisch', ja: '蝦夷', ko: '에미시', pl: 'Emishijska', pt: 'Emishi', tr: 'Emishi' } },
                { value: 'estonian', display: { en: 'Estonian', zh: '爱沙尼亚', ru: 'Эстонцы', fr: 'estonienne', es: 'estonia', de: 'Estnisch', ja: 'エストニア', ko: '에스토니아', pl: 'Estońska', pt: 'Estonian', tr: 'Estonian' } },
                { value: 'ewe', display: { en: 'Ewe', zh: '埃维', ru: 'Эве', fr: 'ewé', es: 'ewé', de: 'Ewenisch', ja: 'エウェ', ko: '에웨', pl: 'Eweska', pt: 'Ewe', tr: 'Ewe' } },
                { value: 'franconian', display: { en: 'Franconian', zh: '法兰克尼亚', ru: 'Франконцы', fr: 'franconienne', es: 'franconia', de: 'Fränkisch', ja: 'フランケン', ko: '프랑켄', pl: 'Frankońska', pt: 'Franconian', tr: 'Franconian' } },
                { value: 'french', display: { en: 'French', zh: '法兰西', ru: 'Французы', fr: 'française', es: 'francesa', de: 'Französisch', ja: 'フランス', ko: '프랑스', pl: 'Francuska', pt: 'French', tr: 'French' } },
                { value: 'frisian', display: { en: 'Frisian', zh: '弗里西亚', ru: 'Фризы', fr: 'frisonne', es: 'frisona', de: 'Friesisch', ja: 'フリース', ko: '프리슬란', pl: 'Fryzyjska', pt: 'Frisian', tr: 'Frisian' } },
                { value: 'gaelic', display: { en: 'Gaelic', zh: '盖尔', ru: 'Гэлы', fr: 'gaélique', es: 'gaélica', de: 'Gälisch', ja: 'ゲール', ko: '게일', pl: 'Gaelicka', pt: 'Gaelic', tr: 'Gaelic' } },
                { value: 'galician', display: { en: 'Galician', zh: '加利西亚', ru: 'Галисийцы', fr: 'galicienne', es: 'gallega', de: 'Galizisch', ja: 'ガリシア', ko: '갈리시아', pl: 'Galicyjska', pt: 'Galician', tr: 'Galician' } },
                { value: 'gaw', display: { en: 'Gaw', zh: '加夫', ru: 'Кавы', fr: 'gaw', es: 'gaw', de: 'Gawisch', ja: 'カウ', ko: '가우', pl: 'Gawska', pt: 'Gaw', tr: 'Gaw' } },
                { value: 'georgian', display: { en: 'Georgian', zh: '格鲁吉亚', ru: 'Грузины', fr: 'géorgienne', es: 'georgiana', de: 'Georgisch', ja: 'グルジア', ko: '조지아', pl: 'Gruzińska', pt: 'Georgian', tr: 'Georgian' } },
                { value: 'german', display: { en: 'German', zh: '德意志', ru: 'Немцы', fr: 'allemande', es: 'alemana', de: 'Germanisch', ja: 'ドイツ', ko: '게르만', pl: 'Niemiecka', pt: 'German', tr: 'German' } },
                { value: 'goguryeo', display: { en: 'Goguryeo', zh: '高句丽', ru: 'Когурё', fr: 'goguryeo', es: 'goguryeo', de: 'Goguryeoisch', ja: '高句麗', ko: '고구려', pl: 'Goguryeańska', pt: 'Goguryeo', tr: 'Goguryeo' } },
                { value: 'gond', display: { en: 'Gond', zh: '郡荼', ru: 'Гонды', fr: 'gond', es: 'gondi', de: 'Gond', ja: 'ゴンド', ko: '곤드', pl: 'Gondyjska', pt: 'Gond', tr: 'Gond' } },
                { value: 'guan', display: { en: 'Guan', zh: '古昂', ru: 'Гуань', fr: 'guan', es: 'guan', de: 'Guanisch', ja: 'グアン', ko: '구안', pl: 'Guańska', pt: 'Guan', tr: 'Guan' } },
                { value: 'guanches', display: { en: 'Guanche', zh: '关切', ru: 'Гуанче', fr: 'guanche', es: 'guanche', de: 'Guanchen', ja: 'グアンチェ', ko: '관체', pl: 'Guanczowska', pt: 'Guanche', tr: 'Guanche' } },
                { value: 'gujarati', display: { en: 'Gujarati', zh: '瞿折罗', ru: 'Гуджараты', fr: 'gujarati', es: 'gujarati', de: 'Gujaratisch', ja: 'グジャラート', ko: '구자라트', pl: 'Gudźaracka', pt: 'Gujarati', tr: 'Gujarati' } },
                { value: 'gur', display: { en: 'Gur', zh: '古尔', ru: 'Гуры', fr: 'gur', es: 'gur', de: 'Gurisch', ja: 'グル', ko: '구르', pl: 'Gurska', pt: 'Gur', tr: 'Gur' } },
                { value: 'hausa', display: { en: 'Hausa', zh: '豪萨', ru: 'Хауса', fr: 'haoussa', es: 'hausa', de: 'Hausanisch', ja: 'ハウサ', ko: '하우사', pl: 'Hausańska', pt: 'Hausa', tr: 'Hausa' } },
                { value: 'hebrew', display: { en: 'Hebrew', zh: '希伯来', ru: 'Иудеи', fr: 'hébreu', es: 'hebrea', de: 'Hebräisch', ja: 'ヘブライ', ko: '히브리', pl: 'Hebrajska', pt: 'Hebrew', tr: 'Hebrew' } },
                { value: 'hindustani', display: { en: 'Kannauji', zh: '葛那及', ru: 'Каннауджи', fr: 'kannauji', es: 'kannauji', de: 'Kannaujisch', ja: 'カナウジ', ko: '칸나우지', pl: 'Kannaudźi', pt: 'Kannauji', tr: 'Kannauji' } },
                { value: 'hlai', display: { en: 'Hlai', zh: '黎', ru: 'Лай', fr: 'hlai', es: 'hlai', de: 'Hlaisch', ja: '黎', ko: '여족', pl: 'Li', pt: 'Hlai', tr: 'Hlai' } },
                { value: 'hungarian', display: { en: 'Hungarian', zh: '匈牙利', ru: 'Венгры', fr: 'hongroise', es: 'húngara', de: 'Ungarisch', ja: 'ハンガリー', ko: '헝가리', pl: 'Węgierska', pt: 'Hungarian', tr: 'Hungarian' } },
                { value: 'hunnic', display: { en: 'Hunnic', zh: '匈', ru: 'Гунны', fr: 'hunnique', es: 'huna', de: 'Hunnisch', ja: 'フン', ko: '훈', pl: 'Hunnicka', pt: 'Hunnic', tr: 'Hunnic' } },
                { value: 'igbo', display: { en: 'Igbo', zh: '伊博', ru: 'Игбо', fr: 'igbo', es: 'igba', de: 'Igbonisch', ja: 'イボ', ko: '이그보', pl: 'Igbo', pt: 'Igbo', tr: 'Igbo' } },
                { value: 'ilmenian', display: { en: 'Ilmenian', zh: '伊尔门', ru: 'Ильменские словене', fr: 'ilmenienne', es: 'ilmenia', de: 'Ilmenisch', ja: 'イリメニ', ko: '일메니아', pl: 'Ilmeńska', pt: 'Ilmenian', tr: 'Ilmenian' } },
                { value: 'iloko', display: { en: 'Iloko', zh: '伊罗戈', ru: 'Илоки', fr: 'iloko', es: 'ilocana', de: 'Ilokoisch', ja: 'イロコ', ko: '일로코', pl: 'Ilokajska', pt: 'Iloko', tr: 'Iloko' } },
                { value: 'japanese', display: { en: 'Yamato', zh: '大和', ru: 'Ямато', fr: 'yamato', es: 'yamato', de: 'Yamatoisch', ja: '大和', ko: '야마토', pl: 'Yamato', pt: 'Yamato', tr: 'Yamato' } },
                { value: 'kachin', display: { en: 'Kachin', zh: '克钦', ru: 'Качины', fr: 'kachin', es: 'kachin', de: 'Kachin', ja: 'カチン', ko: '카친', pl: 'Kaczińska', pt: 'Kachin', tr: 'Kachin' } },
                { value: 'kannada', display: { en: 'Kannada', zh: '羯罗拿吒', ru: 'Каннада', fr: 'kannada', es: 'kannada', de: 'Kanaresisch', ja: 'カンナダ', ko: '칸나다', pl: 'Kannadyjska', pt: 'Kannada', tr: 'Kannada' } },
                { value: 'karelian', display: { en: 'Karelian', zh: '卡累利阿', ru: 'Карелы', fr: 'carélienne', es: 'carelia', de: 'Karelisch', ja: 'カレリア', ko: '카렐리야', pl: 'Karelska', pt: 'Karelian', tr: 'Karelian' } },
                { value: 'karen', display: { en: 'Karen', zh: '克伦', ru: 'Карены', fr: 'karène', es: 'karen', de: 'Karenisch', ja: 'カレン', ko: '카렌', pl: 'Kareńska', pt: 'Karen', tr: 'Karen' } },
                { value: 'karluk', display: { en: 'Karluk', zh: '葛逻禄', ru: 'Карлуки', fr: 'karlouke', es: 'carluca', de: 'Karlukisch', ja: 'カルルク', ko: '카를루크', pl: 'Karlucka', pt: 'Karluk', tr: 'Karluk' } },
                { value: 'kashmiri', display: { en: 'Kashmiri', zh: '迦湿弥罗', ru: 'Кашмирцы', fr: 'cachemiri', es: 'cachemir', de: 'Kaschmirisch', ja: 'カシミール', ko: '카슈미르', pl: 'Kaszmirska', pt: 'Kashmiri', tr: 'Kashmiri' } },
                { value: 'kazak', display: { en: 'Kazak', zh: '喀扎克', ru: 'Казаки', fr: 'kazakhe', es: 'kazaja', de: 'Kasachisch', ja: 'カザフ', ko: '카자크', pl: 'Kazacka', pt: 'Kazak', tr: 'Kazak' } },
                { value: 'kerait', display: { en: 'Kerait', zh: '克烈亦惕', ru: 'Кереиты', fr: 'kéraïte', es: 'keraita', de: 'Keraitisch', ja: 'ケレイト', ko: '케레이트', pl: 'Kereicka', pt: 'Kerait', tr: 'Kerait' } },
                { value: 'khanty', display: { en: 'Ostyak', zh: '奥斯佳克', ru: 'Остяки', fr: 'ostiak', es: 'ostiaca', de: 'Ostjakisch', ja: 'オスチャーク', ko: '오스야크', pl: 'Ostiacka', pt: 'Ostyak', tr: 'Ostyak' } },
                { value: 'khazar', display: { en: 'Khazar', zh: '可萨', ru: 'Хазары', fr: 'khazare', es: 'jázara', de: 'Chasarisch', ja: 'ハザール', ko: '하자르', pl: 'Chazarska', pt: 'Khazar', tr: 'Khazar' } },
                { value: 'khitan', display: { en: 'Khitan', zh: '契丹', ru: 'Кидани', fr: 'khitane', es: 'kitán', de: 'Kitanisch', ja: '契丹', ko: '거란', pl: 'Kitańska', pt: 'Khitan', tr: 'Khitan' } },
                { value: 'khmu', display: { en: 'Khmu', zh: '克木', ru: 'Кхму', fr: 'khmu', es: 'khmu', de: 'Khmuisch', ja: 'クム', ko: '크무', pl: 'Khmu', pt: 'Khmu', tr: 'Khmu' } },
                { value: 'khwarezmian', display: { en: 'Khwarezmian', zh: '花剌子模', ru: 'Хорезмийцы', fr: 'khwarezmienne', es: 'corasmia', de: 'Choresmisch', ja: 'ホラズム', ko: '호라즘', pl: 'Chorezmijska', pt: 'Khwarezmian', tr: 'Khwarezmian' } },
                { value: 'kimek', display: { en: 'Kimek', zh: '基马克', ru: 'Кимаки', fr: 'kimek', es: 'kimek', de: 'Kimekisch', ja: 'キメク', ko: '키멕', pl: 'Kimecka', pt: 'Kimek', tr: 'Kimek' } },
                { value: 'kipchak', display: { en: 'Kipchak', zh: '钦察', ru: 'Кыпчаки', fr: 'kiptchak', es: 'kipchak', de: 'Kipchakisch', ja: 'キプチャク', ko: '킵차크', pl: 'Kipczacka', pt: 'Kipchak', tr: 'Kipchak' } },
                { value: 'kirati', display: { en: 'Kirati', zh: '罽罗多', ru: 'Кираты', fr: 'kirate', es: 'kirati', de: 'Kiratisch', ja: 'キラント', ko: '키라티', pl: 'Kiratijska', pt: 'Kirati', tr: 'Kirati' } },
                { value: 'kirghiz', display: { en: 'Kirghiz', zh: '黠戛斯', ru: 'Кыргызы', fr: 'kirghize', es: 'kirguís', de: 'Kirgisisch', ja: 'キルギス', ko: '키르기즈', pl: 'Kirgiska', pt: 'Kirghiz', tr: 'Kirghiz' } },
                { value: 'kochinim', display: { en: 'Kochini', zh: '柯枝', ru: 'Кочинские евреи', fr: 'juive de Cochin', es: 'kochini', de: 'Kochinisch', ja: 'コーチニム', ko: '코치님', pl: 'Koczińska', pt: 'Kochini', tr: 'Kochini' } },
                { value: 'komi', display: { en: 'Permian', zh: '彼尔姆', ru: 'Пермяки', fr: 'permienne', es: 'permiana', de: 'Permisch', ja: 'ペルム', ko: '페름', pl: 'Permska', pt: 'Permian', tr: 'Permian' } },
                { value: 'kru', display: { en: 'Kru', zh: '克鲁', ru: 'Кру', fr: 'krou', es: 'kru', de: 'Kruisch', ja: 'クル', ko: '크루', pl: 'Kruska', pt: 'Kru', tr: 'Kru' } },
                { value: 'kurdish', display: { en: 'Kurdish', zh: '库尔德', ru: 'Курды', fr: 'kurde', es: 'kurda', de: 'Kurdisch', ja: 'クルド', ko: '쿠르드', pl: 'Kurdyjska', pt: 'Kurdish', tr: 'Kurdish' } },
                { value: 'laktan', display: { en: 'Laktan', zh: '勒多', ru: 'Ланиказы', fr: 'laktane', es: 'laktan', de: 'Laktanisch', ja: 'ラクタン', ko: '라크탄', pl: 'Laktańska', pt: 'Laktan', tr: 'Laktan' } },
                { value: 'langobard', display: { en: 'Langobard', zh: '古伦巴第', ru: 'Лангобарды', fr: 'langobarde', es: 'longobarda', de: 'Langobardisch', ja: 'ランゴバルド', ko: '랑고바르드', pl: 'Longobardzka', pt: 'Langobard', tr: 'Langobard' } },
                { value: 'levantine', display: { en: 'Mashriqi', zh: '马什里克', ru: 'Машрикцы', fr: 'mashriqi', es: 'mashriqi', de: 'Mashriqisch', ja: 'マシュリク', ko: '마슈리크', pl: 'Maszrecka', pt: 'Mashriqi', tr: 'Mashriqi' } },
                { value: 'lhomon', display: { en: 'Lhomon', zh: '珞门', ru: 'Лхомоны', fr: 'lhomon', es: 'lhomon', de: 'Lhomonisch', ja: 'ローモン', ko: '로몬', pl: 'Lhomońska', pt: 'Lhomon', tr: 'Lhomon' } },
                { value: 'lithuanian', display: { en: 'Lithuanian', zh: '立陶宛', ru: 'Литовцы', fr: 'lituanienne', es: 'lituana', de: 'Litauisch', ja: 'リトアニア', ko: '리투아니아', pl: 'Litewska', pt: 'Lithuanian', tr: 'Lithuanian' } },
                { value: 'lombard', display: { en: 'Lombard', zh: '伦巴第', ru: 'Ломбарды', fr: 'lombarde', es: 'lombarda', de: 'Lombardisch', ja: 'ランゴバルド', ko: '롬바르디아', pl: 'Lombardzka', pt: 'Lombard', tr: 'Lombard' } },
                { value: 'macedonian', display: { en: 'Macedonian', zh: '马其顿', ru: 'Македоняне', fr: 'macédonienne', es: 'macedonia', de: 'Mazedonisch', ja: 'マケドニア', ko: '마케도니아', pl: 'Macedońska', pt: 'Macedonian', tr: 'Macedonian' } },
                { value: 'maghrebi', display: { en: 'Maghrebi', zh: '马格里布', ru: 'Магрибцы', fr: 'maghrébine', es: 'magrebí', de: 'Maghrebinisch', ja: 'マグリブ', ko: '마그레브', pl: 'Maghrebska', pt: 'Maghrebi', tr: 'Maghrebi' } },
                { value: 'malay', display: { en: 'Malay', zh: '末罗瑜', ru: 'Малайцы', fr: 'malaise', es: 'malaya', de: 'Malaiisch', ja: 'マレー', ko: '말레이', pl: 'Malajska', pt: 'Malay', tr: 'Malay' } },
                { value: 'maluku', display: { en: 'Moluccan', zh: '文老古', ru: 'Молукканцы', fr: 'moluquoise', es: 'moluca', de: 'Molukkisch', ja: 'モルッカ', ko: '몰루칸', pl: 'Molukańska', pt: 'Moluccan', tr: 'Moluccan' } },
                { value: 'malvi', display: { en: 'Malvi', zh: '摩腊婆', ru: 'Мальви', fr: 'malvi', es: 'malvi', de: 'Malvisch', ja: 'マールヴィー', ko: '말와', pl: 'Malwi', pt: 'Malvi', tr: 'Malvi' } },
                { value: 'marathi', display: { en: 'Marathi', zh: '摩剌侘', ru: 'Маратхи', fr: 'marathi', es: 'marati', de: 'Marathisch', ja: 'マラーター', ko: '마라티', pl: 'Maracka', pt: 'Marathi', tr: 'Marathi' } },
                { value: 'mari', display: { en: 'Mari', zh: '马里', ru: 'Марийцы', fr: 'marie', es: 'mari', de: 'Marisch', ja: 'マリ', ko: '마리', pl: 'Maryjska', pt: 'Mari', tr: 'Mari' } },
                { value: 'marka', display: { en: 'Marka', zh: '马尔卡', ru: 'Марка', fr: 'marka', es: 'marka', de: 'Markanisch', ja: 'マルカ', ko: '마르카', pl: 'Markijska', pt: 'Marka', tr: 'Marka' } },
                { value: 'mel', display: { en: 'Mel', zh: '梅尔', ru: 'Мелы', fr: 'mel', es: 'mel', de: 'Melisch', ja: 'メル', ko: '멜', pl: 'Melska', pt: 'Mel', tr: 'Mel' } },
                { value: 'merya', display: { en: 'Merya', zh: '梅里亚', ru: 'Меря', fr: 'mérienne', es: 'merya', de: 'Merjanisch', ja: 'メリャ', ko: '미리야', pl: 'Meria', pt: 'Merya', tr: 'Merya' } },
                { value: 'meshchera', display: { en: 'Meshchera', zh: '梅晓拉', ru: 'Мещера', fr: 'mechtchérienne', es: 'meshchora', de: 'Meschtscherisch', ja: 'ミェシチョール', ko: '미쉬체라', pl: 'Mieszczerska', pt: 'Meshchera', tr: 'Meshchera' } },
                { value: 'mohe', display: { en: 'Mohe', zh: '靺鞨', ru: 'Мохэ', fr: 'mohe', es: 'mohe', de: 'Moheisch', ja: '靺鞨', ko: '말갈', pl: 'Malgaska', pt: 'Mohe', tr: 'Mohe' } },
                { value: 'mon', display: { en: 'Mon', zh: '孟', ru: 'Моны', fr: 'môn', es: 'mon', de: 'Monisch', ja: 'モン', ko: '몬', pl: 'Mońska', pt: 'Mon', tr: 'Mon' } },
                { value: 'mordvin', display: { en: 'Mordvin', zh: '莫尔多瓦', ru: 'Мордвинцы', fr: 'mordvine', es: 'mordvina', de: 'Mordwinisch', ja: 'モルドヴィン', ko: '모르도바', pl: 'Mordwińska', pt: 'Mordvin', tr: 'Mordvin' } },
                { value: 'mossi', display: { en: 'Mossi', zh: '莫西', ru: 'Мосси', fr: 'mossi', es: 'mossi', de: 'Mossinisch', ja: 'モシ', ko: '모씨', pl: 'Mossijska', pt: 'Mossi', tr: 'Mossi' } },
                { value: 'muroma', display: { en: 'Muroma', zh: '穆罗马', ru: 'Мурома', fr: 'mouromienne', es: 'muromiana', de: 'Muromisch', ja: 'ムーロマ', ko: '무로마', pl: 'Muromska', pt: 'Muroma', tr: 'Muroma' } },
                { value: 'naiman', display: { en: 'Naiman', zh: '乃蛮', ru: 'Найманы', fr: 'naïmane', es: 'naimana', de: 'Naimanisch', ja: 'ナイマン', ko: '나이만', pl: 'Najmańska', pt: 'Naiman', tr: 'Naiman' } },
                { value: 'nepali', display: { en: 'Nepali', zh: '尼波罗', ru: 'Непальцы', fr: 'népalaise', es: 'nepalí', de: 'Nepalesisch', ja: 'ネパール', ko: '네팔', pl: 'Nepalska', pt: 'Nepali', tr: 'Nepali' } },
                { value: 'norman', display: { en: 'Norman', zh: '诺曼', ru: 'Норманны', fr: 'normande', es: 'normanda', de: 'Normannisch', ja: 'ノルマン', ko: '노르만', pl: 'Normańska', pt: 'Norman', tr: 'Norman' } },
                { value: 'norwegian', display: { en: 'Norwegian', zh: '挪威', ru: 'Норвежцы', fr: 'norvégienne', es: 'noruega', de: 'Norwegisch', ja: 'ノルウェー', ko: '노르웨이', pl: 'Norweska', pt: 'Norwegian', tr: 'Norwegian' } },
                { value: 'nubian', display: { en: 'Nubian', zh: '努比亚', ru: 'Нубийцы', fr: 'nubienne', es: 'nubia', de: 'Nubisch', ja: 'ヌビア', ko: '누비아', pl: 'Nubijska', pt: 'Nubian', tr: 'Nubian' } },
                { value: 'nupe', display: { en: 'Nupe', zh: '努佩', ru: 'Нупе', fr: 'nupe', es: 'nupe', de: 'Nupisch', ja: 'ヌペ', ko: '누페', pl: 'Nupijska', pt: 'Nupe', tr: 'Nupe' } },
                { value: 'occitan', display: { en: 'Occitan', zh: '奥克', ru: 'Окситанцы', fr: 'occitane', es: 'occitana', de: 'Okzitanisch', ja: 'オック', ko: '옥시타니아', pl: 'Oksytańska', pt: 'Occitan', tr: 'Occitan' } },
                { value: 'oirat', display: { en: 'Oirat', zh: '斡亦剌惕', ru: 'Ойраты', fr: 'oïrate', es: 'oirate', de: 'Oiratisch', ja: 'オイラト', ko: '오이라트', pl: 'Ojracka', pt: 'Oirat', tr: 'Oirat' } },
                { value: 'old_saxon', display: { en: 'Old Saxon', zh: '古撒克逊', ru: 'Саксы', fr: 'vieille saxonne', es: 'sajona antigua', de: 'Altsächsisch', ja: '古サクソン', ko: '고 색슨', pl: 'Starosaska', pt: 'Old Saxon', tr: 'Old Saxon' } },
                { value: 'ongud', display: { en: 'Öngüd', zh: '汪古惕', ru: 'Онгуты', fr: 'öngüte', es: 'öngüd', de: 'Öngüdisch', ja: 'オングト', ko: '옹구트', pl: 'Ongucka', pt: 'Öngüd', tr: 'Öngüd' } },
                { value: 'oriya', display: { en: 'Oriya', zh: '乌里舍', ru: 'Ория', fr: 'oriya', es: 'oriya', de: 'Oriyanisch', ja: 'オリヤー', ko: '오리야', pl: 'Orija', pt: 'Oriya', tr: 'Oriya' } },
                { value: 'papuan', display: { en: 'Papuan', zh: '巴布亚', ru: 'Папуасы', fr: 'papoue', es: 'papúa', de: 'Papuanisch', ja: 'パプア', ko: '파푸아', pl: 'Papuaska', pt: 'Papuan', tr: 'Papuan' } },
                { value: 'pecheneg', display: { en: 'Pecheneg', zh: '佩切涅格', ru: 'Печенеги', fr: 'petchénègue', es: 'pechenega', de: 'Petschenegisch', ja: 'ペチェネグ', ko: '페체네그', pl: 'Pieczyngijska', pt: 'Pecheneg', tr: 'Pecheneg' } },
                { value: 'persian', display: { en: 'Persian', zh: '波斯', ru: 'Персы', fr: 'perse', es: 'persa', de: 'Persisch', ja: 'ペルシア', ko: '페르시아', pl: 'Perska', pt: 'Persian', tr: 'Persian' } },
                { value: 'polabian', display: { en: 'Polabian', zh: '波拉布', ru: 'Полабы', fr: 'polabe', es: 'polabia', de: 'Polabisch', ja: 'ポラーブ', ko: '폴라브', pl: 'Połabska', pt: 'Polabian', tr: 'Polabian' } },
                { value: 'polish', display: { en: 'Polish', zh: '波兰', ru: 'Поляки', fr: 'polonaise', es: 'polaca', de: 'Polnisch', ja: 'ポーランド', ko: '폴란드', pl: 'Polska', pt: 'Polish', tr: 'Polish' } },
                { value: 'portuguese', display: { en: 'Portuguese', zh: '葡萄牙', ru: 'Португальцы', fr: 'portugaise', es: 'portuguesa', de: 'Portugiesisch', ja: 'ポルトガル', ko: '포르투갈', pl: 'Portugalska', pt: 'Portuguese', tr: 'Portuguese' } },
                { value: 'prussian', display: { en: 'Prussian', zh: '普鲁士', ru: 'Пруссы', fr: 'prussienne', es: 'prusiana', de: 'Pruzzisch', ja: 'プルーセン', ko: '프로이센', pl: 'Pruska', pt: 'Prussian', tr: 'Prussian' } },
                { value: 'punjabi', display: { en: 'Punjabi', zh: '旁遮普', ru: 'Пенджабцы', fr: 'pendjabi', es: 'punyabí', de: 'Punjabisch', ja: 'パンジャーブ', ko: '펀자브', pl: 'Pendżabska', pt: 'Punjabi', tr: 'Punjabi' } },
                { value: 'qiang', display: { en: 'Qiang', zh: '羌', ru: 'Цяны', fr: 'qiang', es: 'qiang', de: 'Qiangisch', ja: '羌', ko: '강족', pl: 'Qiangijska', pt: 'Qiang', tr: 'Qiang' } },
                { value: 'radhanite', display: { en: 'Radhanite', zh: '拉赞尼亚', ru: 'Рахдониты', fr: 'radhanite', es: 'radhanita', de: 'Radhanitisch', ja: 'ラダニテ', ko: '라다니트', pl: 'Radanicka', pt: 'Radhanite', tr: 'Radhanite' } },
                { value: 'rajput', display: { en: 'Rajasthani', zh: '罗阇萨傥那', ru: 'Раджастханцы', fr: 'rajasthani', es: 'rajastaní', de: 'Rajasthanisch', ja: 'ラージャスターン', ko: '라즈푸트', pl: 'Radżastańska', pt: 'Rajasthani', tr: 'Rajasthani' } },
                { value: 'roman', display: { en: 'Roman', zh: '罗马', ru: 'Римляне', fr: 'romaine', es: 'romana', de: 'Römisch', ja: 'ローマ', ko: '로마', pl: 'Rzymska', pt: 'Roman', tr: 'Roman' } },
                { value: 'ryukyuan', display: { en: 'Ryukyuan', zh: '琉球', ru: 'Рюкюсцы', fr: 'ryukyuane', es: 'ryukyuesa', de: 'Ryūkyūisch', ja: '琉球', ko: '류큐', pl: 'Riukiańska', pt: 'Ryukyuan', tr: 'Ryukyuan' } },
                { value: 'saka', display: { en: 'Saka', zh: '塞种', ru: 'Сака', fr: 'saka', es: 'saka', de: 'Sakisch', ja: 'サカ', ko: '사카', pl: 'Sakijska', pt: 'Saka', tr: 'Saka' } },
                { value: 'sami', display: { en: 'Sami', zh: '萨米', ru: 'Саамы', fr: 'same', es: 'sami', de: 'Samisch', ja: 'サーミ', ko: '사미', pl: 'Lapońska', pt: 'Sami', tr: 'Sami' } },
                { value: 'samoyed', display: { en: 'Bjarmian', zh: '比亚尔米亚', ru: 'Бьярмы', fr: 'biarmienne', es: 'biarmia', de: 'Bjarmaländisch', ja: 'ビャルム', ko: '뱌르미아', pl: 'Biarmska', pt: 'Bjarmian', tr: 'Bjarmian' } },
                { value: 'sao', display: { en: 'Sao', zh: '萨奥', ru: 'Сао', fr: 'sao', es: 'sao', de: 'Saonisch', ja: 'サオ', ko: '사오', pl: 'Saoska', pt: 'Sao', tr: 'Sao' } },
                { value: 'sardinian', display: { en: 'Sardinian', zh: '撒丁', ru: 'Сардинцы', fr: 'sarde', es: 'sardo', de: 'Sardinisch', ja: 'サルデーニャ', ko: '사르데냐', pl: 'Sardyńska', pt: 'Sardinian', tr: 'Sardinian' } },
                { value: 'scottish', display: { en: 'Scots', zh: '苏格兰', ru: 'Шотландцы', fr: 'écossaise', es: 'escocesa', de: 'Schottisch', ja: 'スコットランド', ko: '스코틀랜드', pl: 'Szkoci', pt: 'Scots', tr: 'Scots' } },
                { value: 'senoi', display: { en: 'Senoi', zh: '塞诺', ru: 'Сенои', fr: 'senoï', es: 'senoi', de: 'Senoisch', ja: 'セノイ', ko: '세노이', pl: 'Senoi', pt: 'Senoi', tr: 'Senoi' } },
                { value: 'sephardi', display: { en: 'Sephardi', zh: '塞法迪', ru: 'Сефарды', fr: 'séfarade', es: 'sefardí', de: 'Sephardisch', ja: 'セファルディム', ko: '스파라드', pl: 'Sefardyjska', pt: 'Sephardi', tr: 'Sephardi' } },
                { value: 'serbian', display: { en: 'Serbian', zh: '塞尔维亚', ru: 'Сербы', fr: 'serbe', es: 'serbia', de: 'Serbisch', ja: 'セルビア', ko: '세르비아', pl: 'Serbska', pt: 'Serbian', tr: 'Serbian' } },
                { value: 'serer', display: { en: 'Serer', zh: '塞雷尔', ru: 'Сереры', fr: 'sérère', es: 'serer', de: 'Sererisch', ja: 'セレール', ko: '세레르', pl: 'Sererska', pt: 'Serer', tr: 'Serer' } },
                { value: 'severian', display: { en: 'Severian', zh: '谢韦里亚', ru: 'Северяне', fr: 'sévériane', es: 'severiana', de: 'Sewerjanisch', ja: 'シヴェーリア', ko: '세르비아', pl: 'Siewierska', pt: 'Severian', tr: 'Severian' } },
                { value: 'shatuo', display: { en: 'Shatuo', zh: '沙陀', ru: 'Шато', fr: 'shatuo', es: 'shatuo', de: 'Shatuoisch', ja: '沙陀', ko: '사타', pl: 'Shatuoaska', pt: 'Shatuo', tr: 'Shatuo' } },
                { value: 'shiwei', display: { en: 'Shiwei', zh: '室韦', ru: 'Шивэй', fr: 'shiwei', es: 'shiwei', de: 'Schiwei', ja: '室韋', ko: '실위', pl: 'Sziwejska', pt: 'Shiwei', tr: 'Shiwei' } },
                { value: 'sicilian', display: { en: 'Sicilian', zh: '西西里', ru: 'Сицилийцы', fr: 'sicilienne', es: 'siciliana', de: 'Sizilianisch', ja: 'シチリア', ko: '시칠리아', pl: 'Sycylijska', pt: 'Sicilian', tr: 'Sicilian' } },
                { value: 'silla', display: { en: 'Silla', zh: '新罗', ru: 'Силла', fr: 'silla', es: 'silla', de: 'Sillaisch', ja: '新羅', ko: '신라', pl: 'Sillańska', pt: 'Silla', tr: 'Silla' } },
                { value: 'sindhi', display: { en: 'Sindhi', zh: '信度', ru: 'Синды', fr: 'sindhi', es: 'sindhi', de: 'Sindhisch', ja: 'シンド', ko: '신드', pl: 'Sindhijska', pt: 'Sindhi', tr: 'Sindhi' } },
                { value: 'sinhala', display: { en: 'Sinhala', zh: '僧伽罗', ru: 'Сингалы', fr: 'cinghalaise', es: 'cingalesa', de: 'Singhalenisch', ja: 'シンハラ', ko: '싱할라', pl: 'Syngaleska', pt: 'Sinhala', tr: 'Sinhala' } },
                { value: 'slovien', display: { en: 'Slovien', zh: '斯洛伐克', ru: 'Словенцы', fr: 'slovienne', es: 'esloveno', de: 'Slowenisch', ja: 'スロヴァキア', ko: '슬로비엔', pl: 'Starosłowacka', pt: 'Slovien', tr: 'Slovien' } },
                { value: 'sogdian', display: { en: 'Sogdian', zh: '粟特', ru: 'Согдийцы', fr: 'sogdienne', es: 'sogdiana', de: 'Sogdisch', ja: 'ソグド', ko: '소그드', pl: 'Sogdyjska', pt: 'Sogdian', tr: 'Sogdian' } },
                { value: 'songhai', display: { en: 'Songhai', zh: '桑海', ru: 'Сонгайцы', fr: 'songhaï', es: 'songhai', de: 'Songhaianisch', ja: 'ソンガイ', ko: '송하이', pl: 'Songhajska', pt: 'Songhai', tr: 'Songhai' } },
                { value: 'suebi', display: { en: 'Suebi', zh: '苏维汇', ru: 'Свевы', fr: 'suève', es: 'sueba', de: 'Suebisch', ja: 'スエビ', ko: '수에비', pl: 'Swebska', pt: 'Suebi', tr: 'Suebi' } },
                { value: 'sumpa', display: { en: 'Sumpa', zh: '苏毗', ru: 'Сумпа', fr: 'sumpa', es: 'sumpa', de: 'Sumpaisch', ja: 'スムパ', ko: '숨파', pl: 'Sumpijska', pt: 'Sumpa', tr: 'Sumpa' } },
                { value: 'swabian', display: { en: 'Swabian', zh: '施瓦本', ru: 'Швабцы', fr: 'souabe', es: 'suaba', de: 'Schwäbisch', ja: 'シュヴァーベン', ko: '슈바벤', pl: 'Szwabska', pt: 'Swabian', tr: 'Swabian' } },
                { value: 'swahili', display: { en: 'Swahili', zh: '斯瓦希里', ru: 'Суахили', fr: 'swahilie', es: 'suajili', de: 'Swahilisch', ja: 'スワヒリ', ko: '스와힐리', pl: 'Suahilijska', pt: 'Swahili', tr: 'Swahili' } },
                { value: 'swedish', display: { en: 'Swedish', zh: '瑞典', ru: 'Шведы', fr: 'suédoise', es: 'sueca', de: 'Schwedisch', ja: 'スウェーデン', ko: '스웨덴', pl: 'Szwedzka', pt: 'Swedish', tr: 'Swedish' } },
                { value: 'tagalog', display: { en: 'Tagalog', zh: '他加禄', ru: 'Тагалы', fr: 'tagalog', es: 'tagala', de: 'Tagalisch', ja: 'タガログ', ko: '타갈로그', pl: 'Tagalska', pt: 'Tagalog', tr: 'Tagalog' } },
                { value: 'tajik', display: { en: 'Tajik', zh: '塔吉克', ru: 'Таджики', fr: 'tadjik', es: 'tayika', de: 'Tadschikisch', ja: 'タジク', ko: '타지크', pl: 'Tadżycka', pt: 'Tajik', tr: 'Tajik' } },
                { value: 'telugu', display: { en: 'Telugu', zh: '泰卢固', ru: 'Телугу', fr: 'télougou', es: 'telugu', de: 'Teluguisch', ja: 'テルグ', ko: '텔루구', pl: 'Telugijska', pt: 'Telugu', tr: 'Telugu' } },
                { value: 'tocharian', display: { en: 'Tocharian', zh: '吐火罗', ru: 'Тохары', fr: 'tokharienne', es: 'tocaria', de: 'Tocharisch', ja: 'トハラ', ko: '토하라', pl: 'Tocharska', pt: 'Tocharian', tr: 'Tocharian' } },
                { value: 'toraja', display: { en: 'Toraja', zh: '托拉查', ru: 'Тораджи', fr: 'toraja', es: 'toraya', de: 'Torajanisch', ja: 'トラジャ', ko: '토라자', pl: 'Toradżaska', pt: 'Toraja', tr: 'Toraja' } },
                { value: 'trojan', display: { en: 'Trojan', zh: '特洛伊', ru: 'Троянцы', fr: 'troyenne', es: 'troyana', de: 'Trojanisch', ja: 'トロイ', ko: '트로이', pl: 'Trojańska', pt: 'Trojan', tr: 'Trojan' } },
                { value: 'tsangpa', display: { en: 'Tsangpa', zh: '藏巴', ru: 'Цангпа', fr: 'tsangpa', es: 'tsangpa', de: 'Tsangpanisch', ja: 'ツァンパ', ko: '창파', pl: 'Tsangpijska', pt: 'Tsangpa', tr: 'Tsangpa' } },
                { value: 'turkmen', display: { en: 'Turkmen', zh: '土库曼', ru: 'Туркмены', fr: 'turkmène', es: 'turcomana', de: 'Turkmenisch', ja: 'トルクメン', ko: '투르크멘', pl: 'Turkmeńska', pt: 'Turkmen', tr: 'Turkmen' } },
                { value: 'tuyuhun', display: { en: 'Tuyuhun', zh: '吐谷浑', ru: 'Туюйхунь', fr: 'tuyuhun', es: 'tuyuhun', de: 'Tuyuhunisch', ja: '吐谷渾', ko: '토욕혼', pl: 'Tujuhuńska', pt: 'Tuyuhun', tr: 'Tuyuhun' } },
                { value: 'uriankhai', display: { en: 'Uriankhai', zh: '兀良孩', ru: 'Урянхайцы', fr: 'uriankhai', es: 'uriankai', de: 'Uriankhaianisch', ja: 'ウリャンカイ', ko: '우량하이', pl: 'Urianchajska', pt: 'Uriankhai', tr: 'Uriankhai' } },
                { value: 'uyghur', display: { en: 'Uyghur', zh: '回鹘', ru: 'Уйгуры', fr: 'ouïghoure', es: 'uigur', de: 'Uigurisch', ja: 'ウイグル', ko: '위구르', pl: 'Ujgurska', pt: 'Uyghur', tr: 'Uyghur' } },
                { value: 'vepsian', display: { en: 'Vepsian', zh: '韦普斯', ru: 'Чудь', fr: 'vepse', es: 'vepsiana', de: 'Wepsisch', ja: 'ヴェプス', ko: '벱스', pl: 'Wepska', pt: 'Vepsian', tr: 'Vepsian' } },
                { value: 'visigothic', display: { en: 'Visigothic', zh: '西哥特', ru: 'Вестготы', fr: 'wisigothique', es: 'visigoda', de: 'Westgotisch', ja: '西ゴート', ko: '서고트', pl: 'Wizygocka', pt: 'Visigothic', tr: 'Visigothic' } },
                { value: 'volhynian', display: { en: 'Volhynian', zh: '沃利尼亚', ru: 'Волыняне', fr: 'volhynienne', es: 'volinia', de: 'Wolhynisch', ja: 'ヴォルィニャーネ', ko: '볼히니아', pl: 'Wołyńska', pt: 'Volhynian', tr: 'Volhynian' } },
                { value: 'welayta', display: { en: 'Welayta', zh: '沃莱塔', ru: 'Воламо', fr: 'welayta', es: 'welayta', de: 'Wolayttanisch', ja: 'ウォライタ', ko: '월라이타', pl: 'Wolaita', pt: 'Welayta', tr: 'Welayta' } },
                { value: 'welsh', display: { en: 'Welsh', zh: '威尔士', ru: 'Валлийцы', fr: 'galloise', es: 'galesa', de: 'Walisisch', ja: 'ウェールズ', ko: '웨일스', pl: 'Walijska', pt: 'Welsh', tr: 'Welsh' } },
                { value: 'wolof', display: { en: 'Wolof', zh: '沃洛夫', ru: 'Волофы', fr: 'wolof', es: 'wólof', de: 'Wolofisch', ja: 'ウォロフ', ko: '월로프', pl: 'Wolofska', pt: 'Wolof', tr: 'Wolof' } },
                { value: 'yao', display: { en: 'Yao', zh: '傜', ru: 'Яо', fr: 'yao', es: 'yao', de: 'Yaoisch', ja: 'ヤオ', ko: '야오족', pl: 'Yao', pt: 'Yao', tr: 'Yao' } },
                { value: 'yemeni', display: { en: 'Yemeni', zh: '也门', ru: 'Йеменцы', fr: 'yéménite', es: 'yemení', de: 'Jemenitisch', ja: 'イエメン', ko: '예멘', pl: 'Jemeńska', pt: 'Yemeni', tr: 'Yemeni' } },
                { value: 'yi', display: { en: 'Yi', zh: '彝', ru: 'И', fr: 'yi', es: 'yi', de: 'Yiisch', ja: 'イー', ko: '이', pl: 'Yi', pt: 'Yi', tr: 'Yi' } },
                { value: 'yughur', display: { en: 'Yughur', zh: '尧呼尔', ru: 'Желтые уйгуры', fr: 'yugure', es: 'yugur', de: 'Yugurisch', ja: 'ユグル', ko: '유구르', pl: 'Jögurska', pt: 'Yughur', tr: 'Yughur' } },
                { value: 'zaghawa', display: { en: 'Zaghawa', zh: '扎加瓦', ru: 'Загава', fr: 'zaghawa', es: 'zaghawa', de: 'Zaghawarisch', ja: 'ザガワ', ko: '자가와', pl: 'Zaghawijska', pt: 'Zaghawa', tr: 'Zaghawa' } },
                { value: 'zhangzhung', display: { en: 'Zhangzhung', zh: '象雄', ru: 'Шангшунги', fr: 'zhangzhung', es: 'zhangzhung', de: 'Shangshungisch', ja: 'シャンシュン', ko: '샹슝', pl: 'Szangszung', pt: 'Zhangzhung', tr: 'Zhangzhung' } }
            ],
            desc: {
                en: 'Quick-pick a culture for the target to adopt (optional, defaults to the source character\'s culture).',
                zh: '快速选择目标要采用的文化（可选，默认为源角色的文化）。',
                ru: 'Быстро выберите культуру, которую примет цель (необязательно, по умолчанию — культура персонажа-источника).',
                fr: 'Sélection rapide d\'une culture à adopter par la cible (facultatif, par défaut la culture du personnage source).',
                es: 'Selección rápida de una cultura para que la adopte el objetivo (opcional, por defecto la cultura del personaje de origen).',
                de: 'Schnellauswahl einer Kultur, die das Ziel annimmt (optional, Standard ist die Kultur des Quellcharakters).',
                ja: 'ターゲットが採用する文化をクイックピック（オプション、デフォルトはソースキャラクターの文化）。',
                ko: '대상이 채택할 문화를 빠르게 선택합니다(선택 사항, 기본값은 원본 캐릭터의 문화).',
                pl: 'Szybki wybór kultury, którą przyjmie cel (opcjonalnie, domyślnie kultura postaci źródłowej).',
                pt: 'Seleção rápida de uma cultura para o alvo adotar (opcional, padrão para a cultura do personagem de origem).',
                tr: 'Hedefin benimseyeceği kültürü hızlı seçin (isteğe bağlı, varsayılan olarak kaynak karakterin kültürü).'
            },
        },
        {
            name: "customCultureKey",
            type: "string",
            desc: {
                en: 'Free-text culture key (e.g., \'danish\'). Overridden by quickPickCulture if selected. If both are empty, defaults to the source character\'s culture.',
                zh: '自由文本文化键（例如 \'danish\'）。如果选择了快速选择文化，则被覆盖。如果两者都为空，则默认为源角色的文化。',
                ru: 'Произвольный ключ культуры (например, \'danish\'). Переопределяется быстрым выбором, если он выбран. Если оба пусты, по умолчанию используется культура персонажа-источника.',
                fr: 'Clé de culture en texte libre (par exemple, \'danish\'). Remplacée par la sélection rapide si choisie. Si les deux sont vides, la culture du personnage source est utilisée par défaut.',
                es: 'Clave de cultura de texto libre (p. ej., \'danish\'). Anulada por quickPickCulture si se selecciona. Si ambos están vacíos, por defecto es la cultura del personaje de origen.',
                de: 'Freitext-Kulturschlüssel (z. B. \'danish\'). Wird durch quickPickCulture überschrieben, falls ausgewählt. Wenn beide leer sind, wird standardmäßig die Kultur des Quellcharakters verwendet.',
                ja: '自由テキストの文化キー（例：\'danish\'）。クイックピック文化が選択されている場合は上書きされます。両方が空の場合は、ソースキャラクターの文化がデフォルトになります。',
                ko: '자유 텍스트 문화 키(예: \'danish\'). 빠른 선택 문화가 선택된 경우 무시됩니다. 둘 다 비어 있으면 원본 캐릭터의 문화로 기본 설정됩니다.',
                pl: 'Dowolny klucz kultury (np. \'danish\'). Zastąpiony przez quickPickCulture, jeśli wybrano. Jeśli oba są puste, domyślnie używana jest kultura postaci źródłowej.',
                pt: 'Chave de cultura de texto livre (ex: \'danish\'). Substituído por quickPickCulture se selecionado. Se ambos estiverem vazios, o padrão é a cultura do personagem de origem.',
                tr: 'Serbest metin kültür anahtarı (örn. \'danish\'). Hızlı seçim kültürü seçilirse geçersiz kılınır. Her ikisi de boşsa, varsayılan olarak kaynak karakterin kültürü kullanılır.'
            },
        }
    ],
    description: {
        en: 'Executed when a character adopts another\'s culture. The source (character1) is the one whose culture is ADOPTED (or the influencer). The target (character2) is the one whose culture CHANGES.',
        zh: '当一个角色采用另一个角色的文化时执行。源（character1）是被采用文化者（或影响者），目标（character2）是文化被改变者。',
        ru: 'Выполняется, когда персонаж принимает культуру другого. Источник (персонаж 1) — тот, чья культура принимается (или влияющий), цель (персонаж 2) меняет свою культуру.',
        fr: 'Exécuté lorsqu\'un personnage adopte la culture d\'un autre. La source (personnage 1) est celui dont la culture est adoptée (ou l\'influenceur), la cible (personnage 2) voit sa culture changer.',
        es: 'Ejecutado cuando un personaje adopta la cultura de otro. El origen (character1) es aquel cuya cultura se adopta (o el influyente), el objetivo (character2) cambia su cultura.',
        de: 'Wird ausgeführt, wenn ein Charakter die Kultur eines anderen annimmt. Die Quelle (Charakter 1) ist derjenige, dessen Kultur übernommen wird (oder der Einflussnehmer), das Ziel (Charakter 2) ändert seine Kultur.',
        ja: 'キャラクターが別のキャラクターの文化を採用したときに実行されます。ソース（キャラクター1）は文化が採用される側（または影響を与える側）、ターゲット（キャラクター2）は文化が変わる側です。',
        ko: '캐릭터가 다른 캐릭터의 문화를 채택할 때 실행됩니다. 소스(캐릭터 1)는 문화가 채택되는 쪽(또는 영향을 주는 쪽), 대상(캐릭터 2)은 문화가 바뀌는 쪽입니다.',
        pl: 'Wykonywane, gdy postać przyjmuje kulturę innej. Źródło (postać 1) to ta, której kultura jest przyjmowana (lub wpływająca), cel (postać 2) zmienia swoją kulturę.',
        pt: 'Executado quando um personagem adota a cultura de outro. A fonte (character1) é aquele cuja cultura é adotada (ou o influenciador), o alvo (character2) tem sua cultura alterada.',
        tr: 'Bir karakter başkasının kültürünü benimsediğinde çalıştırılır. Kaynak (character1) kültürü benimsenen (veya etkileyen) taraftır, hedef (character2) kültürünü değiştirir.'
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
        // Culture difference enforcement lives in preCheck (which sees the chosen
        // enum/free-text args; check receives none and must not gate on it).
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
            return { success: false, message: "A character cannot change their own culture through this action." };
        }

        const quickPick = args && args[0] ? String(args[0]).trim() : "";
        const customKey = args && args[1] ? String(args[1]).trim() : "";
        const rawCulture = quickPick || customKey;
        if (rawCulture) {
            const cultureKey = normalizeCultureKey(rawCulture);
            if (!/^[a-z0-9_]{2,64}$/.test(cultureKey)) {
                return { success: false, message: `Invalid culture key "${rawCulture}". Could not normalize to a valid key.` };
            }
            return { success: true };
        }

        const sourceCulture = String(source.culture || "").toLowerCase();
        const targetCulture = String(target.culture || "").toLowerCase();
        if (!sourceCulture || !targetCulture || sourceCulture === targetCulture) {
            return { success: false, message: "The source and target must be of different cultures for a culture change." };
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

        const quickPick = args && args[0] ? String(args[0]).trim() : "";
        const customKey = args && args[1] ? String(args[1]).trim() : "";
        const rawCulture = quickPick || customKey;
        const cultureKey = rawCulture ? normalizeCultureKey(rawCulture) : "";

        if (cultureKey) {
            runGameEffect(`
                global_var:votcce_action_target = {
                    set_culture = culture:${cultureKey}
                }`);
        } else {
            runGameEffect(`
                global_var:votcce_action_target = {
                    set_culture = global_var:votcce_action_source.culture
                }`);
        }
    },

    chatMessage: (args) => {
        const quickPick = args && args[0] ? String(args[0]).trim() : "";
        const customKey = args && args[1] ? String(args[1]).trim() : "";
        const rawCulture = quickPick || customKey;
        const cultureKey = rawCulture ? normalizeCultureKey(rawCulture) : "";
        let displayCulture = "their source's culture";
        if (quickPick) {
            const selectedOption = module.exports.args[0].options.find(opt => opt.value === quickPick);
            displayCulture = selectedOption ? selectedOption.display.en : quickPick;
        } else if (customKey) {
            displayCulture = customKey;
        }

        return {
            en: `{{character2Name}} adopted the ${displayCulture} culture under {{character1Name}}'s influence.`,
            zh: `{{character2Name}}在{{character1Name}}的影响下采用了${displayCulture}文化。`,
            ru: `{{character2Name}} принял(а) культуру ${displayCulture} под влиянием {{character1Name}}.`,
            fr: `{{character2Name}} a adopté la culture ${displayCulture} sous l'influence de {{character1Name}}.`,
            es: `{{character2Name}} adoptó la cultura ${displayCulture} bajo la influencia de {{character1Name}}.`,
            de: `{{character2Name}} übernahm die Kultur ${displayCulture} unter dem Einfluss von {{character1Name}}.`,
            ja: `{{character2Name}}は{{character1Name}}の影響下で${displayCulture}文化を採用しました。`,
            ko: `{{character2Name}}가 {{character1Name}}의 영향 아래 ${displayCulture} 문화를 채택했습니다.`,
            pl: `{{character2Name}} przyjął(ęła) kulturę ${displayCulture} pod wpływem {{character1Name}}.`,
            pt: `{{character2Name}} adotou a cultura ${displayCulture} sob a influência de {{character1Name}}.`,
            tr: `{{character2Name}}, {{character1Name}}'in etkisi altında ${displayCulture} kültürünü benimsedi.`
        };
    },
    chatMessageClass: "neutral-action-message"
};
