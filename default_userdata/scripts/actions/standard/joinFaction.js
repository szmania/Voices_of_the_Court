//Made by: VOTC-CE

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

const FACTION_TYPES = [
    "independence_faction",
    "liberty_faction",
    "claimant_faction",
    "populist_faction"
];

function sanitizeFactionType(value) {
    const text = String(value || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    return FACTION_TYPES.includes(text) ? text : "";
}

module.exports = {
    signature: "joinFaction",
    args: [
        {
            name: "faction",
            type: "enum",
            options: [
                { value: 'independence_faction', display: { en: 'Independence', zh: '独立派', ru: 'Независимость', fr: 'Indépendance', es: 'Independencia', de: 'Unabhängigkeit', ja: '独立派', ko: '독립파', pl: 'Niezależność', pt: 'Independência', tr: 'Bağımsızlık' }},
                { value: 'liberty_faction', display: { en: 'Liberty', zh: '自由派', ru: 'Свобода', fr: 'Liberté', es: 'Libertad', de: 'Freiheit', ja: '自由派', ko: '자유파', pl: 'Wolność', pt: 'Liberdade', tr: 'Hürriyet' }},
                { value: 'claimant_faction', display: { en: 'Claimant', zh: '王位觊觎派', ru: 'Претендент', fr: 'Prétendant', es: 'Pretendiente', de: 'Thronprätendent', ja: '王位請求派', ko: '왕위 요구파', pl: 'Kandydat', pt: 'Pretendente', tr: 'Taraftar' }},
                { value: 'populist_faction', display: { en: 'Populist', zh: '民粹派', ru: 'Народники', fr: 'Populiste', es: 'Populista', de: 'Populistisch', ja: '民衆派', ko: '민중파', pl: 'Populiści', pt: 'Populista', tr: 'Halkçı' }}
            ],
            desc: {
                en: "faction {{character1Name}} convinces {{character2Name}} to back against their liege (optional, defaults to Liberty). If a faction of that type already exists, this quietly does nothing.",
                zh: "{{character1Name}}说服{{character2Name}}反抗其领主所支持的派系（可选，默认为自由派）。如果该类型的派系已存在，则静默无效。",
                ru: "фракция, к которой {{character1Name}} склоняет {{character2Name}} против их сюзерена (необязательно, по умолчанию — Свобода). Если фракция такого типа уже существует, действие тихо не срабатывает.",
                fr: "faction que {{character1Name}} convainc {{character2Name}} de soutenir contre leur suzerain (facultatif, Liberté par défaut). Si une faction de ce type existe déjà, l'action échoue silencieusement.",
                es: "facción a la que {{character1Name}} convence a {{character2Name}} de apoyar contra su señor (opcional, por defecto Libertad). Si ya existe una facción de ese tipo, la acción no hace nada en silencio.",
                de: "Fraktion, die {{character1Name}} {{character2Name}} gegen ihren Lehnsherren zu unterstützen überzeugt (optional, standardmäßig Freiheit). Existiert bereits eine Fraktion dieses Typs, passiert stillschweigend nichts.",
                ja: "{{character1Name}}が{{character2Name}}を説得して君主に反抗させる派閥（任意、デフォルトは自由派）。そのタイプの派閥が既に存在する場合は、静かに無効になります。",
                ko: "{{character1Name}}가 {{character2Name}}을(를) 설득해 그들의 군주에 맞서 지지하게 만드는 파벌(선택 사항, 기본값은 자유파). 해당 유형의 파벌이 이미 존재하면 조용히 실행되지 않습니다.",
                pl: "frakcja, do której {{character1Name}} przekonuje {{character2Name}} przeciw ich seniorowi (opcjonalne, domyślnie Wolność). Jeśli frakcja tego typu już istnieje, działanie dyskretnie nic nie robi.",
                pt: "facção que {{character1Name}} convence {{character2Name}} a apoiar contra o seu suserano (opcional, padrão Liberdade). Se uma facção desse tipo já existir, a ação silenciosamente não faz nada.",
                tr: "{{character1Name}}'in {{character2Name}}'i beylerine karşı desteklemeye ikna ettiği hizip (isteğe bağlı, varsayılan Özgürlük). Bu tür bir hizip zaten varsa, eylem sessizce hiçbir şey yapmaz."
            },
        }
    ],
    description: {
        en: `Executed when a character sways another into faction politics. The source (character1) is the one PERSUADING. The target (character2) is the one being drawn into the faction. The target must be a landed vassal with a liege.`,
        zh: `当一个角色说服另一个角色加入派系斗争时执行。目标必须是有领主的封臣。`,
        ru: `Выполняется, когда один персонаж вовлекает другого в фракционную борьбу. Цель должна быть держащим землю вассалом с сюзереном.`,
        fr: `Exécuté lorsqu'un personnage entraîne un autre dans la politique des factions. La cible doit être un vassal détenteur de terre avec un suzerain.`,
        es: `Ejecutado cuando un personaje arrastra a otro a la política de facciones. El objetivo debe ser un vasallo con tierras y con señor.`,
        de: `Wird ausgeführt, wenn ein Charakter einen anderen in die Fraktionspolitik zieht. Das Ziel muss ein Land besitzender Vasall mit Lehnsherrn sein.`,
        ja: `あるキャラクターが別のキャラクターを派閥政治に引き込んだときに実行されます。ターゲットは領主を持つ土地保有の封臣である必要があります。`,
        ko: `한 캐릭터가 다른 캐릭터를 파벌 정치에 끌어들일 때 실행됩니다. 대상은 군주가 있는 영지 보유 봉신이어야 합니다.`,
        pl: `Wykonywane, gdy jedna postać wciąga drugą w politykę frakcji. Cel musi być lennikiem posiadającym ziemię i mającym seniora.`,
        pt: `Executado quando um personagem arrasta outro para a política de facções. O alvo deve ser um vassalo com terras e com suserano.`,
        tr: `Bir karakter başka birini hizip siyasetine çektiğinde çalıştırılır. Hedefin, bir beyi olan toprak sahibi bir vasal olması gerekir.`
    },

    /**
     * @param {GameData} gameData 
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) => {
        const target = gameData.getCharacterById(targetId);
        if (!target) return false;

        const source = gameData.getCharacterById(sourceId);
        if (!source) return false;

        if (sourceId === targetId) return false;

        // Target must be a vassal with a liege to have a faction to join
        if (target.isIndependentRuler) return false;
        if (!target.liege) return false;

        return true;
    },

    /**
     * @param {GameData} gameData 
     * @param {string[]} args 
     * @param {number} sourceId
     * @param {number} targetId
     * @returns {{success: boolean, message?: string}}
     */
    preCheck: (gameData, args, sourceId, targetId) => {
        const target = gameData.getCharacterById(targetId);
        if (!target) {
            return { success: false, message: "Target character not found." };
        }

        const source = gameData.getCharacterById(sourceId);
        if (!source) {
            return { success: false, message: "Source character not found." };
        }

        if (sourceId === targetId) {
            return { success: false, message: "A character cannot sway themselves into a faction." };
        }

        if (target.isIndependentRuler || !target.liege) {
            return { success: false, message: "The target is not a vassal with a liege and has no faction to join." };
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
        const rawFaction = args && args[0] ? String(args[0]) : "";
        const factionType = sanitizeFactionType(rawFaction) || "liberty_faction";
        runGameEffect(`
            global_var:votcce_action_target = {
                create_faction = {
                    type = ${factionType}
                    target = liege
                }
            }`);
    },

    chatMessage: (args) => {
        const rawFaction = args[0];
        const factionType = sanitizeFactionType(rawFaction) || "liberty_faction";
        const factionText = factionType.replace(/_faction$/, "");
        return {
            en: `{{character2Name}} was swayed into backing the ${factionText} faction by {{character1Name}}.`,
            zh: `{{character2Name}}被{{character1Name}}说服，支持${factionText}派系。`,
            ru: `{{character2Name}} был(а) склонен(на) {{character1Name}} поддержать фракцию «${factionText}».`,
            fr: `{{character2Name}} a été convaincu par {{character1Name}} de soutenir la faction ${factionText}.`,
            es: `{{character2Name}} fue convencido por {{character1Name}} de apoyar la facción ${factionText}.`,
            de: `{{character2Name}} wurde von {{character1Name}} überzeugt, die ${factionText}-Fraktion zu unterstützen.`,
            ja: `{{character2Name}}は{{character1Name}}に説得され、${factionText}派を支持しました。`,
            ko: `{{character2Name}}는 {{character1Name}}에게 설득되어 ${factionText} 파벌을 지지했습니다.`,
            pl: `{{character2Name}} został(a) przekonany(a) przez {{character1Name}}, by poprzeć frakcję „${factionText}”.`,
            pt: `{{character2Name}} foi convencido por {{character1Name}} a apoiar a facção ${factionText}.`,
            tr: `{{character2Name}}, {{character1Name}} tarafından ${factionText} hizipini desteklemeye ikna edildi.`
        };
    },

    chatMessageClass: "negative-action-message",
    canPerformAtDistance: true
};