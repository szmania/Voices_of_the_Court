//Made by: VOTC-CE

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

function normalizeModifierKey(value) {
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
    signature: "addCharacterModifier",
    args: [
        {
            name: "modifier",
            type: "enum",
            options: [
                { value: 'inspired_1', display: { en: 'Inspired', zh: '受启发', ru: 'Вдохновлён', fr: 'Inspiré', es: 'Inspirado', de: 'Inspiriert', ja: '触発された', ko: '영감을 받음', pl: 'Zainspirowany', pt: 'Inspirado', tr: 'İlhamlı' }},
                { value: 'inspired_2', display: { en: 'Greatly Inspired', zh: '深受启发', ru: 'Сильно вдохновлён', fr: 'Grandement inspiré', es: 'Muy inspirado', de: 'Stark inspiriert', ja: '大いに触発された', ko: '크게 영감을 받음', pl: 'Bardzo zainspirowany', pt: 'Muito inspirado', tr: 'Çok İlhamlı' }},
                { value: 'seduced_dazed', display: { en: 'Dazed', zh: '神魂颠倒', ru: 'Ошеломлён', fr: 'Étourdi', es: 'Aturdido', de: 'Benommen', ja: 'うっとりした', ko: '넋을 잃음', pl: 'Oszołomiony', pt: 'Atordoado', tr: 'Büyülenmiş' }},
                { value: 'terrified', display: { en: 'Terrified', zh: '惊恐', ru: 'В ужасе', fr: 'Terrifié', es: 'Aterrorizado', de: 'Entsetzt', ja: '恐怖に震える', ko: '겁에 질림', pl: 'Przerażony', pt: 'Aterrorizado', tr: 'Dehşete Düşmüş' }},
                { value: 'embarrassed', display: { en: 'Embarrassed', zh: '尴尬', ru: 'Смущён', fr: 'Embarrassé', es: 'Avergonzado', de: 'Verlegen', ja: '気まずい', ko: '난처함', pl: 'Zażenowany', pt: 'Envergonhado', tr: 'Utangaç' }},
                { value: 'reassured', display: { en: 'Reassured', zh: '安心', ru: 'Успокоен', fr: 'Rassuré', es: 'Tranquilizado', de: 'Beruhigt', ja: '安心した', ko: '안심함', pl: 'Uspokojony', pt: 'Tranquilizado', tr: 'Güven Verilmiş' }},
                { value: 'motivated', display: { en: 'Motivated', zh: '积极', ru: 'Мотивирован', fr: 'Motivé', es: 'Motivado', de: 'Motiviert', ja: 'やる気に満ちた', ko: '동기부여됨', pl: 'Zmobilizowany', pt: 'Motivado', tr: 'Motive' }}
            ],
            desc: {
                en: "quick-pick modifier to apply to {{character2Name}} by {{character1Name}} (optional, overrides free text).",
                zh: "{{character1Name}}对{{character2Name}}应用的快速选择修正（可选，覆盖自由文本）。",
                ru: "быстрый модификатор, который {{character1Name}} применяет к {{character2Name}} (необязательно, переопределяет свободный текст).",
                fr: "modificateur rapide à appliquer à {{character2Name}} par {{character1Name}} (facultatif, remplace le texte libre).",
                es: "modificador rápido para aplicar a {{character2Name}} por {{character1Name}} (opcional, anula el texto libre).",
                de: "Schnellauswahl-Modifikator, den {{character1Name}} auf {{character2Name}} anwendet (optional, überschreibt Freitext).",
                ja: "{{character1Name}}が{{character2Name}}に適用するクイックピックの修正（任意、自由テキストを上書き）。",
                ko: "{{character1Name}}가 {{character2Name}}에게 적용하는 빠른 선택 수정자(선택 사항, 자유 텍스트를 덮어씀).",
                pl: "szybki modyfikator stosowany do {{character2Name}} przez {{character1Name}} (opcjonalny, zastępuje dowolny tekst).",
                pt: "modificador rápido para aplicar a {{character2Name}} por {{character1Name}} (opcional, substitui o texto livre).",
                tr: "{{character1Name}} tarafından {{character2Name}}'ye uygulanan hızlı seçim değiştirici (isteğe bağlı, serbest metni geçersiz kılar)."
            },
        },
        {
            name: "modifierCustom",
            type: "string",
            desc: {
                en: "free-text modifier key to apply to {{character2Name}} by {{character1Name}} (sanitized to a snake_case key; overrides the quick-pick).",
                zh: "{{character1Name}}对{{character2Name}}应用的自由文本修正键（将清理为snake_case键；覆盖快速选择）。",
                ru: "свободный ключ модификатора, который {{character1Name}} применяет к {{character2Name}} (очищается до ключа snake_case; переопределяет быстрый выбор).",
                fr: "clé de modificateur en texte libre à appliquer à {{character2Name}} par {{character1Name}} (nettoyée en clé snake_case ; remplace le choix rapide).",
                es: "clave de modificador de texto libre para aplicar a {{character2Name}} por {{character1Name}} (se sanea a una clave snake_case; anula la selección rápida).",
                de: "Freitext-Modifikatorschlüssel, den {{character1Name}} auf {{character2Name}} anwendet (zu einem snake_case-Schlüssel bereinigt; überschreibt die Schnellauswahl).",
                ja: "{{character1Name}}が{{character2Name}}に適用する自由テキストの修正キー（snake_caseキーにサニタイズ；クイックピックを上書き）。",
                ko: "{{character1Name}}가 {{character2Name}}에게 적용하는 자유 텍스트 수정자 키(snake_case 키로 정리됨; 빠른 선택을 덮어씀).",
                pl: "dowolny klucz modyfikatora stosowany do {{character2Name}} przez {{character1Name}} (oczyszczany do klucza snake_case; zastępuje szybki wybór).",
                pt: "chave de modificador de texto livre para aplicar a {{character2Name}} por {{character1Name}} (sanitizada para uma chave snake_case; substitui a seleção rápida).",
                tr: "{{character1Name}} tarafından {{character2Name}}'ye uygulanan serbest metin değiştirici anahtarı (snake_case anahtarına temizlenir; hızlı seçimi geçersiz kılar)."
            },
        },
        {
            name: "days",
            type: "int",
            desc: {
                en: "duration in days the modifier lasts on {{character2Name}} (positive, default 365).",
                zh: "{{character2Name}}身上修正持续的天数（正数，默认365）。",
                ru: "продолжительность в днях, в течение которой модификатор действует на {{character2Name}} (положительное, по умолчанию 365).",
                fr: "durée en jours pendant laquelle le modificateur s'applique à {{character2Name}} (positif, défaut 365).",
                es: "duración en días que dura el modificador en {{character2Name}} (positivo, por defecto 365).",
                de: "Dauer in Tagen, die der Modifikator auf {{character2Name}} wirkt (positiv, Standard 365).",
                ja: "{{character2Name}}に修正が続く日数（正の数、デフォルト365）。",
                ko: "{{character2Name}}에게 수정자가 지속되는 일수(양수, 기본값 365).",
                pl: "czas trwania w dniach, przez który modyfikator działa na {{character2Name}} (dodatni, domyślnie 365).",
                pt: "duração em dias que o modificador dura em {{character2Name}} (positivo, padrão 365).",
                tr: "Değiştiricinin {{character2Name}} üzerinde sürdüğü gün sayısı (pozitif, varsayılan 365)."
            },
        }
    ],
    description: {
        en: `Executed when a character applies a temporary mood or effect modifier to another. The source (character1) is the one APPLYING the modifier. The target (character2) is the one RECEIVING it.`,
        zh: `当一个角色对另一个角色施加临时情绪或效果修正时执行。`,
        ru: `Выполняется, когда один персонаж применяет временный модификатор настроения или эффекта к другому.`,
        fr: `Exécuté lorsqu'un personnage applique un modificateur temporaire d'humeur ou d'effet à un autre.`,
        es: `Ejecutado cuando un personaje aplica un modificador temporal de ánimo o efecto a otro.`,
        de: `Wird ausgeführt, wenn ein Charakter einen temporären Stimmungs- oder Effektmodifikator auf einen anderen anwendet.`,
        ja: `あるキャラクターが別のキャラクターに一時的な気分や効果の修正を適用したときに実行されます。`,
        ko: `한 캐릭터가 다른 캐릭터에게 일시적인 기분 또는 효과 수정자를 적용할 때 실행됩니다.`,
        pl: `Wykonywane, gdy jedna postać stosuje tymczasowy modyfikator nastroju lub efektu do innej.`,
        pt: `Executado quando um personagem aplica um modificador temporário de humor ou efeito a outro.`,
        tr: `Bir karakter başka birine geçici bir ruh hali veya etki değiştiricisi uyguladığında çalıştırılır.`
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
            return { success: false, message: "A character cannot apply a modifier to themselves through this action." };
        }

        const quickPick = args && args[0] ? String(args[0]).trim() : "";
        const freeText = args && args[1] ? String(args[1]).trim() : "";
        if (!quickPick && !freeText) {
            return { success: false, message: "Please specify a modifier (quick-pick or free text)." };
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
        const quickPick = args && args[0] ? String(args[0]).trim() : "";
        const freeText = args && args[1] ? String(args[1]).trim() : "";

        let modifierKey = quickPick;
        if (!modifierKey) {
            modifierKey = normalizeModifierKey(freeText);
        }
        if (!modifierKey) return;

        let days = Number(args && args[2]);
        if (!Number.isFinite(days) || days <= 0) {
            days = 365;
        }
        days = Math.floor(days);

        runGameEffect(`
            global_var:votcce_action_target = {
                add_character_modifier = { modifier = ${modifierKey} days = ${days} }
            }`);
    },

    chatMessage: (args) => {
        const quickPick = args[0];
        const freeText = args[1];
        const days = args[2];
        const modifierKey = quickPick || normalizeModifierKey(freeText);
        const dayText = days ? ` for ${days} days` : "";
        return {
            en: `{{character1Name}} applied the ${modifierKey} modifier to {{character2Name}}${dayText}.`,
            zh: `{{character1Name}}对{{character2Name}}施加了${modifierKey}修正${dayText}。`,
            ru: `{{character1Name}} применил(а) модификатор ${modifierKey} к {{character2Name}}${dayText}.`,
            fr: `{{character1Name}} a appliqué le modificateur ${modifierKey} à {{character2Name}}${dayText}.`,
            es: `{{character1Name}} aplicó el modificador ${modifierKey} a {{character2Name}}${dayText}.`,
            de: `{{character1Name}} hat den Modifikator ${modifierKey} auf {{character2Name}} angewendet${dayText}.`,
            ja: `{{character1Name}}は{{character2Name}}に${modifierKey}修正を適用しました${dayText}。`,
            ko: `{{character1Name}}가 {{character2Name}}에게 ${modifierKey} 수정자를 적용했습니다${dayText}.`,
            pl: `{{character1Name}} zastosował(a) modyfikator ${modifierKey} do {{character2Name}}${dayText}.`,
            pt: `{{character1Name}} aplicou o modificador ${modifierKey} a {{character2Name}}${dayText}.`,
            tr: `{{character1Name}}, {{character2Name}}'ye ${modifierKey} değiştiricisini uyguladı${dayText}.`
        };
    },

    chatMessageClass: "neutral-action-message",
    canPerformAtDistance: true
};