//Made by: VOTC-CE

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "addHook",
    args: [
        {
            name: "hookType",
            type: "enum",
            options: [
                { value: 'favor_hook', display: { en: 'Favor', zh: '人情', ru: 'Услуга', fr: 'Faveur', es: 'Favor', de: 'Gefallen', ja: '恩義', ko: '호의', pl: 'Przysługa', pt: 'Favor', tr: 'İyilik' }},
                { value: 'strong_favor_hook', display: { en: 'Strong Favor', zh: '强大人情', ru: 'Сильная услуга', fr: 'Faveur forte', es: 'Favor fuerte', de: 'Starker Gefallen', ja: '強い恩義', ko: '강한 호의', pl: 'Silna przysługa', pt: 'Favor forte', tr: 'Güçlü İyilik' }},
                { value: 'obligation_hook', display: { en: 'Obligation', zh: '义务', ru: 'Обязательство', fr: 'Obligation', es: 'Obligación', de: 'Verpflichtung', ja: '義務', ko: '의무', pl: 'Zobowiązanie', pt: 'Obrigação', tr: 'Yükümlülük' }},
                { value: 'strong_obligation_hook', display: { en: 'Strong Obligation', zh: '强大约束', ru: 'Сильное обязательство', fr: 'Obligation forte', es: 'Obligación fuerte', de: 'Starke Verpflichtung', ja: '強い義務', ko: '강한 의무', pl: 'Silne zobowiązanie', pt: 'Obrigação forte', tr: 'Güçlü Yükümlülük' }},
                { value: 'indebted_hook', display: { en: 'Indebted', zh: '亏欠', ru: 'В долгу', fr: 'Reconnaissant', es: 'En deuda', de: 'Verschuldet', ja: '借りがある', ko: '빚을 짐', pl: 'Zadłużony', pt: 'Em dívida', tr: 'Borçlu' }},
                { value: 'strong_indebted_hook', display: { en: 'Strongly Indebted', zh: '深深亏欠', ru: 'Сильно в долгу', fr: 'Très reconnaissant', es: 'Muy en deuda', de: 'Stark verschuldet', ja: '深く借りがある', ko: '크게 빚을 짐', pl: 'Mocno zadłużony', pt: 'Muito em dívida', tr: 'Çok Borçlu' }},
                { value: 'loyalty_hook', display: { en: 'Loyalty', zh: '忠诚', ru: 'Верность', fr: 'Loyauté', es: 'Lealtad', de: 'Loyalität', ja: '忠誠', ko: '충성', pl: 'Lojalność', pt: 'Lealdade', tr: 'Sadakat' }},
                { value: 'threat_hook', display: { en: 'Threat', zh: '威胁', ru: 'Угроза', fr: 'Menace', es: 'Amenaza', de: 'Drohung', ja: '脅迫', ko: '위협', pl: 'Groźba', pt: 'Ameaça', tr: 'Tehdit' }},
                { value: 'life_threat_hook', display: { en: 'Life Threat', zh: '生命威胁', ru: 'Угроза жизни', fr: 'Menace de mort', es: 'Amenaza de vida', de: 'Lebensbedrohung', ja: '生命の脅威', ko: '생명 위협', pl: 'Groźba życia', pt: 'Ameaça de vida', tr: 'Hayat Tehdidi' }},
                { value: 'weak_blackmail_hook', display: { en: 'Weak Blackmail', zh: '轻微勒索', ru: 'Слабый шантаж', fr: 'Chantage faible', es: 'Chantaje débil', de: 'Schwache Erpressung', ja: '弱い恐喝', ko: '약한 협박', pl: 'Słaby szantaż', pt: 'Chantagem fraca', tr: 'Zayıf Şantaj' }},
                { value: 'strong_blackmail_hook', display: { en: 'Strong Blackmail', zh: '严重勒索', ru: 'Сильный шантаж', fr: 'Chantage fort', es: 'Chantaje fuerte', de: 'Starke Erpressung', ja: '強い恐喝', ko: '강한 협박', pl: 'Silny szantaż', pt: 'Chantagem forte', tr: 'Güçlü Şantaj' }},
                { value: 'supporter_hook', display: { en: 'Supporter', zh: '支持者', ru: 'Сторонник', fr: 'Partisan', es: 'Partidario', de: 'Unterstützer', ja: '支持者', ko: '지지자', pl: 'Zwolennik', pt: 'Apoiador', tr: 'Destekçi' }}
            ],
            desc: {
                en: "type of hook {{character1Name}} places on {{character2Name}} (Must explicitly mention type).",
                zh: "{{character1Name}}对{{character2Name}}施加的钩子类型（必须明确提及类型）。",
                ru: "тип обязательства, которое {{character1Name}} накладывает на {{character2Name}} (должен явно упоминать тип).",
                fr: "type de faveur que {{character1Name}} place sur {{character2Name}} (doit mentionner explicitement le type).",
                es: "tipo de favor que {{character1Name}} impone a {{character2Name}} (debe mencionar explícitamente el tipo).",
                de: "Art des Gefallens, das {{character1Name}} {{character2Name}} auferlegt (muss den Typ explizit erwähnen).",
                ja: "{{character1Name}}が{{character2Name}}に課す恩義の種類（種類を明示的に言及する必要があります）。",
                ko: "{{character1Name}}가 {{character2Name}}에게 거는 호의 유형(유형을 명시적으로 언급해야 함).",
                pl: "rodzaj przysługi, jaką {{character1Name}} nakłada na {{character2Name}} (musi wyraźnie wspomnieć typ).",
                pt: "tipo de favor que {{character1Name}} impõe a {{character2Name}} (deve mencionar explicitamente o tipo).",
                tr: "{{character1Name}}'in {{character2Name}}'ye yüklediği iyilik türü (türü açıkça belirtmelidir)."
            },
        }
    ],
    description: {
        en: `Executed when a character places a hook on another. The source (character1) is the one GAINING the hook. The target (character2) is the one the hook is placed on.`,
        zh: `当一个角色对另一个角色施加钩子时执行。`,
        ru: `Выполняется, когда один персонаж накладывает обязательство на другого.`,
        fr: `Exécuté lorsqu'un personnage place une faveur sur un autre.`,
        es: `Ejecutado cuando un personaje impone un favor a otro.`,
        de: `Wird ausgeführt, wenn ein Charakter einem anderen ein Gefallen auferlegt.`,
        ja: `あるキャラクターが別のキャラクターに恩義を課したときに実行されます。`,
        ko: `한 캐릭터가 다른 캐릭터에게 호의를 걸 때 실행됩니다.`,
        pl: `Wykonywane, gdy jedna postać nakłada przysługę na inną.`,
        pt: `Executado quando um personagem impõe um favor a outro.`,
        tr: `Bir karakter başka birine iyilik yüklediğinde çalıştırılır.`
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
            return { success: false, message: "A character cannot place a hook on themselves." };
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
        const hookType = args && args[0] ? String(args[0]).trim() : "favor_hook";
        runGameEffect(`
            global_var:votcce_action_source = {
                add_hook = { type = ${hookType} target = global_var:votcce_action_target }
            }`);
    },

    chatMessage: (args) => {
        const hookType = args[0];
        return {
            en: `{{character1Name}} placed a ${hookType} on {{character2Name}}.`,
            zh: `{{character1Name}}对{{character2Name}}施加了${hookType}。`,
            ru: `{{character1Name}} наложил(а) ${hookType} на {{character2Name}}.`,
            fr: `{{character1Name}} a placé un ${hookType} sur {{character2Name}}.`,
            es: `{{character1Name}} impuso un ${hookType} a {{character2Name}}.`,
            de: `{{character1Name}} hat {{character2Name}} ein ${hookType} auferlegt.`,
            ja: `{{character1Name}}は{{character2Name}}に${hookType}を課しました。`,
            ko: `{{character1Name}}가 {{character2Name}}에게 ${hookType}를 걸었습니다.`,
            pl: `{{character1Name}} nałożył(a) ${hookType} na {{character2Name}}.`,
            pt: `{{character1Name}} impôs um ${hookType} a {{character2Name}}.`,
            tr: `{{character1Name}}, {{character2Name}}'ye bir ${hookType} yükledi.`
        };
    },

    chatMessageClass: "neutral-action-message",
    canPerformAtDistance: true
};