//Made by: VOTC-CE

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

module.exports = {
    signature: "addTraitXp",
    args: [
        {
            name: "trait",
            type: "enum",
            options: [
                { value: 'infirm', display: { en: 'Infirm', zh: '衰弱', ru: 'Немощь', fr: 'Infirme', es: 'Invalidez', de: 'Gebrechlichkeit', ja: '虚弱', ko: '쇠약', pl: 'Niedomaganie', pt: 'Invalidez', tr: 'Bitkinlik' }},
                { value: 'faltering_heart', display: { en: 'Faltering Heart', zh: '衰心', ru: 'Слабое сердце', fr: 'Cœur chancelant', es: 'Corazón vacilante', de: 'Schwaches Herz', ja: '弱った心臓', ko: '약해진 심장', pl: 'Słabnące serce', pt: 'Coração vacilante', tr: 'Zayıflayan Kalp' }},
                { value: 'fragile_bones', display: { en: 'Fragile Bones', zh: '脆骨', ru: 'Хрупкие кости', fr: 'Os fragiles', es: 'Huesos frágiles', de: 'Brüchige Knochen', ja: '脆い骨', ko: '약한 뼈', pl: 'Kruche kości', pt: 'Ossos frágeis', tr: 'Kırılgan Kemikler' }}
            ],
            desc: {
                en: "progression-tracked trait to advance on {{character2Name}} through {{character1Name}}'s influence (only traits with an xp track work: infirm, faltering_heart, fragile_bones).",
                zh: "通过{{character1Name}}的影响在{{character2Name}}身上推进的进度型特质（仅支持带经验轨迹的特质：infirm、faltering_heart、fragile_bones）。",
                ru: "прогрессирующий признак, продвигаемый у {{character2Name}} под влиянием {{character1Name}} (работают только признаки с треком опыта: infirm, faltering_heart, fragile_bones).",
                fr: "trait à progression à faire avancer chez {{character2Name}} grâce à l'influence de {{character1Name}} (seuls les traits avec une piste d'xp fonctionnent : infirm, faltering_heart, fragile_bones).",
                es: "rasgo de progresión a avanzar en {{character2Name}} mediante la influencia de {{character1Name}} (solo funcionan los rasgos con una pista de xp: infirm, faltering_heart, fragile_bones).",
                de: "Fortschrittsmerkmal, das bei {{character2Name}} durch {{character1Name}}s Einfluss vorangetrieben wird (nur Merkmale mit XP-Track funktionieren: infirm, faltering_heart, fragile_bones).",
                ja: "{{character1Name}}の影響により{{character2Name}}に進行させる進行型特性（経験値トラックを持つ特性のみ有効：infirm、faltering_heart、fragile_bones）。",
                ko: "{{character1Name}}의 영향으로 {{character2Name}}에게 진행시키는 진행형 특성(경험치 트랙이 있는 특성만 작동: infirm, faltering_heart, fragile_bones).",
                pl: "cecha progresyjna, którą {{character1Name}} postępuje u {{character2Name}} (działają tylko cechy ze ścieżką doświadczenia: infirm, faltering_heart, fragile_bones).",
                pt: "traço de progressão a avançar em {{character2Name}} através da influência de {{character1Name}} (apenas traços com faixa de xp funcionam: infirm, faltering_heart, fragile_bones).",
                tr: "{{character1Name}} etkisiyle {{character2Name}} üzerinde ilerletilen ilerleme özelliği (yalnızca xp izine sahip özellikler çalışır: infirm, faltering_heart, fragile_bones)."
            },
        },
        {
            name: "value",
            type: "int",
            desc: {
                en: "amount of trait xp to add (positive, default 10).",
                zh: "要添加的特质经验值（正数，默认10）。",
                ru: "количество опыта признака для добавления (положительное, по умолчанию 10).",
                fr: "quantité d'xp de trait à ajouter (positif, défaut 10).",
                es: "cantidad de xp de rasgo a añadir (positivo, por defecto 10).",
                de: "Menge an Merkmals-XP, die hinzugefügt werden soll (positiv, Standard 10).",
                ja: "追加する特性の経験値量（正の数、デフォルト10）。",
                ko: "추가할 특성 경험치 양(양수, 기본값 10).",
                pl: "ilość doświadczenia cechy do dodania (dodatnia, domyślnie 10).",
                pt: "quantidade de xp de traço a adicionar (positivo, padrão 10).",
                tr: "eklenecek özellik xp miktarı (pozitif, varsayılan 10)."
            }
        }
    ],
    description: {
        en: `Executed when a character's words drive another's condition along its progression. The source (character1) is the one INFLUENCING. The target (character2) is the one whose trait progression advances.`,
        zh: `当一个角色的话语推动另一个角色的病情沿着其进程发展时执行。`,
        ru: `Выполняется, когда слова одного персонажа продвигают состояние другого по его течению.`,
        fr: `Exécuté lorsque les paroles d'un personnage font progresser l'état d'un autre.`,
        es: `Ejecutado cuando las palabras de un personaje impulsan la condición de otro en su progresión.`,
        de: `Wird ausgeführt, wenn die Worte eines Charakters den Zustand eines anderen vorantreiben.`,
        ja: `あるキャラクターの言葉が別のキャラクターの状態を進行させたときに実行されます。`,
        ko: `한 캐릭터의 말이 다른 캐릭터의 상태를 진행시킬 때 실행됩니다.`,
        pl: `Wykonywane, gdy słowa jednej postaci popychają stan drugiej w jego przebiegu.`,
        pt: `Executado quando as palavras de um personagem impulsionam a condição de outro em sua progressão.`,
        tr: `Bir karakterin sözleri başka birinin durumunu ilerlettiğinde çalıştırılır.`
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
            return { success: false, message: "A character cannot advance their own trait progression through this action." };
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
        const traitKey = args && args[0] ? String(args[0]).trim() : "infirm";
        let value = parseInt(args && args[1] ? String(args[1]) : "10", 10);
        if (isNaN(value) || value <= 0) {
            value = 10;
        }
        runGameEffect(`
            global_var:votcce_action_target = {
                add_trait_xp = {
                    trait = ${traitKey}
                    track = ${traitKey}
                    value = ${value}
                }
            }`);
    },

    chatMessage: (args) => {
        const traitKey = args[0];
        const value = args[1];
        return {
            en: `{{character2Name}}'s ${traitKey} progressed by ${value} due to {{character1Name}}'s words.`,
            zh: `{{character1Name}}的话语使{{character2Name}}的${traitKey}进展了${value}。`,
            ru: `${traitKey} у {{character2Name}} продвинулся(ась) на ${value} из-за слов {{character1Name}}.`,
            fr: `Le ${traitKey} de {{character2Name}} a progressé de ${value} à cause des paroles de {{character1Name}}.`,
            es: `El ${traitKey} de {{character2Name}} progresó en ${value} por las palabras de {{character1Name}}.`,
            de: `${traitKey} von {{character2Name}} ist durch {{character1Name}}s Worte um ${value} fortgeschritten.`,
            ja: `{{character1Name}}の言葉により、{{character2Name}}の${traitKey}が${value}進行しました。`,
            ko: `{{character1Name}}의 말로 인해 {{character2Name}}의 ${traitKey}가 ${value}만큼 진행되었습니다.`,
            pl: `${traitKey} u {{character2Name}} postąpił(ęła) o ${value} wskutek słów {{character1Name}}.`,
            pt: `O ${traitKey} de {{character2Name}} progrediu em ${value} por causa das palavras de {{character1Name}}.`,
            tr: `{{character1Name}}'in sözleri yüzünden {{character2Name}}'in ${traitKey} durumu ${value} ilerledi.`
        };
    },

    chatMessageClass: "negative-action-message",
    canPerformAtDistance: true
};