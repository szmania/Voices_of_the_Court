//Made by: VOTC-CE

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

const PIETY_VALUES = {
    bless_minor: "minor_piety_gain",
    bless_major: "major_piety_gain",
    shame_minor: "minor_piety_loss",
    shame_major: "major_piety_loss"
};

module.exports = {
    signature: "addPiety",
    args: [
        {
            name: "intensity",
            type: "enum",
            options: [
                { value: 'bless_minor', display: { en: 'Bless (Minor)', zh: '祝福（轻微）', ru: 'Благословить (слабо)', fr: 'Bénir (mineur)', es: 'Bendecir (menor)', de: 'Segnen (gering)', ja: '祝福する（軽度）', ko: '축복 (약함)', pl: 'Błogosławić (lekko)', pt: 'Abençoar (menor)', tr: 'Kutsamak (Hafif)' }},
                { value: 'bless_major', display: { en: 'Bless (Major)', zh: '祝福（强烈）', ru: 'Благословить (сильно)', fr: 'Bénir (majeur)', es: 'Bendecir (mayor)', de: 'Segnen (stark)', ja: '祝福する（重度）', ko: '축복 (강함)', pl: 'Błogosławić (mocno)', pt: 'Abençoar (maior)', tr: 'Kutsamak (Büyük)' }},
                { value: 'shame_minor', display: { en: 'Shame (Minor)', zh: '羞辱（轻微）', ru: 'Пристыдить (слабо)', fr: 'Honter (mineur)', es: 'Avergonzar (menor)', de: 'Beschämen (gering)', ja: '恥をかかせる（軽度）', ko: '치욕 (약함)', pl: 'Zawstydzić (lekko)', pt: 'Envergonhar (menor)', tr: 'Utandırmak (Hafif)' }},
                { value: 'shame_major', display: { en: 'Shame (Major)', zh: '羞辱（强烈）', ru: 'Пристыдить (сильно)', fr: 'Honter (majeur)', es: 'Avergonzar (mayor)', de: 'Beschämen (stark)', ja: '恥をかかせる（重度）', ko: '치욕 (강함)', pl: 'Zawstydzić (mocno)', pt: 'Envergonhar (maior)', tr: 'Utandırmak (Büyük)' }}
            ],
            desc: {
                en: "magnitude of piety change {{character1Name}} causes in {{character2Name}} (bless grants piety, shame takes it away).",
                zh: "{{character1Name}}对{{character2Name}}造成的虔诚变化幅度（祝福增加，羞辱减少）。",
                ru: "величина изменения благочестия, которое {{character1Name}} вызывает у {{character2Name}} (благословение даёт, унижение отнимает).",
                fr: "ampleur du changement de piété que {{character1Name}} provoque chez {{character2Name}} (bénir accorde, honter retire).",
                es: "magnitud del cambio de piedad que {{character1Name}} causa en {{character2Name}} (bendecir concede, avergonzar quita).",
                de: "Größe der Frömmigkeitsänderung, die {{character1Name}} bei {{character2Name}} verursacht (segnen gewährt, beschämen nimmt).",
                ja: "{{character1Name}}が{{character2Name}}に引き起こす敬虔さの変化量（祝福は与え、恥は奪う）。",
                ko: "{{character1Name}}가 {{character2Name}}에게 일으키는 경건함 변화 크기(축복은 부여, 치욕은 박탈).",
                pl: "wielkość zmiany pobożności, którą {{character1Name}} wywołuje u {{character2Name}} (błogosławieństwo przyznaje, zaszczyt zabiera).",
                pt: "magnitude da mudança de piedade que {{character1Name}} causa em {{character2Name}} (abençoar concede, envergonhar retira).",
                tr: "{{character1Name}}'in {{character2Name}}'de neden olduğu dindarlık değişiminin büyüklüğü (kutsamak verir, utandırmak alır)."
            },
        }
    ],
    description: {
        en: `Executed when a character blesses or shames another's soul. The source (character1) is the one CAUSING the piety change. The target (character2) is the one whose piety changes.`,
        zh: `当一个角色祝福或羞辱另一个角色的灵魂时执行。`,
        ru: `Выполняется, когда один персонаж благословляет или низводит душу другого.`,
        fr: `Exécuté lorsqu'un personnage bénit ou honte l'âme d'un autre.`,
        es: `Ejecutado cuando un personaje bendice o avergüenza el alma de otro.`,
        de: `Wird ausgeführt, wenn ein Charakter die Seele eines anderen segnet oder beschämt.`,
        ja: `あるキャラクターが別のキャラクターの魂を祝福または屈辱したときに実行されます。`,
        ko: `한 캐릭터가 다른 캐릭터의 영혼을 축복하거나 치욕할 때 실행됩니다.`,
        pl: `Wykonywane, gdy jedna postać błogosławi lub zawstydza duszę drugiej.`,
        pt: `Executado quando um personagem abençoa ou envergonha a alma de outro.`,
        tr: `Bir karakter başkasının ruhunu kutsadığında veya küçük düşürdüğünde çalıştırılır.`
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
            return { success: false, message: "A character cannot change their own piety through this action." };
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
        const intensity = args && args[0] ? String(args[0]).trim() : "bless_minor";
        const pietyValue = PIETY_VALUES[intensity] || "minor_piety_gain";
        runGameEffect(`
            global_var:votcce_action_target = {
                add_piety = ${pietyValue}
            }`);
    },

    chatMessage: (args) => {
        const intensity = args[0];
        const isShame = intensity && intensity.startsWith("shame");
        if (isShame) {
            return {
                en: `{{character1Name}} shamed {{character2Name}}, costing them piety.`,
                zh: `{{character1Name}}羞辱了{{character2Name}}，使其虔诚受损。`,
                ru: `{{character1Name}} унизил(а) {{character2Name}}, лишив их благочестия.`,
                fr: `{{character1Name}} a honté {{character2Name}}, leur coûtant de la piété.`,
                es: `{{character1Name}} avergonzó a {{character2Name}}, costándoles piedad.`,
                de: `{{character1Name}} hat {{character2Name}} beschämt und sie um Frömmigkeit gebracht.`,
                ja: `{{character1Name}}は{{character2Name}}を恥じ入らせ、敬虔さを奪いました。`,
                ko: `{{character1Name}}가 {{character2Name}}를 치욕하여 경건함을 잃게 했습니다.`,
                pl: `{{character1Name}} zawstydził(a) {{character2Name}}, pozbawiając ich pobożności.`,
                pt: `{{character1Name}} envergonhou {{character2Name}}, custando-lhes piedade.`,
                tr: `{{character1Name}}, {{character2Name}}'i utandırdı ve onlara dindarlık kaybettirdi.`
            };
        }
        return {
            en: `{{character1Name}} blessed {{character2Name}}, granting them piety.`,
            zh: `{{character1Name}}祝福了{{character2Name}}，使其获得虔诚。`,
            ru: `{{character1Name}} благословил(а) {{character2Name}}, одарив их благочестием.`,
            fr: `{{character1Name}} a béni {{character2Name}}, leur accordant de la piété.`,
            es: `{{character1Name}} bendijo a {{character2Name}}, otorgándoles piedad.`,
            de: `{{character1Name}} hat {{character2Name}} gesegnet und ihnen Frömmigkeit verliehen.`,
            ja: `{{character1Name}}は{{character2Name}}を祝福し、敬虔さを与えました。`,
            ko: `{{character1Name}}가 {{character2Name}}를 축복하여 경건함을 부여했습니다.`,
            pl: `{{character1Name}} pobłogosławił(a) {{character2Name}}, obdarowując ich pobożnością.`,
            pt: `{{character1Name}} abençoou {{character2Name}}, concedendo-lhes piedade.`,
            tr: `{{character1Name}}, {{character2Name}}'i kutsadı ve onlara dindarlık bağışladı.`
        };
    },

    chatMessageClass: "neutral-action-message",
    canPerformAtDistance: true
};