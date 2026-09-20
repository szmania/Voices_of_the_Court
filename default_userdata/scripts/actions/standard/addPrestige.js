//Made by: VOTC-CE

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

const PRESTIGE_VALUES = {
    honor_minor: "minor_prestige_gain",
    honor_major: "major_prestige_gain",
    humiliate_minor: "minor_prestige_loss",
    humiliate_major: "major_prestige_loss"
};

module.exports = {
    signature: "addPrestige",
    args: [
        {
            name: "magnitude",
            type: "enum",
            options: [
                { value: 'honor_minor', display: { en: 'Honor (Minor)', zh: '荣耀（轻微）', ru: 'Почёт (слабо)', fr: 'Honorer (mineur)', es: 'Honrar (menor)', de: 'Ehren (gering)', ja: '称える（軽度）', ko: '명예 (약함)', pl: 'Uhonorować (lekko)', pt: 'Honrar (menor)', tr: 'Onurlandır (Hafif)' }},
                { value: 'honor_major', display: { en: 'Honor (Major)', zh: '荣耀（强烈）', ru: 'Почёт (сильно)', fr: 'Honorer (majeur)', es: 'Honrar (mayor)', de: 'Ehren (stark)', ja: '称える（重度）', ko: '명예 (강함)', pl: 'Uhonorować (mocno)', pt: 'Honrar (maior)', tr: 'Onurlandır (Büyük)' }},
                { value: 'humiliate_minor', display: { en: 'Humiliate (Minor)', zh: '羞辱（轻微）', ru: 'Унизить (слабо)', fr: 'Humilier (mineur)', es: 'Humillar (menor)', de: 'Demütigen (gering)', ja: '辱める（軽度）', ko: '모욕 (약함)', pl: 'Upokorzyć (lekko)', pt: 'Humilhar (menor)', tr: 'Aşağıla (Hafif)' }},
                { value: 'humiliate_major', display: { en: 'Humiliate (Major)', zh: '羞辱（强烈）', ru: 'Унизить (сильно)', fr: 'Humilier (majeur)', es: 'Humillar (mayor)', de: 'Demütigen (stark)', ja: '辱める（重度）', ko: '모욕 (강함)', pl: 'Upokorzyć (mocno)', pt: 'Humilhar (maior)', tr: 'Aşağıla (Büyük)' }}
            ],
            desc: {
                en: "magnitude of prestige change {{character1Name}} causes in {{character2Name}} (honor increases prestige, humiliate reduces it).",
                zh: "{{character1Name}}对{{character2Name}}造成的威望变化幅度（荣耀增加威望，羞辱减少威望）。",
                ru: "величина изменения престижа, которое {{character1Name}} вызывает у {{character2Name}} (почёт повышает, унижение снижает).",
                fr: "ampleur du changement de prestige que {{character1Name}} provoque chez {{character2Name}} (honorer augmente, humilier réduit).",
                es: "magnitud del cambio de prestigio que {{character1Name}} causa en {{character2Name}} (honrar aumenta, humillar reduce).",
                de: "Ausmaß der Prestigeänderung, die {{character1Name}} bei {{character2Name}} verursacht (ehren erhöht, demütigen senkt).",
                ja: "{{character1Name}}が{{character2Name}}に引き起こす威信の変化の大きさ（称えるは増加、辱めるは減少）。",
                ko: "{{character1Name}}가 {{character2Name}}에게 일으키는 위신 변화의 크기(명예는 증가, 모욕은 감소).",
                pl: "wielkość zmiany prestiżu, jaką {{character1Name}} wywołuje u {{character2Name}} (uhonorowanie zwiększa, upokorzenie zmniejsza).",
                pt: "magnitude da mudança de prestígio que {{character1Name}} causa em {{character2Name}} (honrar aumenta, humilhar reduz).",
                tr: "{{character1Name}}'in {{character2Name}}'de neden olduğu prestij değişiminin büyüklüğü (onurlandır artırır, aşağıla azaltır)."
            },
        }
    ],
    description: {
        en: `Executed when a character publicly honors or humiliates another. The source (character1) is the one CAUSING the prestige change. The target (character2) is the one whose prestige changes.`,
        zh: `当一个角色公开荣耀或羞辱另一个角色时执行。`,
        ru: `Выполняется, когда один персонаж публично почитает или унижает другого.`,
        fr: `Exécuté lorsqu'un personnage honore ou humilie publiquement un autre.`,
        es: `Ejecutado cuando un personaje honra o humilla públicamente a otro.`,
        de: `Wird ausgeführt, wenn ein Charakter einen anderen öffentlich ehrt oder demütigt.`,
        ja: `あるキャラクターが別のキャラクターを公に称えたり辱めたりしたときに実行されます。`,
        ko: `한 캐릭터가 다른 캐릭터를 공개적으로 명예롭게 하거나 모욕할 때 실행됩니다.`,
        pl: `Wykonywane, gdy jedna postać publicznie honoruje lub upokarza inną.`,
        pt: `Executado quando um personagem honra ou humilha publicamente outro.`,
        tr: `Bir karakter başka birini alenen onurlandırdığında veya aşağıladığında çalıştırılır.`
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
            return { success: false, message: "A character cannot change their own prestige through this action." };
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
        const magnitude = args && args[0] ? String(args[0]).trim() : "honor_minor";
        const prestigeValue = PRESTIGE_VALUES[magnitude] || "minor_prestige_gain";
        runGameEffect(`
            global_var:votcce_action_target = {
                add_prestige = ${prestigeValue}
            }`);
    },

    chatMessage: (args) => {
        const magnitude = args[0];
        const isHumiliate = magnitude && magnitude.startsWith("humiliate");
        if (isHumiliate) {
            return {
                en: `{{character1Name}} humiliated {{character2Name}}, costing them prestige.`,
                zh: `{{character1Name}}羞辱了{{character2Name}}，使其威望受损。`,
                ru: `{{character1Name}} унизил(а) {{character2Name}}, лишив их престижа.`,
                fr: `{{character1Name}} a humilié {{character2Name}}, leur coûtant du prestige.`,
                es: `{{character1Name}} humilló a {{character2Name}}, costándoles prestigio.`,
                de: `{{character1Name}} hat {{character2Name}} gedemütigt und ihnen Prestige gekostet.`,
                ja: `{{character1Name}}は{{character2Name}}を辱め、威信を失わせました。`,
                ko: `{{character1Name}}가 {{character2Name}}를 모욕하여 위신을 잃게 했습니다.`,
                pl: `{{character1Name}} upokorzył(a) {{character2Name}}, kosztując ich prestiż.`,
                pt: `{{character1Name}} humilhou {{character2Name}}, custando-lhes prestígio.`,
                tr: `{{character1Name}}, {{character2Name}}'yi aşağılayarak prestij kaybettirdi.`
            };
        }
        return {
            en: `{{character1Name}} honored {{character2Name}}, raising their prestige.`,
            zh: `{{character1Name}}荣耀了{{character2Name}}，提升了其威望。`,
            ru: `{{character1Name}} почтил(а) {{character2Name}}, повысив их престиж.`,
            fr: `{{character1Name}} a honoré {{character2Name}}, élevant leur prestige.`,
            es: `{{character1Name}} honró a {{character2Name}}, elevando su prestigio.`,
            de: `{{character1Name}} hat {{character2Name}} geehrt und ihr Prestige erhöht.`,
            ja: `{{character1Name}}は{{character2Name}}を称え、威信を高めました。`,
            ko: `{{character1Name}}가 {{character2Name}}를 명예롭게 하여 위신을 높였습니다.`,
            pl: `{{character1Name}} uhonorował(a) {{character2Name}}, podnosząc ich prestiż.`,
            pt: `{{character1Name}} honrou {{character2Name}}, elevando seu prestígio.`,
            tr: `{{character1Name}}, {{character2Name}}'yi onurlandırarak prestijini yükseltti.`
        };
    },

    chatMessageClass: "neutral-action-message",
    canPerformAtDistance: true
};