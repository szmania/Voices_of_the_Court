//Made by: VOTC-CE

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

module.exports = {
    signature: "startScheme",
    args: [
        {
            name: "schemeType",
            type: "enum",
            options: [
                { value: 'murder', display: { en: 'Murder', zh: '谋杀', ru: 'Убийство', fr: 'Meurtre', es: 'Asesinato', de: 'Mord', ja: '殺人', ko: '살해', pl: 'Zabójstwo', pt: 'Assassinato', tr: 'Cinayet' }},
                { value: 'sway', display: { en: 'Sway', zh: '拉拢', ru: 'Убеждение', fr: 'Séduction (persuasion)', es: 'Persuasión', de: 'Überzeugen', ja: '説得', ko: '설득', pl: 'Zjednywanie', pt: 'Persuasão', tr: 'İkna' }},
                { value: 'befriend', display: { en: 'Befriend', zh: '结交', ru: 'Дружба', fr: "Se lier d'amitié", es: 'Hacer amistad', de: 'Freundschaft', ja: '交友', ko: '친분', pl: 'Zaprzyjaźnienie', pt: 'Fazer amizade', tr: 'Dostluk' }},
                { value: 'fabricate_hook', display: { en: 'Fabricate Hook', zh: '伪造把柄', ru: 'Фальшивая зацепка', fr: 'Fabriquer un levier', es: 'Fabricar gancho', de: 'Belastung fabrizieren', ja: '弱みを捏造', ko: '약점 조작', pl: 'Sfabrykowanie haka', pt: 'Fabricar gancho', tr: 'Koz Uydurma' }},
                { value: 'claim_throne', display: { en: 'Claim Throne', zh: '争夺王位', ru: 'Притязание на трон', fr: 'Revendiquer le trône', es: 'Reclamar el trono', de: 'Thron beanspruchen', ja: '王位請求', ko: '왕위 주장', pl: 'Podważanie tronu', pt: 'Reivindicar o trono', tr: 'Taht Talebi' }},
                { value: 'learn_language', display: { en: 'Learn Language', zh: '学习语言', ru: 'Изучение языка', fr: 'Apprendre la langue', es: 'Aprender idioma', de: 'Sprache lernen', ja: '言語習得', ko: '언어 학습', pl: 'Nauka języka', pt: 'Aprender idioma', tr: 'Dil Öğrenme' }},
                { value: 'elope', display: { en: 'Elope', zh: '私奔', ru: 'Побег', fr: 'Fuir ensemble', es: 'Fuga de amor', de: 'Durchbrennen', ja: '駆け落ち', ko: '야반도주', pl: 'Ucieczka miłosna', pt: 'Fuga romântica', tr: 'Kaçma' }},
                { value: 'abduct', display: { en: 'Abduct', zh: '绑架', ru: 'Похищение', fr: 'Enlèvement', es: 'Secuestro', de: 'Entführung', ja: '誘拐', ko: '납치', pl: 'Porwanie', pt: 'Sequestro', tr: 'Kaçırma' }},
                { value: 'seduce', display: { en: 'Seduce', zh: '诱惑', ru: 'Соблазнение', fr: 'Séduire', es: 'Seducción', de: 'Verführung', ja: '誘惑', ko: '유혹', pl: 'Uwodzenie', pt: 'Sedução', tr: 'Baştan Çıkarma' }},
                { value: 'convert_to_witchcraft', display: { en: 'Convert to Witchcraft', zh: '转信巫术', ru: 'Обращение в колдовство', fr: 'Convertir à la sorcellerie', es: 'Convertir a la brujería', de: 'Zum Hexenwerk bekehren', ja: '魔術への改宗', ko: '마술 개종', pl: 'Nawracanie na czary', pt: 'Converter à bruxaria', tr: 'Büyücülüğe Döndürme' }}
            ],
            desc: {
                en: "scheme {{character1Name}} starts against {{character2Name}} (hostile: murder, fabricate_hook, claim_throne, abduct; social: sway, befriend, seduce, elope, learn_language, convert_to_witchcraft).",
                zh: "{{character1Name}}针对{{character2Name}}启动的阴谋（敌对：murder、fabricate_hook、claim_throne、abduct；社交：sway、befriend、seduce、elope、learn_language、convert_to_witchcraft）。",
                ru: "заговор, который {{character1Name}} начинает против {{character2Name}} (враждебные: murder, fabricate_hook, claim_throne, abduct; социальные: sway, befriend, seduce, elope, learn_language, convert_to_witchcraft).",
                fr: "complot lancé par {{character1Name}} contre {{character2Name}} (hostiles : murder, fabricate_hook, claim_throne, abduct ; sociaux : sway, befriend, seduce, elope, learn_language, convert_to_witchcraft).",
                es: "complot que {{character1Name}} inicia contra {{character2Name}} (hostiles: murder, fabricate_hook, claim_throne, abduct; sociales: sway, befriend, seduce, elope, learn_language, convert_to_witchcraft).",
                de: "Komplott, das {{character1Name}} gegen {{character2Name}} startet (feindlich: murder, fabricate_hook, claim_throne, abduct; sozial: sway, befriend, seduce, elope, learn_language, convert_to_witchcraft).",
                ja: "{{character1Name}}が{{character2Name}}に対して開始する陰謀（敵対：murder、fabricate_hook、claim_throne、abduct；社交：sway、befriend、seduce、elope、learn_language、convert_to_witchcraft）。",
                ko: "{{character1Name}}가 {{character2Name}}에게 시작하는 음모(적대적: murder, fabricate_hook, claim_throne, abduct; 사회적: sway, befriend, seduce, elope, learn_language, convert_to_witchcraft).",
                pl: "spisek, który {{character1Name}} rozpoczyna przeciw {{character2Name}} (wrogie: murder, fabricate_hook, claim_throne, abduct; towarzyskie: sway, befriend, seduce, elope, learn_language, convert_to_witchcraft).",
                pt: "conspiração que {{character1Name}} inicia contra {{character2Name}} (hostis: murder, fabricate_hook, claim_throne, abduct; sociais: sway, befriend, seduce, elope, learn_language, convert_to_witchcraft).",
                tr: "{{character1Name}}'in {{character2Name}}'e karşı başlattığı komplo (düşmanca: murder, fabricate_hook, claim_throne, abduct; sosyal: sway, befriend, seduce, elope, learn_language, convert_to_witchcraft)."
            },
        }
    ],
    description: {
        en: `Executed when a character begins scheming against another. The source (character1) is the one STARTING the scheme. The target (character2) is the one the scheme is directed at.`,
        zh: `当一个角色开始对另一个角色搞阴谋时执行。`,
        ru: `Выполняется, когда один персонаж начинает плести интриги против другого.`,
        fr: `Exécuté lorsqu'un personnage commence à comploter contre un autre.`,
        es: `Ejecutado cuando un personaje empieza a conspirar contra otro.`,
        de: `Wird ausgeführt, wenn ein Charakter beginnt, gegen einen anderen zu intrigieren.`,
        ja: `あるキャラクターが別のキャラクターに対して陰謀を開始したときに実行されます。`,
        ko: `한 캐릭터가 다른 캐릭터에 대해 음모를 시작할 때 실행됩니다.`,
        pl: `Wykonywane, gdy jedna postać zaczyna intrygować przeciw drugiej.`,
        pt: `Executado quando um personagem começa a conspirar contra outro.`,
        tr: `Bir karakter başkasına karşı komplo kurmaya başladığında çalıştırılır.`
    },

    /**
     * @param {GameData} gameData 
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) => {
        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);
        return !!source && !!target && sourceId !== targetId;
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
            return { success: false, message: "A character cannot scheme against themselves." };
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
        const schemeType = args && args[0] ? String(args[0]).trim() : "sway";
        runGameEffect(`
            global_var:votcce_action_source = {
                start_scheme = {
                    type = ${schemeType}
                    target_character = global_var:votcce_action_target
                }
            }`);
    },

    chatMessage: (args) => {
        const schemeType = args[0];
        const isSocial = ["sway", "befriend", "seduce", "elope", "learn_language", "convert_to_witchcraft"].includes(schemeType);
        if (isSocial) {
            return {
                en: `{{character1Name}} began a ${schemeType} scheme involving {{character2Name}}.`,
                zh: `{{character1Name}}开始了一项涉及{{character2Name}}的${schemeType}计划。`,
                ru: `{{character1Name}} начал(а) план «${schemeType}», затрагивающий {{character2Name}}.`,
                fr: `{{character1Name}} a commencé un projet de « ${schemeType} » impliquant {{character2Name}}.`,
                es: `{{character1Name}} comenzó un plan de ${schemeType} que involucra a {{character2Name}}.`,
                de: `{{character1Name}} hat ein ${schemeType}-Vorhaben begonnen, das {{character2Name}} einschließt.`,
                ja: `{{character1Name}}は{{character2Name}}を巻き込んだ${schemeType}計画を始めました。`,
                ko: `{{character1Name}}이(가) {{character2Name}}를 포함한 ${schemeType} 계획을 시작했습니다.`,
                pl: `{{character1Name}} rozpoczął(ęła) plan „${schemeType}”, obejmujący {{character2Name}}.`,
                pt: `{{character1Name}} começou um plano de ${schemeType} envolvendo {{character2Name}}.`,
                tr: `{{character1Name}}, {{character2Name}}'i içeren bir ${schemeType} planı başlattı.`
            };
        }
        return {
            en: `{{character1Name}} started plotting against {{character2Name}} (${schemeType}).`,
            zh: `{{character1Name}}开始针对{{character2Name}}策划阴谋（${schemeType}）。`,
            ru: `{{character1Name}} начал(а) плести заговор против {{character2Name}} (${schemeType}).`,
            fr: `{{character1Name}} a commencé à comploter contre {{character2Name}} (${schemeType}).`,
            es: `{{character1Name}} empezó a conspirar contra {{character2Name}} (${schemeType}).`,
            de: `{{character1Name}} hat begonnen, gegen {{character2Name}} zu intrigieren (${schemeType}).`,
            ja: `{{character1Name}}は{{character2Name}}に対する陰謀を開始しました（${schemeType}）。`,
            ko: `{{character1Name}}이(가) {{character2Name}}에 대한 음모를 시작했습니다 (${schemeType}).`,
            pl: `{{character1Name}} zaczął(ęła) intrygować przeciw {{character2Name}} (${schemeType}).`,
            pt: `{{character1Name}} começou a conspirar contra {{character2Name}} (${schemeType}).`,
            tr: `{{character1Name}}, {{character2Name}}'e karşı komplo kurmaya başladı (${schemeType}).`
        };
    },

    chatMessageClass: "negative-action-message",
    canPerformAtDistance: false
};