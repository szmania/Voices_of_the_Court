//Made by: VOTC-CE

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

const TITLE_KEY_RE = /^[bcdke]_[a-z0-9_]+$/;

const TIER_HINTS = [
    { regex: /\bbaron(y|ial)?\b|\bbarony\b|\bcastle\b|\bbaron\b|\bbaroness\b/, prefix: "b_" },
    { regex: /\bcount(y|ies)?\b|\bcounty\b|\bearldom\b|\bcount\b|\bcountess\b|\bearl\b/, prefix: "c_" },
    { regex: /\bduch(y|ies)?\b|\bduchy\b|\bduke\b|\bduchess\b/, prefix: "d_" },
    { regex: /\bkingdom\b|\brealm\b|\bking\b|\bqueen\b/, prefix: "k_" },
    { regex: /\bempire\b|\bimperial\b|\bemperor\b|\bempress\b/, prefix: "e_" }
];

function cleanTokenInput(value) {
    return String(value || "")
        .toLowerCase()
        .trim()
        .replace(/^title:/, "")
        .replace(/["'`]/g, "")
        .replace(/[^a-z0-9_\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeTitleInput(value) {
    let text = cleanTokenInput(value);
    if (!text) {
        return "";
    }

    let direct = text.replace(/[\s-]+/g, "_").replace(/_+/g, "_");
    if (TITLE_KEY_RE.test(direct)) {
        return direct;
    }

    let prefix = "";
    for (const hint of TIER_HINTS) {
        if (hint.regex.test(text)) {
            prefix = hint.prefix;
            text = text.replace(hint.regex, " ");
            break;
        }
    }

    text = text
        .replace(/\b(i|you|me|my|your|we|our|us|claim|push|grant|give)\b/g, " ")
        .replace(/\b(title|landed|holding|holdings|of|the|a|an|to|for)\b/g, " ")
        .replace(/[\s-]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");

    if (!text || !prefix) {
        return "";
    }

    const output = `${prefix}${text}`;
    return TITLE_KEY_RE.test(output) ? output : "";
}

function inferTargetTitleKey(targetCharacter) {
    if (!targetCharacter || !targetCharacter.primaryTitle) return "";
    const rank = String(targetCharacter.titleRankConcept || "").toLowerCase();
    const prefix = rank.includes("emp") ? "e_" : rank.includes("king") ? "k_" : (rank.includes("duke") || rank.includes("duc")) ? "d_" : "c_";
    const base = String(targetCharacter.primaryTitle)
        .trim()
        .toLowerCase()
        .replace(/^(the|fief of|county of|duchy of|kingdom of|empire of)\s+/i, "")
        .replace(/[^a-zA-Z0-9\s_]/g, " ")
        .replace(/\s+/g, "_")
        .replace(/^_+|_+$/g, "");
    return `${prefix}${base}`;
}

function formatTitleKeyForDisplay(titleKey) {
    if (!TITLE_KEY_RE.test(String(titleKey || ""))) {
        return String(titleKey || "");
    }

    const key = String(titleKey).toLowerCase();
    const tierPrefix = key[0];
    const body = key.slice(2).replace(/_/g, " ").trim();
    if (!body) {
        return key;
    }

    const tierLabel = {
        b: "barony",
        c: "county",
        d: "duchy",
        k: "kingdom",
        e: "empire"
    }[tierPrefix];

    return tierLabel ? `${tierLabel} of ${body}` : key;
}

module.exports = {
    signature: "addClaim",
    args: [
        {
            name: "titleInput",
            type: "string",
            desc: {
                en: "Optional CK3 title key for the claim (e.g., c_york). If omitted, the target's primary title is inferred. Spanish intent: 'titulo reclamado', 'por el condado'.",
                zh: "要宣称的可选CK3头衔密钥（例如，c_york）。如果省略，将从目标的主头衔推断。西班牙语意图：'titulo reclamado', 'por el condado'。",
                ru: "Необязательный ключ титула CK3 для притязания (например, c_york). Если опущен, будет выведен из основного титула цели. Испанское намерение: 'titulo reclamado', 'por el condado'.",
                fr: "Clé de titre CK3 facultative pour la revendication (par exemple, c_york). Si omis, le titre principal de la cible est déduit. Intention espagnole : 'titulo reclamado', 'por el condado'.",
                es: "Clave de título opcional de CK3 para la reclamación (ej., c_york). Si se omite, se infiere el título principal del objetivo. Intención en español: 'título reclamado', 'por el condado'.",
                de: "Optionaler CK3-Titel-Schlüssel für den Anspruch (z. B. c_york). Wenn weggelassen, wird der Haupttitel des Ziels abgeleitet. Spanische Absicht: 'titulo reclamado', 'por el condado'.",
                ja: "請求のためのオプションのCK3称号キー（例：c_york）。省略した場合、ターゲットの主な称号が推測されます。スペイン語の意図：「titulo reclamado」、「por el condado」。",
                ko: "청구에 대한 선택적 CK3 타이틀 키(예: c_york). 생략하면 대상의 주 작위가 추론됩니다. 스페인어 의도: 'titulo reclamado', 'por el condado'.",
                pl: "Opcjonalny klucz tytułu CK3 dla roszczenia (np. c_york). Jeśli pominięty, zostanie wywnioskowany z tytułu głównego celu. Hiszpański zamiar: 'titulo reclamado', 'por el condado'.",
                pt: "Chave de título opcional do CK3 para a reivindicação (por exemplo, c_york). Se omitido, o título principal do alvo é inferido. Intenção em espanhol: 'titulo reclamado', 'por el condado'.",
                tr: "Talep için isteğe bağlı CK3 başlık anahtarı (örneğin, c_york). Atlanırsa, hedefin birincil unvanı çıkarılır. İspanyolca niyet: 'titulo reclamado', 'por el condado'."
            }
        }
    ],
    description: {
        en: `Executed when a character presses a claim on another's title. The source (character1) is the one GRANTING/PUSHING the claim. The target (character2) is the one RECEIVING the claim.`,
        zh: `当一个角色对另一个角色的头衔提出宣称时执行。`,
        ru: `Выполняется, когда один персонаж предъявляет притязание на титул другого.`,
        fr: `Exécuté lorsqu'un personnage pousse une revendication sur le titre d'un autre.`,
        es: `Ejecutado cuando un personaje presiona una reclamación sobre el título de otro.`,
        de: `Wird ausgeführt, wenn ein Charakter einen Anspruch auf den Titel eines anderen geltend macht.`,
        ja: `あるキャラクターが別のキャラクターの称号に対して請求を押し出したときに実行されます。`,
        ko: `한 캐릭터가 다른 캐릭터의 작위에 대한 청구를 추진할 때 실행됩니다.`,
        pl: `Wykonywane, gdy jedna postać wysuwa roszczenie do tytułu drugiej.`,
        pt: `Executado quando um personagem pressiona uma reivindicação sobre o título de outro.`,
        tr: `Bir karakter başkasının unvanına talep ileri sürdüğünde çalıştırılır.`
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
            return { success: false, message: "A character cannot grant themselves a claim through this action." };
        }
        const rawTitle = args[0] ? String(args[0]).trim() : "";
        const resolved = normalizeTitleInput(rawTitle) || inferTargetTitleKey(target);
        if (!resolved || !TITLE_KEY_RE.test(resolved)) {
            return { success: false, message: "Could not resolve a valid title key for the claim. Provide a key like c_york." };
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

        const rawTitle = args && args[0] ? String(args[0]).trim() : "";
        const titleKey = normalizeTitleInput(rawTitle) || inferTargetTitleKey(target);
        if (!titleKey || !TITLE_KEY_RE.test(titleKey)) return;

        runGameEffect(`
            global_var:votcce_action_target = {
                add_pressed_claim = title:${titleKey}
            }`);
    },

    chatMessage: (args) => {
        const displayTitle = formatTitleKeyForDisplay(args[0]);
        return {
            en: `{{character2Name}} gained a pressed claim on ${displayTitle || "the title"}.`,
            zh: `{{character2Name}}获得了对${displayTitle || "该头衔"}的强宣称。`,
            ru: `{{character2Name}} получил(а) настойчивое притязание на ${displayTitle || "титул"}.`,
            fr: `{{character2Name}} a obtenu une revendication pressée sur ${displayTitle || "le titre"}.`,
            es: `{{character2Name}} obtuvo una reclamación presionada sobre ${displayTitle || "el título"}.`,
            de: `{{character2Name}} hat einen geltend gemachten Anspruch auf ${displayTitle || "den Titel"} erhalten.`,
            ja: `{{character2Name}}は${displayTitle || "その称号"}に対する強い請求を得ました。`,
            ko: `{{character2Name}}님이 ${displayTitle || "해당 작위"}에 대한 강한 청구를 얻었습니다.`,
            pl: `{{character2Name}} uzyskał(a) przeforsowane roszczenie do ${displayTitle || "tytułu"}.`,
            pt: `{{character2Name}} ganhou uma reivindicação pressionada sobre ${displayTitle || "o título"}.`,
            tr: `{{character2Name}}, ${displayTitle || "unvan"} üzerinde baskılı bir talep kazandı.`
        };
    },

    chatMessageClass: "neutral-action-message",
    canPerformAtDistance: true
};