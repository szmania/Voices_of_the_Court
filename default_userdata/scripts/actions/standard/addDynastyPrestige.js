//Made by: software_engineer_ck3

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

const DYNASTY_PRESTIGE_VALUES = {
    honor_minor: "minor_dynasty_prestige_gain",
    honor_major: "major_dynasty_prestige_gain",
    humiliate_minor: "minor_dynasty_prestige_loss",
    humiliate_major: "major_dynasty_prestige_loss"
};

module.exports = {
    signature: "addDynastyPrestige",
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
                en: "magnitude of dynasty prestige change for {{character2Name}}'s dynasty by {{character1Name}}.",
                zh: "{{character1Name}}对{{character2Name}}的王朝威望变化幅度。",
                ru: "величина изменения престижа династии {{character2Name}} от {{character1Name}}.",
                fr: "ampleur du changement de prestige de la dynastie de {{character2Name}} par {{character1Name}}.",
                es: "magnitud del cambio de prestigio de la dinastía de {{character2Name}} por {{character1Name}}.",
                de: "Ausmaß der Dynastie-Prestige-Änderung für {{character2Name}}s Dynastie durch {{character1Name}}.",
                ja: "{{character1Name}}による{{character2Name}}の王朝の威信変化の大きさ。",
                ko: "{{character1Name}}에 의한 {{character2Name}} 왕조의 명성 변화 정도.",
                pl: "skala zmiany prestiżu dynastii {{character2Name}} przez {{character1Name}}.",
                pt: "magnitude da mudança de prestígio da dinastia de {{character2Name}} por {{character1Name}}.",
                tr: "{{character1Name}} tarafından {{character2Name}}'nin hanedanının prestij değişiminin büyüklüğü."
            }
        }
    ],
    description: {
        en: `Executed when a character's dynasty gains or loses prestige. The source (character1) is the one INFLUENCING the change. The target (character2) is the one whose DYNASTY is honored or shamed.`,
        zh: `当一个角色的王朝获得或失去威望时执行。源（character1）是施加影响者，目标（character2）是其王朝被荣耀或羞辱者。`,
        ru: `Выполняется, когда династия персонажа получает или теряет престиж. Источник (персонаж 1) влияет на изменение, цель (персонаж 2) — та, чья династия чтится или позорится.`,
        fr: `Exécuté lorsque la dynastie d'un personnage gagne ou perd du prestige. La source (personnage 1) influence le changement, la cible (personnage 2) est celle dont la dynastie est honorée ou humiliée.`,
        es: `Ejecutado cuando la dinastía de un personaje gana o pierde prestigio. El origen (character1) influye en el cambio, el objetivo (character2) es aquel cuya dinastía es honrada o humillada.`,
        de: `Wird ausgeführt, wenn die Dynastie eines Charakters Prestige gewinnt oder verliert. Die Quelle (Charakter 1) beeinflusst die Änderung, das Ziel (Charakter 2) ist derjenige, dessen Dynastie geehrt oder gedemütigt wird.`,
        ja: `キャラクターの王朝が威信を得たり失ったりしたときに実行されます。ソース（キャラクター1）が変化に影響を与え、ターゲット（キャラクター2）の王朝が称えられたり辱められたりします。`,
        ko: `캐릭터의 왕조가 명성을 얻거나 잃을 때 실행됩니다. 소스(캐릭터 1)는 변화에 영향을 주고, 대상(캐릭터 2)은 왕조가 명예롭게 되거나 모욕당하는 쪽입니다.`,
        pl: `Wykonywane, gdy dynastia postaci zyskuje lub traci prestiż. Źródło (postać 1) wpływa na zmianę, cel (postać 2) to ta, której dynastia jest honorowana lub poniżana.`,
        pt: `Executado quando a dinastia de um personagem ganha ou perde prestígio. A fonte (character1) influencia a mudança, o alvo (character2) é aquele cuja dinastia é honrada ou humilhada.`,
        tr: `Bir karakterin hanedanı prestij kazandığında veya kaybettiğinde çalıştırılır. Kaynak (character1) değişimi etkiler, hedef (character2) hanedanı onurlandırılan veya aşağılanan taraftır.`
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
            return { success: false, message: "A character cannot change their own dynasty prestige through this action." };
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

        const magnitude = args && args[0] ? String(args[0]).trim() : "honor_minor";
        const prestigeValue = DYNASTY_PRESTIGE_VALUES[magnitude] || "minor_dynasty_prestige_gain";

        runGameEffect(`
            global_var:votcce_action_target.dynasty = {
                add_dynasty_prestige = ${prestigeValue}
            }`);
    },

    chatMessage: (args) => {
        const magnitude = args[0];
        const isHumiliate = magnitude && magnitude.startsWith("humiliate");
        if (isHumiliate) {
            return {
                en: `{{character1Name}} humiliated {{character2Name}}'s dynasty, costing them prestige.`,
                zh: `{{character1Name}}羞辱了{{character2Name}}的王朝，使其威望受损。`,
                ru: `{{character1Name}} унизил(а) династию {{character2Name}}, лишив её престижа.`,
                fr: `{{character1Name}} a humilié la dynastie de {{character2Name}}, lui coûtant du prestige.`,
                es: `{{character1Name}} humilló a la dinastía de {{character2Name}}, costándole prestigio.`,
                de: `{{character1Name}} hat die Dynastie von {{character2Name}} gedemütigt und ihr Prestige gekostet.`,
                ja: `{{character1Name}}は{{character2Name}}の王朝を辱め、威信を失わせました。`,
                ko: `{{character1Name}}가 {{character2Name}}의 왕조를 모욕하여 명성을 잃게 했습니다.`,
                pl: `{{character1Name}} upokorzył(a) dynastię {{character2Name}}, kosztując ją prestiż.`,
                pt: `{{character1Name}} humilhou a dinastia de {{character2Name}}, custando-lhe prestígio.`,
                tr: `{{character1Name}}, {{character2Name}}'nin hanedanını aşağılayarak prestij kaybettirdi.`
            };
        }
        return {
            en: `{{character1Name}} honored {{character2Name}}'s dynasty, raising its prestige.`,
            zh: `{{character1Name}}荣耀了{{character2Name}}的王朝，提升了其威望。`,
            ru: `{{character1Name}} почтил(а) династию {{character2Name}}, повысив её престиж.`,
            fr: `{{character1Name}} a honoré la dynastie de {{character2Name}}, augmentant son prestige.`,
            es: `{{character1Name}} honró a la dinastía de {{character2Name}}, aumentando su prestigio.`,
            de: `{{character1Name}} hat die Dynastie von {{character2Name}} geehrt und ihr Prestige erhöht.`,
            ja: `{{character1Name}}は{{character2Name}}の王朝を称え、威信を高めました。`,
            ko: `{{character1Name}}가 {{character2Name}}의 왕조를 명예롭게 하여 명성을 높였습니다.`,
            pl: `{{character1Name}} uhonorował(a) dynastię {{character2Name}}, podnosząc jej prestiż.`,
            pt: `{{character1Name}} honrou a dinastia de {{character2Name}}, aumentando seu prestígio.`,
            tr: `{{character1Name}}, {{character2Name}}'nin hanedanını onurlandırarak prestijini artırdı.`
        };
    },
    chatMessageClass: "neutral-action-message"
};