//Made by: VOTC-CE

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "addSecret",
    args: [
        {
            name: "secretType",
            type: "enum",
            options: [
                { value: 'secret_deviant', display: { en: 'Deviant', zh: '离经叛道', ru: 'Извращенец', fr: 'Déviant', es: 'Desviado', de: 'Abweichler', ja: '逸脱者', ko: '일탈자', pl: 'Dewiant', pt: 'Desviante', tr: 'Sapkın' }},
                { value: 'secret_cannibal', display: { en: 'Cannibal', zh: '食人者', ru: 'Каннибал', fr: 'Cannibale', es: 'Caníbal', de: 'Kannibale', ja: '人食い', ko: '식인자', pl: 'Kanibal', pt: 'Canibal', tr: 'Yamyam' }},
                { value: 'secret_murder', display: { en: 'Murder', zh: '谋杀', ru: 'Убийство', fr: 'Meurtre', es: 'Asesinato', de: 'Mord', ja: '殺人', ko: '살인', pl: 'Morderstwo', pt: 'Assassinato', tr: 'Cinayet' }},
                { value: 'secret_murder_attempt', display: { en: 'Murder Attempt', zh: '谋杀未遂', ru: 'Покушение на убийство', fr: 'Tentative de meurtre', es: 'Intento de asesinato', de: 'Mordversuch', ja: '殺人未遂', ko: '살인 미수', pl: 'Próba morderstwa', pt: 'Tentativa de assassinato', tr: 'Cinayet Girişimi' }},
                { value: 'secret_lover', display: { en: 'Lover', zh: '情人', ru: 'Любовник', fr: 'Amant', es: 'Amante', de: 'Liebhaber', ja: '恋人', ko: '연인', pl: 'Kochanek', pt: 'Amante', tr: 'Sevgili' }},
                { value: 'secret_incest', display: { en: 'Incest', zh: '乱伦', ru: 'Инцест', fr: 'Inceste', es: 'Incesto', de: 'Inzest', ja: '近親相姦', ko: '근친상간', pl: 'Kazirodztwo', pt: 'Incesto', tr: 'Ensest' }},
                { value: 'secret_witch', display: { en: 'Witch', zh: '女巫', ru: 'Ведьма', fr: 'Sorcière', es: 'Bruja', de: 'Hexe', ja: '魔女', ko: '마녀', pl: 'Czarownica', pt: 'Bruxa', tr: 'Cadı' }},
                { value: 'secret_non_believer', display: { en: 'Non-Believer', zh: '不信者', ru: 'Неверующий', fr: 'Non-croyant', es: 'Incrédule', de: 'Ungläubiger', ja: '不信心者', ko: '불신자', pl: 'Niewierzący', pt: 'Descrente', tr: 'İnançsız' }},
                { value: 'secret_embezzler', display: { en: 'Embezzler', zh: '贪污者', ru: 'Растратчик', fr: 'Détourneur', es: 'Malversador', de: 'Veruntreuer', ja: '横領者', ko: '횡령자', pl: 'Malwersant', pt: 'Desviador', tr: 'Zimmetçi' }},
                { value: 'secret_coup_plotter', display: { en: 'Coup Plotter', zh: '政变策划者', ru: 'Заговорщик переворота', fr: 'Complotiste de coup', es: 'Conspirador de golpe', de: 'Putschplaner', ja: 'クーデター計画者', ko: '쿠데타 모의자', pl: 'Spiskowiec zamachu', pt: 'Conspirador de golpe', tr: 'Darbe Planlayıcı' }}
            ],
            desc: {
                en: "type of secret {{character2Name}} confides to {{character1Name}} (Must explicitly mention type).",
                zh: "{{character2Name}}向{{character1Name}}吐露的秘密类型（必须明确提及类型）。",
                ru: "тип секрета, которым {{character2Name}} делится с {{character1Name}} (должен явно упоминать тип).",
                fr: "type de secret que {{character2Name}} confie à {{character1Name}} (doit mentionner explicitement le type).",
                es: "tipo de secreto que {{character2Name}} confiesa a {{character1Name}} (debe mencionar explícitamente el tipo).",
                de: "Art des Geheimnisses, das {{character2Name}} {{character1Name}} anvertraut (muss den Typ explizit erwähnen).",
                ja: "{{character2Name}}が{{character1Name}}に打ち明ける秘密の種類（種類を明示的に言及する必要があります）。",
                ko: "{{character2Name}}가 {{character1Name}}에게 털어놓는 비밀 유형(유형을 명시적으로 언급해야 함).",
                pl: "rodzaj sekretu, który {{character2Name}} wyznaje {{character1Name}} (musi wyraźnie wspomnieć typ).",
                pt: "tipo de segredo que {{character2Name}} confidencia a {{character1Name}} (deve mencionar explicitamente o tipo).",
                tr: "{{character2Name}}'nin {{character1Name}}'e itiraf ettiği sır türü (türü açıkça belirtmelidir)."
            },
        }
    ],
    description: {
        en: `Executed when a character reveals or bestows a secret upon another. The source (character1) is the one LEARNING the secret. The target (character2) is the one the secret belongs to.`,
        zh: `当一个角色向另一个角色吐露秘密时执行。`,
        ru: `Выполняется, когда один персонаж раскрывает секрет другому.`,
        fr: `Exécuté lorsqu'un personnage révèle un secret à un autre.`,
        es: `Ejecutado cuando un personaje revela un secreto a otro.`,
        de: `Wird ausgeführt, wenn ein Charakter einem anderen ein Geheimnis offenbart.`,
        ja: `あるキャラクターが別のキャラクターに秘密を打ち明けたときに実行されます。`,
        ko: `한 캐릭터가 다른 캐릭터에게 비밀을 털어놓을 때 실행됩니다.`,
        pl: `Wykonywane, gdy jedna postać wyjawia sekret innej.`,
        pt: `Executado quando um personagem revela um segredo a outro.`,
        tr: `Bir karakter başka birine bir sır ifşa ettiğinde çalıştırılır.`
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
            return { success: false, message: "A character cannot reveal a secret about themselves." };
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
        const secretType = args && args[0] ? String(args[0]).trim() : "secret_lover";
        runGameEffect(`
            global_var:votcce_action_target = {
                add_secret = { type = ${secretType} target = global_var:votcce_action_target }
            }`);
    },

    chatMessage: (args) => {
        const secretType = args[0];
        return {
            en: `{{character2Name}} revealed a ${secretType} to {{character1Name}}.`,
            zh: `{{character2Name}}向{{character1Name}}吐露了${secretType}。`,
            ru: `{{character2Name}} раскрыл(а) ${secretType} {{character1Name}}.`,
            fr: `{{character2Name}} a révélé un ${secretType} à {{character1Name}}.`,
            es: `{{character2Name}} reveló un ${secretType} a {{character1Name}}.`,
            de: `{{character2Name}} hat {{character1Name}} ein ${secretType} offenbart.`,
            ja: `{{character2Name}}は{{character1Name}}に${secretType}を打ち明けました。`,
            ko: `{{character2Name}}가 {{character1Name}}에게 ${secretType}를 털어놓았습니다.`,
            pl: `{{character2Name}} wyjawił(a) ${secretType} {{character1Name}}.`,
            pt: `{{character2Name}} revelou um ${secretType} a {{character1Name}}.`,
            tr: `{{character2Name}}, {{character1Name}}'e bir ${secretType} ifşa etti.`
        };
    },

    chatMessageClass: "negative-action-message",
    canPerformAtDistance: true
};