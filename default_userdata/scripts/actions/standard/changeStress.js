//Made by: VOTC-CE

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

const STRESS_VALUES = {
    soothe_minor: "minor_stress_impact_loss",
    soothe_major: "major_stress_impact_loss",
    rattle_minor: "minor_stress_impact_gain",
    rattle_major: "major_stress_impact_gain"
};

module.exports = {
    signature: "changeStress",
    args: [
        {
            name: "intensity",
            type: "enum",
            options: [
                { value: 'soothe_minor', display: { en: 'Soothe (Minor)', zh: '安抚（轻微）', ru: 'Успокоить (слабо)', fr: 'Apaiser (mineur)', es: 'Calmar (menor)', de: 'Beruhigen (gering)', ja: 'なだめる（軽度）', ko: '진정 (약함)', pl: 'Ukoić (lekko)', pt: 'Acalmar (menor)', tr: 'Sakinleştir (Hafif)' }},
                { value: 'soothe_major', display: { en: 'Soothe (Major)', zh: '安抚（强烈）', ru: 'Успокоить (сильно)', fr: 'Apaiser (majeur)', es: 'Calmar (mayor)', de: 'Beruhigen (stark)', ja: 'なだめる（重度）', ko: '진정 (강함)', pl: 'Ukoić (mocno)', pt: 'Acalmar (maior)', tr: 'Sakinleştir (Büyük)' }},
                { value: 'rattle_minor', display: { en: 'Rattle (Minor)', zh: '惊扰（轻微）', ru: 'Взволновать (слабо)', fr: 'Ébranler (mineur)', es: 'Perturbar (menor)', de: 'Verunsichern (gering)', ja: '動揺させる（軽度）', ko: '동요 (약함)', pl: 'Zaniepokoić (lekko)', pt: 'Abalar (menor)', tr: 'Sars (Hafif)' }},
                { value: 'rattle_major', display: { en: 'Rattle (Major)', zh: '惊扰（强烈）', ru: 'Взволновать (сильно)', fr: 'Ébranler (majeur)', es: 'Perturbar (mayor)', de: 'Verunsichern (stark)', ja: '動揺させる（重度）', ko: '동요 (강함)', pl: 'Zaniepokoić (mocno)', pt: 'Abalar (maior)', tr: 'Sars (Büyük)' }}
            ],
            desc: {
                en: "intensity of stress change {{character1Name}} causes in {{character2Name}} (soothe reduces, rattle increases).",
                zh: "{{character1Name}}对{{character2Name}}造成的压力变化强度（安抚减少，惊扰增加）。",
                ru: "интенсивность изменения стресса, которое {{character1Name}} вызывает у {{character2Name}} (успокоение снижает, волнение повышает).",
                fr: "intensité du changement de stress que {{character1Name}} provoque chez {{character2Name}} (apaiser réduit, ébranler augmente).",
                es: "intensidad del cambio de estrés que {{character1Name}} causa en {{character2Name}} (calmar reduce, perturbar aumenta).",
                de: "Intensität der Stressänderung, die {{character1Name}} bei {{character2Name}} verursacht (beruhigen senkt, verunsichern erhöht).",
                ja: "{{character1Name}}が{{character2Name}}に引き起こすストレス変化の強度（なだめるは減少、動揺させるは増加）。",
                ko: "{{character1Name}}가 {{character2Name}}에게 일으키는 스트레스 변화 강도(진정은 감소, 동요는 증가).",
                pl: "intensywność zmiany stresu, jaką {{character1Name}} wywołuje u {{character2Name}} (ukojenie zmniejsza, zaniepokojenie zwiększa).",
                pt: "intensidade da mudança de estresse que {{character1Name}} causa em {{character2Name}} (acalmar reduz, abalar aumenta).",
                tr: "{{character1Name}}'in {{character2Name}}'de neden olduğu stres değişiminin yoğunluğu (sakinleştir azaltır, sars artırır)."
            },
        }
    ],
    description: {
        en: `Executed when a character soothes or rattles another. The source (character1) is the one CAUSING the stress change. The target (character2) is the one whose stress changes.`,
        zh: `当一个角色安抚或惊扰另一个角色时执行。`,
        ru: `Выполняется, когда один персонаж успокаивает или взволновывает другого.`,
        fr: `Exécuté lorsqu'un personnage apaise ou ébranle un autre.`,
        es: `Ejecutado cuando un personaje calma o perturba a otro.`,
        de: `Wird ausgeführt, wenn ein Charakter einen anderen beruhigt oder verunsichert.`,
        ja: `あるキャラクターが別のキャラクターをなだめたり動揺させたりしたときに実行されます。`,
        ko: `한 캐릭터가 다른 캐릭터를 진정시키거나 동요시킬 때 실행됩니다.`,
        pl: `Wykonywane, gdy jedna postać uspokaja lub niepokoi inną.`,
        pt: `Executado quando um personagem acalma ou abala outro.`,
        tr: `Bir karakter başka birini sakinleştirdiğinde veya sarstığında çalıştırılır.`
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
            return { success: false, message: "A character cannot change their own stress through this action." };
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
        const intensity = args && args[0] ? String(args[0]).trim() : "soothe_minor";
        const stressValue = STRESS_VALUES[intensity] || "minor_stress_impact_loss";
        runGameEffect(`
            global_var:votcce_action_target = {
                add_stress = ${stressValue}
            }`);
    },

    chatMessage: (args) => {
        const intensity = args[0];
        const isRattle = intensity && intensity.startsWith("rattle");
        if (isRattle) {
            return {
                en: `{{character1Name}} rattled {{character2Name}}, unsettling them.`,
                zh: `{{character1Name}}惊扰了{{character2Name}}，使其心神不宁。`,
                ru: `{{character1Name}} взволновал(а) {{character2Name}}, выведя их из равновесия.`,
                fr: `{{character1Name}} a ébranlé {{character2Name}}, les déstabilisant.`,
                es: `{{character1Name}} perturbó a {{character2Name}}, inquietándolos.`,
                de: `{{character1Name}} hat {{character2Name}} verunsichert und aus der Fassung gebracht.`,
                ja: `{{character1Name}}は{{character2Name}}を動揺させ、不安にさせました。`,
                ko: `{{character1Name}}가 {{character2Name}}를 동요시켜 불안하게 만들었습니다.`,
                pl: `{{character1Name}} zaniepokoił(a) {{character2Name}}, wyprowadzając ich z równowagi.`,
                pt: `{{character1Name}} abalou {{character2Name}}, deixando-os inquietos.`,
                tr: `{{character1Name}}, {{character2Name}}'yi sarstı ve onları tedirgin etti.`
            };
        }
        return {
            en: `{{character1Name}} soothed {{character2Name}}, easing their stress.`,
            zh: `{{character1Name}}安抚了{{character2Name}}，缓解了他们的压力。`,
            ru: `{{character1Name}} успокоил(а) {{character2Name}}, облегчив их стресс.`,
            fr: `{{character1Name}} a apaisé {{character2Name}}, soulageant leur stress.`,
            es: `{{character1Name}} calmó a {{character2Name}}, aliviando su estrés.`,
            de: `{{character1Name}} hat {{character2Name}} beruhigt und ihren Stress gelindert.`,
            ja: `{{character1Name}}は{{character2Name}}をなだめ、ストレスを和らげました。`,
            ko: `{{character1Name}}가 {{character2Name}}를 진정시켜 스트레스를 완화했습니다.`,
            pl: `{{character1Name}} ukoił(a) {{character2Name}}, łagodząc ich stres.`,
            pt: `{{character1Name}} acalmou {{character2Name}}, aliviando seu estresse.`,
            tr: `{{character1Name}}, {{character2Name}}'yi sakinleştirdi ve stresini hafifletti.`
        };
    },

    chatMessageClass: "neutral-action-message",
    canPerformAtDistance: true
};