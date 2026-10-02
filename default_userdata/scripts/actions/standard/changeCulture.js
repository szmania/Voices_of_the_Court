//Made by: software_engineer_ck3

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

function normalizeCultureKey(value) {
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
    signature: "changeCulture",
    args: [
        {
            name: "cultureKey",
            type: "string",
            desc: {
                en: "optional culture key {{character2Name}} adopts (e.g. 'danish'). If empty, {{character2Name}} adopts {{character1Name}}'s culture.",
                zh: "{{character2Name}}采用的可选文化键（例如'danish'）。如果为空，{{character2Name}}采用{{character1Name}}的文化。",
                ru: "необязательный ключ культуры, который принимает {{character2Name}} (например, 'danish'). Если пусто, {{character2Name}} принимает культуру {{character1Name}}.",
                fr: "clé de culture facultative que {{character2Name}} adopte (ex. 'danish'). Si vide, {{character2Name}} adopte la culture de {{character1Name}}.",
                es: "clave de cultura opcional que {{character2Name}} adopta (p. ej. 'danish'). Si está vacío, {{character2Name}} adopta la cultura de {{character1Name}}.",
                de: "optionaler Kulturschlüssel, den {{character2Name}} annimmt (z. B. 'danish'). Wenn leer, übernimmt {{character2Name}} die Kultur von {{character1Name}}.",
                ja: "{{character2Name}}が採用する任意の文化キー（例：'danish'）。空の場合、{{character2Name}}は{{character1Name}}の文化を採用します。",
                ko: "{{character2Name}}가 채택하는 선택적 문화 키(예: 'danish'). 비어 있으면 {{character2Name}}가 {{character1Name}}의 문화를 채택합니다.",
                pl: "opcjonalny klucz kultury, który przyjmuje {{character2Name}} (np. 'danish'). Jeśli pusty, {{character2Name}} przyjmuje kulturę {{character1Name}}.",
                pt: "chave de cultura opcional que {{character2Name}} adota (ex.: 'danish'). Se vazio, {{character2Name}} adota a cultura de {{character1Name}}.",
                tr: "{{character2Name}}'nin benimsediği isteğe bağlı kültür anahtarı (örn. 'danish'). Boşsa, {{character2Name}} {{character1Name}}'in kültürünü benimser."
            }
        }
    ],
    description: {
        en: `Executed when a character adopts another's culture. The source (character1) is the one whose culture is ADOPTED (or the influencer). The target (character2) is the one whose culture CHANGES.`,
        zh: `当一个角色采用另一个角色的文化时执行。源（character1）是被采用文化者（或影响者），目标（character2）是文化被改变者。`,
        ru: `Выполняется, когда персонаж принимает культуру другого. Источник (персонаж 1) — тот, чья культура принимается (или влияющий), цель (персонаж 2) меняет свою культуру.`,
        fr: `Exécuté lorsqu'un personnage adopte la culture d'un autre. La source (personnage 1) est celui dont la culture est adoptée (ou l'influenceur), la cible (personnage 2) voit sa culture changer.`,
        es: `Ejecutado cuando un personaje adopta la cultura de otro. El origen (character1) es aquel cuya cultura se adopta (o el influyente), el objetivo (character2) cambia su cultura.`,
        de: `Wird ausgeführt, wenn ein Charakter die Kultur eines anderen annimmt. Die Quelle (Charakter 1) ist derjenige, dessen Kultur übernommen wird (oder der Einflussnehmer), das Ziel (Charakter 2) ändert seine Kultur.`,
        ja: `キャラクターが別のキャラクターの文化を採用したときに実行されます。ソース（キャラクター1）は文化が採用される側（または影響を与える側）、ターゲット（キャラクター2）は文化が変わる側です。`,
        ko: `캐릭터가 다른 캐릭터의 문화를 채택할 때 실행됩니다. 소스(캐릭터 1)는 문화가 채택되는 쪽(또는 영향을 주는 쪽), 대상(캐릭터 2)은 문화가 바뀌는 쪽입니다.`,
        pl: `Wykonywane, gdy postać przyjmuje kulturę innej. Źródło (postać 1) to ta, której kultura jest przyjmowana (lub wpływająca), cel (postać 2) zmienia swoją kulturę.`,
        pt: `Executado quando um personagem adota a cultura de outro. A fonte (character1) é aquele cuja cultura é adotada (ou o influenciador), o alvo (character2) tem sua cultura alterada.`,
        tr: `Bir karakter başkasının kültürünü benimsediğinde çalıştırılır. Kaynak (character1) kültürü benimsenen (veya etkileyen) taraftır, hedef (character2) kültürünü değiştirir.`
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
        if (!source || !target) return false;
        if (sourceId === targetId) return false;
        return (target.culture != source.culture);
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
            return { success: false, message: "A character cannot change their own culture through this action." };
        }

        const rawCulture = args && args[0] ? String(args[0]).trim() : "";
        if (rawCulture) {
            const cultureKey = normalizeCultureKey(rawCulture);
            if (!/^[a-z0-9_]{2,64}$/.test(cultureKey)) {
                return { success: false, message: `Invalid culture key "${rawCulture}". Could not normalize to a valid key.` };
            }
            args[0] = cultureKey; // Update with normalized key
            return { success: true };
        }

        const sourceCulture = String(source.culture || "").toLowerCase();
        const targetCulture = String(target.culture || "").toLowerCase();
        if (!sourceCulture || !targetCulture || sourceCulture === targetCulture) {
            return { success: false, message: "The source and target must be of different cultures for a culture change." };
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

        const rawCulture = args && args[0] ? String(args[0]).trim() : "";
        const cultureKey = rawCulture ? normalizeCultureKey(rawCulture) : "";

        if (cultureKey) {
            runGameEffect(`
                global_var:votcce_action_target = {
                    set_culture = culture:${cultureKey}
                }`);
        } else {
            runGameEffect(`
                global_var:votcce_action_target = {
                    set_culture = global_var:votcce_action_source.culture
                }`);
        }
    },

    chatMessage: (args) => {
        const rawCulture = args && args[0] ? String(args[0]).trim() : "";
        const cultureKey = rawCulture ? normalizeCultureKey(rawCulture) : "";
        if (cultureKey) {
            return {
                en: `{{character2Name}} adopted the ${cultureKey} culture under {{character1Name}}'s influence.`,
                zh: `{{character2Name}}在{{character1Name}}的影响下采用了${cultureKey}文化。`,
                ru: `{{character2Name}} принял(а) культуру ${cultureKey} под влиянием {{character1Name}}.`,
                fr: `{{character2Name}} a adopté la culture ${cultureKey} sous l'influence de {{character1Name}}.`,
                es: `{{character2Name}} adoptó la cultura ${cultureKey} bajo la influencia de {{character1Name}}.`,
                de: `{{character2Name}} übernahm die Kultur ${cultureKey} unter dem Einfluss von {{character1Name}}.`,
                ja: `{{character2Name}}は{{character1Name}}の影響下で${cultureKey}文化を採用しました。`,
                ko: `{{character2Name}}가 {{character1Name}}의 영향 아래 ${cultureKey} 문화를 채택했습니다.`,
                pl: `{{character2Name}} przyjął(ęła) kulturę ${cultureKey} pod wpływem {{character1Name}}.`,
                pt: `{{character2Name}} adotou a cultura ${cultureKey} sob a influência de {{character1Name}}.`,
                tr: `{{character2Name}}, {{character1Name}}'in etkisi altında ${cultureKey} kültürünü benimsedi.`
            };
        }
        return {
            en: `{{character2Name}} adopted {{character1Name}}'s culture.`,
            zh: `{{character2Name}}采用了{{character1Name}}的文化。`,
            ru: `{{character2Name}} принял(а) культуру {{character1Name}}.`,
            fr: `{{character2Name}} a adopté la culture de {{character1Name}}.`,
            es: `{{character2Name}} adoptó la cultura de {{character1Name}}.`,
            de: `{{character2Name}} übernahm die Kultur von {{character1Name}}.`,
            ja: `{{character2Name}}は{{character1Name}}の文化を採用しました。`,
            ko: `{{character2Name}}가 {{character1Name}}의 문화를 채택했습니다.`,
            pl: `{{character2Name}} przyjął(ęła) kulturę {{character1Name}}.`,
            pt: `{{character2Name}} adotou a cultura de {{character1Name}}.`,
            tr: `{{character2Name}}, {{character1Name}}'in kültürünü benimsedi.`
        };
    },
    chatMessageClass: "neutral-action-message"
};