//Made by: a dude(patrick)

/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
    signature: "grantIndependence",
    isDestructive: true,
    args: [],
    description: {
        en: "Grants independence to a vassal (removes their liege). Use this to peacefully grant independence or accept a demand for independence. If a demand for independence is rejected, do NOT use this action; instead, the vassal should use the declareWar action with the independence_war casus_belli.",
        zh: "授予附庸独立（移除其领主）。用于和平授予独立或接受独立要求。如果独立要求被拒绝，请不要使用此操作；而应由附庸使用带有 independence_war 战争借口的 declareWar 操作。",
        ru: "Предоставляет независимость вассалу (удаляет его сюзерена). Используйте для мирного предоставления независимости или принятия требования. Если требование отклонено, НЕ используйте это действие; вместо этого вассал должен использовать declareWar с casus_belli independence_war.",
        fr: "Accorde l'indépendance à un vassal (retire son liege). Utilisez-le pour accorder pacifiquement l'indépendance ou accepter une demande d'indépendance. Si la demande est rejetée, utilisez plutôt declareWar avec le casus_belli independence_war.",
        es: "Otorga la independencia a un vasallo (elimina a su señor). Úselo para conceder la independencia pacíficamente o aceptar una demanda de independencia. Si se rechaza, use declareWar con el casus_belli independence_war.",
        de: "Gewährt einem Vasallen die Unabhängigkeit (entfernt seinen Lehnsherrn). Verwenden Sie dies für eine friedliche Trennung oder um einer Forderung zuzustimmen. Wenn abgelehnt, verwenden Sie stattdessen declareWar mit independence_war.",
        ja: "家臣に独立を与えます（主君を外します）。平和裏に独立を認めるか、要求を受け入れる場合に使用します。拒否する場合は、代わりに independence_war を使って declareWar を実行してください。",
        ko: "봉신에게 독립을 부여합니다(군주를 제거합니다). 평화롭게 독립을 부여하거나 독립 요구를 수락할 때 사용하십시오. 거절할 경우 independence_war와 함께 declareWar를 사용하십시오.",
        pl: "Nadaje niepodległość wasalowi (usuwa jego seniora). Użyj tego, aby pokojowo przyznać niepodległość lub zaakceptować żądanie. W przypadku odmowy użyj declareWar z casus_belli independence_war.",
        pt: "Concede a independência a um vassalo (remove seu suserano). Use isso para conceder a independência pacificamente ou aceitar uma exigência de independência. Se for rejeitada, use declareWar com o casus_belli independence_war."
    },
 
    /**
     * @param {GameData} gameData
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) => {
        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);
        if (!source || !target || sourceId === targetId) return false;

        // Action is only available if there is a direct liege-vassal relationship
        const isLiegeVassal = source.liege === target.fullName || source.liege === target.shortName || 
                              target.liege === source.fullName || target.liege === target.shortName;
                              
        return !!isLiegeVassal;
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
            return { success: false, message: "Source and target must be different characters." };
        }

        const isLiegeVassal = source.liege === target.fullName || source.liege === target.shortName || 
                              target.liege === source.fullName || target.liege === target.shortName;

        if (!isLiegeVassal) {
            return { success: false, message: "Granting independence requires a liege-vassal relationship between the two characters." };
        }

        return { success: true };
    },

    /**
     * @param {GameData} gameData
     * @param {function} runGameEffect
     * @param {string[]} args
     * @param {number} sourceId
     * @param {number} targetId
     */
    run: (gameData, runGameEffect, args, sourceId, targetId) => {
        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);
        if (!source || !target) return;

        let vassalGlobalVar = "";
        let vassal = null;

        // Determine who the vassal is
        if (source.liege === target.fullName || source.liege === target.shortName) {
            vassalGlobalVar = "global_var:votcce_action_source";
            vassal = source;
        } else if (target.liege === source.fullName || target.liege === target.shortName) {
            vassalGlobalVar = "global_var:votcce_action_target";
            vassal = target;
        }
        
        if (!vassal) return;

        runGameEffect(`
            create_title_and_vassal_change = {
                type = independency
                save_scope_as = change
                add_claim_on_loss = no
            }
            ${vassalGlobalVar} = {
                becomes_independent = {
                    change = scope:change
                }
            }
            resolve_title_and_vassal_change = scope:change
        `);

        console.log(`[grantIndependence] Vassal '${vassal.shortName}' has been granted independence.`);
        // Update local state to reflect the severed tie
        vassal.liege = "";
    },

    chatMessage: (args) => {
        return {
            en: `The liege-vassal relationship between {{character1Name}} and {{character2Name}} has been dissolved.`,  
            zh: `{{character1Name}} 和 {{character2Name}} 之间的领主-附庸关系已被解除。`,  
            ru: `Отношения юзерена-вассала между {{character1Name}} и {{character2Name}} были расторгнуты.`,
            fr: `La relation suzerain-vassal entre {{character1Name}} et {{character2Name}} a été dissoute.`,
            es: `La relación señor-vasallo entre {{character1Name}} y {{character2Name}} se ha disuelto.`,  
            de: `Die Lehnsherr-Vasall-Beziehung zwischen {{character1Name}} und {{character2Name}} wurde aufgelöst.`,
            ja: `{{character1Name}} と {{character2Name}} の間の主君・家臣関係が解消されました。`,
            ko: `{{character1Name}}과 {{character2Name}} 사이의 군주-봉신 관계가 해소되었습니다.`,
            pl: `Relacja senior-wasal między {{character1Name}} a {{character2Name}} została rozwiązana.`,
            pt: `A relação suserano-vassalo entre {{character1Name}} e {{character2Name}} foi dissolvida.` 
        };
    },

    chatMessageClass: "neutral-action-message"
};
