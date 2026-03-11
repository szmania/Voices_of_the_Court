//Made by: MrAndroPC (based on peace's action)

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "aiAgreedToTruce",
    args: [
        {
            name: "years",
            type: "number",
            min: 1,
            desc: { 
                en: "Required argument. Specifies the number of years the truce lasts. Set 3 years as default if not provided.",
                zh: "必需参数。指定休战持续的年数。如果未提供，则默认为3年。",
                ru: "Обязательный аргумент. Указывает количество лет, в течение которых действует перемирие. По умолчанию устанавливается 3 года, если не указано.",
                fr: "Argument requis. Spécifie le nombre d'années pendant lesquelles la trêve dure. Par défaut, 3 ans si non fourni.",
                es: "Argumento requerido. Especifica el número de años que dura la tregua. Por defecto, 3 años si no se proporciona.",
                de: "Erforderliches Argument. Gibt die Anzahl der Jahre an, die der Waffenstillstand dauert. Standardmäßig 3 Jahre, wenn nicht angegeben.",
                ja: "必須引数。休戦が続く年数を指定します。指定されない場合はデフォルトで3年になります。",
                ko: "필수 인수. 휴전이 지속되는 년수를 지정합니다. 제공되지 않으면 기본값은 3년입니다.",
                pl: "Wymagany argument. Określa liczbę lat, przez które trwa zawieszenie broni. Domyślnie 3 lata, jeśli nie podano."
            }
        }
    ],
    description: {
        en: `Executed when {{aiName}} and {{playerName}} agree to a mutual truce for a certain number of years.`,
        zh: `当{{aiName}}和{{playerName}}同意达成一定年限的相互休战协议时执行。`,
        ru: `Выполняется, когда {{aiName}} и {{playerName}} соглашаются на взаимное перемирие на определенное количество лет.`,
        fr: `Exécuté lorsque {{aiName}} et {{playerName}} conviennent d'une trêve mutuelle pour un certain nombre d'années.`,
        es: `Ejecutado cuando {{aiName}} y {{playerName}} acuerdan una tregua mutua por un cierto número de años.`,
        de: `Wird ausgeführt, wenn {{aiName}} und {{playerName}} sich auf einen gegenseitigen Waffenstillstand für eine bestimmte Anzahl von Jahren einigen.`,
        ja: `{{aiName}}と{{playerName}}が一定年数の相互休戦に同意したときに実行されます。`,
        ko: `{{aiName}}와 {{playerName}}가 특정 년수 동안의 상호 휴전에 동의할 때 실행됩니다.`,
        pl: `Wykonywane, gdy {{aiName}} i {{playerName}} zgadzają się na wzajemne zawieszenie broni na określoną liczbę lat.`
    },
    
    /**
     * @param {GameData} gameData 
     */
    check: (gameData) => {
        const ai = gameData.getAi();
        
        // Only allow truce if opinion is moderately positive (>= 0)
        // and there's been meaningful conversation
        if (ai.opinionOfPlayer >= 0) {
            const conversationOpinion = ai.getOpinionModifierValue("From conversations");
            
            // Only allow if conversation has built up some positive opinion (>= 15)
            // This prevents truces from happening too early in conversations
            if (conversationOpinion >= 15) {
                // Higher opinion = higher probability of truce
                // Range: 50% chance at opinion 0 to 80% chance at opinion 100
                const probability = 0.5 + (ai.opinionOfPlayer / 100) * 0.3;
                return Math.random() < probability;
            }
        }
        return false;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
        let truceYears = args.length > 0 ? args[0] : 3; // Default to 3 years if not provided

        runGameEffect(`
            if = {
                limit = { 
                    OR = {
                        AND = {
                            max_military_strength:global_var:votcce_action_source >= max_military_strength:global_var:votcce_action_target
                            opinion:global_var:votcce_action_target = { target = global_var:votcce_action_source value = { -30 100 } } 
                        }
                        AND = {
                            max_military_strength:global_var:votcce_action_source < max_military_strength:global_var:votcce_action_target
                            opinion:global_var:votcce_action_target = { target = global_var:votcce_action_source value = { 30 100 } }
                        }
                    }
                }
                add_truce_both_ways = { 
                    character = global_var:votcce_action_target
                    years = ${truceYears}
                    override = yes
                }
            }
        `);
    },

    chatMessage: (args) => {
        let truceYears = args.length > 0 ? args[0] : 3;
        return {
            en: `{{aiName}} and {{playerName}} agreed to a ${truceYears}-year truce.`,
            zh: `{{aiName}}和{{playerName}}同意了${truceYears}年的休战协议。`,
            ru: `{{aiName}} и {{playerName}} согласились на перемирие на ${truceYears} года.`,
            fr: `{{aiName}} et {{playerName}} ont convenu d'une trêve de ${truceYears} ans.`,
            es: `{{aiName}} y {{playerName}} acordaron una tregua de ${truceYears} años.`,
            de: `{{aiName}} und {{playerName}} haben sich auf einen Waffenstillstand von ${truceYears} Jahren geeinigt.`,
            ja: `{{aiName}}と{{playerName}}は${truceYears}年間の休戦に同意しました。`,
            ko: `{{aiName}}와 {{playerName}}가 ${truceYears}년간의 휴전에 동의했습니다.`,
            pl: `{{aiName}} i {{playerName}} zgodzili się na zawieszenie broni na ${truceYears} lat.`
        };
    },
    
    chatMessageClass: "positive-action-message"
};
