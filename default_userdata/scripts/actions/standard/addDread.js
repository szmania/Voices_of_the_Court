//Made by: VOTC-CE

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

const DREAD_VALUES = {
    intimidate_minor: "minor_dread_gain",
    intimidate_major: "major_dread_gain",
    reassure_minor: "minor_dread_loss",
    reassure_major: "major_dread_loss"
};

module.exports = {
    signature: "addDread",
    args: [
        {
            name: "intensity",
            type: "enum",
            options: [
                { value: 'intimidate_minor', display: { en: 'Intimidate (Minor)', zh: '威慑（轻微）', ru: 'Запугать (слабо)', fr: 'Intimider (mineur)', es: 'Intimidar (menor)', de: 'Einschüchtern (gering)', ja: '威圧する（軽度）', ko: '위협 (약함)', pl: 'Zastraszyć (lekko)', pt: 'Intimidar (menor)', tr: 'Gözdağı Ver (Hafif)' }},
                { value: 'intimidate_major', display: { en: 'Intimidate (Major)', zh: '威慑（强烈）', ru: 'Запугать (сильно)', fr: 'Intimider (majeur)', es: 'Intimidar (mayor)', de: 'Einschüchtern (stark)', ja: '威圧する（重度）', ko: '위협 (강함)', pl: 'Zastraszyć (mocno)', pt: 'Intimidar (maior)', tr: 'Gözdağı Ver (Büyük)' }},
                { value: 'reassure_minor', display: { en: 'Reassure (Minor)', zh: '安抚（轻微）', ru: 'Успокоить (слабо)', fr: 'Rassurer (mineur)', es: 'Tranquilizar (menor)', de: 'Beruhigen (gering)', ja: '安心させる（軽度）', ko: '안심 (약함)', pl: 'Uspokoić (lekko)', pt: 'Tranquilizar (menor)', tr: 'Güven Ver (Hafif)' }},
                { value: 'reassure_major', display: { en: 'Reassure (Major)', zh: '安抚（强烈）', ru: 'Успокоить (сильно)', fr: 'Rassurer (majeur)', es: 'Tranquilizar (mayor)', de: 'Beruhigen (stark)', ja: '安心させる（重度）', ko: '안심 (강함)', pl: 'Uspokoić (mocno)', pt: 'Tranquilizar (maior)', tr: 'Güven Ver (Büyük)' }}
            ],
            desc: {
                en: "intensity of dread change {{character1Name}} causes in themselves (intimidate increases dread, reassure reduces it).",
                zh: "{{character1Name}}自身造成的恐惧变化强度（威慑增加恐惧，安抚减少恐惧）。",
                ru: "интенсивность изменения устрашения, которое {{character1Name}} вызывает у себя (запугивание повышает, успокоение снижает).",
                fr: "intensité du changement de crainte que {{character1Name}} provoque chez lui-même (intimider augmente, rassurer réduit).",
                es: "intensidad del cambio de temor que {{character1Name}} causa en sí mismo (intimidar aumenta, tranquilizar reduce).",
                de: "Intensität der Furchtänderung, die {{character1Name}} bei sich selbst verursacht (einschüchtern erhöht, beruhigen senkt).",
                ja: "{{character1Name}}が自分自身に引き起こす畏怖の変化の強度（威圧は増加、安心は減少）。",
                ko: "{{character1Name}}가 자신에게 일으키는 위압감 변화 강도(위협은 증가, 안심은 감소).",
                pl: "intensywność zmiany postrachu, jaką {{character1Name}} wywołuje u siebie (zastraszenie zwiększa, uspokojenie zmniejsza).",
                pt: "intensidade da mudança de temor que {{character1Name}} causa em si mesmo (intimidar aumenta, tranquilizar reduz).",
                tr: "{{character1Name}}'in kendisinde neden olduğu korku değişiminin yoğunluğu (gözdağı artırır, güven azaltır)."
            },
        }
    ],
    description: {
        en: `Executed when a character intimidates or reassures another. The source (character1) is the one whose DREAD changes. The target (character2) is the one being intimidated or reassured.`,
        zh: `当一个角色威慑或安抚另一个角色时执行。`,
        ru: `Выполняется, когда один персонаж запугивает или успокаивает другого.`,
        fr: `Exécuté lorsqu'un personnage intimide ou rassure un autre.`,
        es: `Ejecutado cuando un personaje intimida o tranquiliza a otro.`,
        de: `Wird ausgeführt, wenn ein Charakter einen anderen einschüchtert oder beruhigt.`,
        ja: `あるキャラクターが別のキャラクターを威圧したり安心させたりしたときに実行されます。`,
        ko: `한 캐릭터가 다른 캐릭터를 위협하거나 안심시킬 때 실행됩니다.`,
        pl: `Wykonywane, gdy jedna postać zastrasza lub uspokaja inną.`,
        pt: `Executado quando um personagem intimida ou tranquiliza outro.`,
        tr: `Bir karakter başka birini gözdağı verdiğinde veya güven verdiğinde çalıştırılır.`
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
            return { success: false, message: "A character cannot intimidate or reassure themselves through this action." };
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
        const intensity = args && args[0] ? String(args[0]).trim() : "intimidate_minor";
        const dreadValue = DREAD_VALUES[intensity] || "minor_dread_gain";
        runGameEffect(`
            global_var:votcce_action_source = {
                add_dread = ${dreadValue}
            }`);
    },

    chatMessage: (args) => {
        const intensity = args[0];
        const isIntimidate = intensity && intensity.startsWith("intimidate");
        if (isIntimidate) {
            return {
                en: `{{character1Name}} intimidated {{character2Name}}, gaining dread.`,
                zh: `{{character1Name}}威慑了{{character2Name}}，获得了恐惧。`,
                ru: `{{character1Name}} запугал(а) {{character2Name}}, обретя устрашение.`,
                fr: `{{character1Name}} a intimidé {{character2Name}}, gagnant en crainte.`,
                es: `{{character1Name}} intimidó a {{character2Name}}, ganando temor.`,
                de: `{{character1Name}} hat {{character2Name}} eingeschüchtert und Furcht gewonnen.`,
                ja: `{{character1Name}}は{{character2Name}}を威圧し、畏怖を得ました。`,
                ko: `{{character1Name}}가 {{character2Name}}를 위협하여 위압감을 얻었습니다.`,
                pl: `{{character1Name}} zastraszył(a) {{character2Name}}, zyskując postrach.`,
                pt: `{{character1Name}} intimidou {{character2Name}}, ganhando temor.`,
                tr: `{{character1Name}}, {{character2Name}}'yi gözdağı vererek korku kazandı.`
            };
        }
        return {
            en: `{{character1Name}} reassured {{character2Name}}, easing their dread.`,
            zh: `{{character1Name}}安抚了{{character2Name}}，缓解了恐惧。`,
            ru: `{{character1Name}} успокоил(а) {{character2Name}}, ослабив устрашение.`,
            fr: `{{character1Name}} a rassuré {{character2Name}}, apaisant leur crainte.`,
            es: `{{character1Name}} tranquilizó a {{character2Name}}, aliviando su temor.`,
            de: `{{character1Name}} hat {{character2Name}} beruhigt und ihre Furcht gemildert.`,
            ja: `{{character1Name}}は{{character2Name}}を安心させ、畏怖を和らげました。`,
            ko: `{{character1Name}}가 {{character2Name}}를 안심시켜 위압감을 완화했습니다.`,
            pl: `{{character1Name}} uspokoił(a) {{character2Name}}, łagodząc ich postrach.`,
            pt: `{{character1Name}} tranquilizou {{character2Name}}, aliviando seu temor.`,
            tr: `{{character1Name}}, {{character2Name}}'yi güven vererek korkusunu hafifletti.`
        };
    },

    chatMessageClass: "negative-action-message",
    canPerformAtDistance: false
};