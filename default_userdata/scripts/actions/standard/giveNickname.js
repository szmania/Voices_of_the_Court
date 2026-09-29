//Made by: VOTC-CE

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

function normalizeNicknameKey(value) {
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
    signature: "giveNickname",
    args: [
        {
            name: "quickPick",
            type: "enum",
            options: [
                { value: 'nick_the_just', display: { en: 'The Just', zh: '公正者', ru: 'Справедливый', fr: 'Le Juste', es: 'El Justo', de: 'Der Gerechte', ja: '公正王', ko: '공정왕', pl: 'Sprawiedliwy', pt: 'O Justo', tr: 'Adil' }},
                { value: 'nick_the_wise', display: { en: 'The Wise', zh: '智者', ru: 'Мудрый', fr: 'Le Sage', es: 'El Sabio', de: 'Der Weise', ja: '賢王', ko: '현명왕', pl: 'Mądry', pt: 'O Sábio', tr: 'Bilge' }},
                { value: 'nick_the_terrible', display: { en: 'The Terrible', zh: '恐怖者', ru: 'Грозный', fr: 'Le Terrible', es: 'El Terrible', de: 'Der Schreckliche', ja: '恐ろしき者', ko: '무서운 자', pl: 'Straszny', pt: 'O Terrível', tr: 'Korkunç' }},
                { value: 'nick_the_great', display: { en: 'The Great', zh: '大帝', ru: 'Великий', fr: 'Le Grand', es: 'El Grande', de: 'Der Große', ja: '大帝', ko: '대왕', pl: 'Wielki', pt: 'O Grande', tr: 'Büyük' }},
                { value: 'nick_the_reformer', display: { en: 'The Reformer', zh: '改革者', ru: 'Реформатор', fr: 'Le Réformateur', es: 'El Reformador', de: 'Der Reformer', ja: '改革者', ko: '개혁자', pl: 'Reformator', pt: 'O Reformador', tr: 'Reformcu' }}
            ],
            desc: {
                en: "quick-pick nickname to bestow on {{character2Name}} by {{character1Name}} (optional, overrides free text).",
                zh: "{{character1Name}}授予{{character2Name}}的快速选择绰号（可选，覆盖自由文本）。",
                ru: "быстрое прозвище, которое {{character1Name}} дарует {{character2Name}} (необязательно, переопределяет свободный текст).",
                fr: "surnom rapide à conférer à {{character2Name}} par {{character1Name}} (facultatif, remplace le texte libre).",
                es: "apodo rápido para otorgar a {{character2Name}} por {{character1Name}} (opcional, anula el texto libre).",
                de: "Schnellauswahl-Spitzname, den {{character1Name}} {{character2Name}} verleiht (optional, überschreibt Freitext).",
                ja: "{{character1Name}}が{{character2Name}}に授けるクイックピックの異名（任意、自由テキストを上書き）。",
                ko: "{{character1Name}}가 {{character2Name}}에게 수여하는 빠른 선택 별명(선택 사항, 자유 텍스트를 덮어씀).",
                pl: "szybki przydomek nadawany {{character2Name}} przez {{character1Name}} (opcjonalny, zastępuje dowolny tekst).",
                pt: "apelido rápido para conceder a {{character2Name}} por {{character1Name}} (opcional, substitui o texto livre).",
                tr: "{{character1Name}} tarafından {{character2Name}}'ye verilen hızlı seçim lakap (isteğe bağlı, serbest metni geçersiz kılar)."
            },
        },
        {
            name: "nickname",
            type: "string",
            desc: {
                en: "free-text nickname to bestow on {{character2Name}} by {{character1Name}} (sanitized to a nick_ key).",
                zh: "{{character1Name}}授予{{character2Name}}的自由文本绰号（将清理为nick_键）。",
                ru: "свободное прозвище, которое {{character1Name}} дарует {{character2Name}} (очищается до ключа nick_).",
                fr: "surnom en texte libre à conférer à {{character2Name}} par {{character1Name}} (nettoyé en clé nick_).",
                es: "apodo de texto libre para otorgar a {{character2Name}} por {{character1Name}} (se sanea a una clave nick_).",
                de: "Freitext-Spitzname, den {{character1Name}} {{character2Name}} verleiht (zu einem nick_-Schlüssel bereinigt).",
                ja: "{{character1Name}}が{{character2Name}}に授ける自由テキストの異名（nick_キーにサニタイズ）。",
                ko: "{{character1Name}}가 {{character2Name}}에게 수여하는 자유 텍스트 별명(nick_ 키로 정리됨).",
                pl: "dowolny przydomek nadawany {{character2Name}} przez {{character1Name}} (oczyszczany do klucza nick_).",
                pt: "apelido de texto livre para conceder a {{character2Name}} por {{character1Name}} (sanitizado para uma chave nick_).",
                tr: "{{character1Name}} tarafından {{character2Name}}'ye verilen serbest metin lakap (nick_ anahtarına temizlenir)."
            },
        }
    ],
    description: {
        en: `Executed when a character bestows a nickname upon another. The source (character1) is the one GIVING the nickname. The target (character2) is the one RECEIVING it.`,
        zh: `当一个角色授予另一个角色绰号时执行。`,
        ru: `Выполняется, когда один персонаж дарует прозвище другому.`,
        fr: `Exécuté lorsqu'un personnage confère un surnom à un autre.`,
        es: `Ejecutado cuando un personaje otorga un apodo a otro.`,
        de: `Wird ausgeführt, wenn ein Charakter einem anderen einen Spitznamen verleiht.`,
        ja: `あるキャラクターが別のキャラクターに異名を授けたときに実行されます。`,
        ko: `한 캐릭터가 다른 캐릭터에게 별명을 수여할 때 실행됩니다.`,
        pl: `Wykonywane, gdy jedna postać nadaje przydomek innej.`,
        pt: `Executado quando um personagem concede um apelido a outro.`,
        tr: `Bir karakter başka birine bir lakap verdiğinde çalıştırılır.`
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
            return { success: false, message: "A character cannot bestow a nickname on themselves." };
        }

        const quickPick = args && args[0] ? String(args[0]).trim() : "";
        const freeText = args && args[1] ? String(args[1]).trim() : "";
        if (!quickPick && !freeText) {
            return { success: false, message: "Please specify a nickname (quick-pick or free text)." };
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

        let nickKey = quickPick;
        if (!nickKey) {
            const sanitized = normalizeNicknameKey(freeText);
            nickKey = sanitized ? `nick_${sanitized}` : "";
        }
        if (!nickKey) return;

        runGameEffect(`
            global_var:votcce_action_target = {
                give_nickname = ${nickKey}
            }`);
    },

    chatMessage: (args) => {
        const quickPick = args[0];
        const freeText = args[1];
        const nickKey = quickPick || (freeText ? `nick_${normalizeNicknameKey(freeText)}` : "");
        return {
            en: `{{character1Name}} bestowed the nickname ${nickKey} on {{character2Name}}.`,
            zh: `{{character1Name}}授予{{character2Name}}绰号${nickKey}。`,
            ru: `{{character1Name}} даровал(а) {{character2Name}} прозвище ${nickKey}.`,
            fr: `{{character1Name}} a conféré le surnom ${nickKey} à {{character2Name}}.`,
            es: `{{character1Name}} otorgó el apodo ${nickKey} a {{character2Name}}.`,
            de: `{{character1Name}} hat {{character2Name}} den Spitznamen ${nickKey} verliehen.`,
            ja: `{{character1Name}}は{{character2Name}}に${nickKey}という異名を授けました。`,
            ko: `{{character1Name}}가 {{character2Name}}에게 ${nickKey} 별명을 수여했습니다.`,
            pl: `{{character1Name}} nadał(a) {{character2Name}} przydomek ${nickKey}.`,
            pt: `{{character1Name}} concedeu o apelido ${nickKey} a {{character2Name}}.`,
            tr: `{{character1Name}}, {{character2Name}}'ye ${nickKey} lakabını verdi.`
        };
    },

    chatMessageClass: "neutral-action-message",
    canPerformAtDistance: true
};