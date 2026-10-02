//Made by: software_engineer

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

function normalizeGovernmentKey(value) {
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
    signature: "changeGovernment",
    args: [
        {
            name: "governmentType",
            type: "enum",
            options: [
                { value: 'feudal_government', display: { en: 'Feudal', zh: '封建', ru: 'Феодальное', fr: 'Féodal', es: 'Feudal', de: 'Feudal', ja: '封建', ko: '봉건', pl: 'Feudalne', pt: 'Feudal', tr: 'Feodal' }},
                { value: 'clan_government', display: { en: 'Clan', zh: '氏族', ru: 'Клановое', fr: 'Clanique', es: 'Clánico', de: 'Klan', ja: '氏族', ko: '씨족', pl: 'Klanowe', pt: 'Clã', tr: 'Klan' }},
                { value: 'republic_government', display: { en: 'Republic', zh: '共和', ru: 'Республика', fr: 'République', es: 'República', de: 'Republik', ja: '共和制', ko: '공화정', pl: 'Republika', pt: 'República', tr: 'Cumhuriyet' }},
                { value: 'tribal_government', display: { en: 'Tribal', zh: '部落', ru: 'Племенное', fr: 'Tribal', es: 'Tribal', de: 'Stamm', ja: '部族', ko: '부족', pl: 'Plemienne', pt: 'Tribal', tr: 'Kabile' }},
                { value: 'administrative_government', display: { en: 'Administrative', zh: '行政', ru: 'Административное', fr: 'Administratif', es: 'Administrativo', de: 'Administrativ', ja: '行政', ko: '행정', pl: 'Administracyjne', pt: 'Administrativo', tr: 'İdari' }},
                { value: 'theocracy_government', display: { en: 'Theocracy', zh: '神权', ru: 'Теократия', fr: 'Théocratie', es: 'Teocracia', de: 'Theokratie', ja: '神権制', ko: '신정', pl: 'Teokracja', pt: 'Teocracia', tr: 'Teokrasi' }},
                { value: 'nomad_government', display: { en: 'Nomad', zh: '游牧', ru: 'Кочевое', fr: 'Nomade', es: 'Nómada', de: 'Nomadisch', ja: '遊牧', ko: '유목', pl: 'Koczownicze', pt: 'Nômade', tr: 'Göçebe' }},
                { value: 'herder_government', display: { en: 'Herder', zh: '牧人', ru: 'Пастушье', fr: 'Berger', es: 'Pastoril', de: 'Hirten', ja: '牧畜', ko: '목축', pl: 'Pasterskie', pt: 'Pastoril', tr: 'Çoban' }},
                { value: 'mandala_government', display: { en: 'Mandala', zh: '曼荼罗', ru: 'Мандала', fr: 'Mandala', es: 'Mandala', de: 'Mandala', ja: 'マンダラ', ko: '만다라', pl: 'Mandala', pt: 'Mandala', tr: 'Mandala' }},
                { value: 'meritocratic_government', display: { en: 'Meritocratic', zh: '贤能', ru: 'Меритократия', fr: 'Méritocratie', es: 'Meritocrático', de: 'Meritokratisch', ja: '実力主義', ko: '능력주의', pl: 'Merytokratyczne', pt: 'Meritocrático', tr: 'Meritokratik' }}
            ],
            desc: {
                en: "government type {{character2Name}} adopts under {{character1Name}}'s influence (optional, overrides free text).",
                zh: "{{character2Name}}在{{character1Name}}影响下采用的政体类型（可选，覆盖自由文本）。",
                ru: "тип правления, который {{character2Name}} принимает под влиянием {{character1Name}} (необязательно, переопределяет свободный текст).",
                fr: "type de gouvernement que {{character2Name}} adopte sous l'influence de {{character1Name}} (facultatif, remplace le texte libre).",
                es: "tipo de gobierno que {{character2Name}} adopta bajo la influencia de {{character1Name}} (opcional, anula el texto libre).",
                de: "Regierungsform, die {{character2Name}} unter dem Einfluss von {{character1Name}} annimmt (optional, überschreibt Freitext).",
                ja: "{{character1Name}}の影響下で{{character2Name}}が採用する政体（任意、自由テキストを上書き）。",
                ko: "{{character1Name}}의 영향 아래 {{character2Name}}가 채택하는 정부 형태(선택 사항, 자유 텍스트를 덮어씀).",
                pl: "typ rządu, który {{character2Name}} przyjmuje pod wpływem {{character1Name}} (opcjonalny, zastępuje dowolny tekst).",
                pt: "tipo de governo que {{character2Name}} adota sob a influência de {{character1Name}} (opcional, substitui o texto livre).",
                tr: "{{character2Name}}'nin {{character1Name}}'in etkisi altında benimsediği yönetim türü (isteğe bağlı, serbest metni geçersiz kılar)."
            }
        },
        {
            name: "customGovernment",
            type: "string",
            desc: {
                en: "free-text government key for {{character2Name}} (sanitized to a snake_case key; overrides the quick-pick).",
                zh: "{{character2Name}}的自由文本政体键（将清理为snake_case键；覆盖快速选择）。",
                ru: "свободный ключ правления для {{character2Name}} (очищается до ключа snake_case; переопределяет быстрый выбор).",
                fr: "clé de gouvernement en texte libre pour {{character2Name}} (nettoyée en clé snake_case ; remplace le choix rapide).",
                es: "clave de gobierno de texto libre para {{character2Name}} (se sanea a una clave snake_case; anula la selección rápida).",
                de: "Freitext-Regierungsschlüssel für {{character2Name}} (zu einem snake_case-Schlüssel bereinigt; überschreibt die Schnellauswahl).",
                ja: "{{character2Name}}の自由テキスト政体キー（snake_caseキーにサニタイズ；クイックピックを上書き）。",
                ko: "{{character2Name}}의 자유 텍스트 정부 키(snake_case 키로 정리됨; 빠른 선택을 덮어씀).",
                pl: "dowolny klucz rządu dla {{character2Name}} (oczyszczany do klucza snake_case; zastępuje szybki wybór).",
                pt: "chave de governo de texto livre para {{character2Name}} (sanitizada para uma chave snake_case; substitui a seleção rápida).",
                tr: "{{character2Name}} için serbest metin yönetim anahtarı (snake_case anahtarına temizlenir; hızlı seçimi geçersiz kılar)."
            }
        }
    ],
    description: {
        en: `Executed when a character's realm changes government type. The source (character1) is the one INFLUENCING the change. The target (character2) is the one whose government CHANGES.`,
        zh: `当一个角色的领地改变政体时执行。源（character1）是施加影响者，目标（character2）是政体被改变者。`,
        ru: `Выполняется, когда форма правления владения персонажа меняется. Источник (персонаж 1) влияет на изменение, цель (персонаж 2) меняет своё правление.`,
        fr: `Exécuté lorsque le type de gouvernement du domaine d'un personnage change. La source (personnage 1) influence le changement, la cible (personnage 2) voit son gouvernement changer.`,
        es: `Ejecutado cuando el tipo de gobierno del reino de un personaje cambia. El origen (character1) influye en el cambio, el objetivo (character2) cambia su gobierno.`,
        de: `Wird ausgeführt, wenn sich die Regierungsform des Reiches eines Charakters ändert. Die Quelle (Charakter 1) beeinflusst die Änderung, das Ziel (Charakter 2) ändert seine Regierung.`,
        ja: `キャラクターの領地の政体が変わったときに実行されます。ソース（キャラクター1）が変更に影響を与え、ターゲット（キャラクター2）の政体が変わります。`,
        ko: `캐릭터 영지의 정부 형태가 바뀔 때 실행됩니다. 소스(캐릭터 1)는 변경에 영향을 주고, 대상(캐릭터 2)의 정부가 바뀝니다.`,
        pl: `Wykonywane, gdy typ rządu domeny postaci się zmienia. Źródło (postać 1) wpływa na zmianę, cel (postać 2) zmienia swój rząd.`,
        pt: `Executado quando o tipo de governo do reino de um personagem muda. A fonte (character1) influencia a mudança, o alvo (character2) tem seu governo alterado.`,
        tr: `Bir karakterin topraklarının yönetim türü değiştiğinde çalıştırılır. Kaynak (character1) değişimi etkiler, hedef (character2) yönetimini değiştirir.`
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
            return { success: false, message: "A character cannot change their own government through this action." };
        }

        const quickPick = args && args[0] ? String(args[0]).trim() : "";
        const freeText = args && args[1] ? String(args[1]).trim() : "";
        const governmentKey = quickPick || normalizeGovernmentKey(freeText) || "feudal_government";
        if (!/^[a-z0-9_]{2,64}$/.test(governmentKey)) {
            return { success: false, message: `Invalid government key "${governmentKey}". Could not normalize to a valid key.` };
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

        const quickPick = args && args[0] ? String(args[0]).trim() : "";
        const freeText = args && args[1] ? String(args[1]).trim() : "";
        const governmentKey = quickPick || normalizeGovernmentKey(freeText) || "feudal_government";

        runGameEffect(`
            global_var:votcce_action_target = {
                change_government = ${governmentKey}
            }`);
    },

    chatMessage: (args) => {
        const quickPick = args && args[0] ? String(args[0]).trim() : "";
        const freeText = args && args[1] ? String(args[1]).trim() : "";
        const governmentKey = quickPick || normalizeGovernmentKey(freeText) || "feudal_government";
        return {
            en: `{{character2Name}}'s realm adopted the ${governmentKey} under {{character1Name}}'s influence.`,
            zh: `{{character2Name}}的领地在{{character1Name}}的影响下采用了${governmentKey}政体。`,
            ru: `Владение {{character2Name}} приняло ${governmentKey} под влиянием {{character1Name}}.`,
            fr: `Le domaine de {{character2Name}} a adopté le gouvernement ${governmentKey} sous l'influence de {{character1Name}}.`,
            es: `El reino de {{character2Name}} adoptó el gobierno ${governmentKey} bajo la influencia de {{character1Name}}.`,
            de: `Das Reich von {{character2Name}} übernahm die Regierungsform ${governmentKey} unter dem Einfluss von {{character1Name}}.`,
            ja: `{{character2Name}}の領地は{{character1Name}}の影響下で${governmentKey}政体を採用しました。`,
            ko: `{{character2Name}}의 영지가 {{character1Name}}의 영향 아래 ${governmentKey} 정부를 채택했습니다.`,
            pl: `Domena {{character2Name}} przyjęła rząd ${governmentKey} pod wpływem {{character1Name}}.`,
            pt: `O reino de {{character2Name}} adotou o governo ${governmentKey} sob a influência de {{character1Name}}.`,
            tr: `{{character2Name}}'nin toprakları {{character1Name}}'in etkisi altında ${governmentKey} yönetimini benimsedi.`
        };
    },
    chatMessageClass: "neutral-action-message"
};