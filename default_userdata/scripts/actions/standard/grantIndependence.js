//Made by: a dude(patrick)

/** @import { GameData, Character } from '../../gamedata_typedefs.js' */
module.exports = {
    signature: "grantIndependence",
    isDestructive: true,
    args: [],
    description: {
        en: "Grants independence to a vassal (removes their liege). Use this to peacefully grant independence or accept a demand for independence. If a demand for independence is rejected, do NOT use this action; instead, the vassal should use the declareWar action with the independence_war casus_belli.",
        zh: "æŽˆäºˆé™„åº¸ç‹¬ç«‹ï¼ˆç§»é™¤å…¶é¢†ä¸»ï¼‰ã€‚ç”¨äºŽå’Œå¹³æŽˆäºˆç‹¬ç«‹æˆ–æŽ¥å—ç‹¬ç«‹è¦æ±‚ã€‚å¦‚æžœæ‹’ç»ç‹¬ç«‹è¦æ±‚ï¼Œè¯·ä¸è¦ä½¿ç”¨æ­¤æ“ä½œï¼›è€Œåº”ç”±é™„åº¸ä½¿ç”¨å¸¦æœ‰ independence_war æˆ˜äº‰å€Ÿå£çš„ declareWar æ“ä½œã€‚",
        ru: "ÐŸÑ€ÐµÐ´Ð¾ÑÑ‚Ð°Ð²Ð»ÑÐµÑ‚ Ð½ÐµÐ·Ð°Ð²Ð¸ÑÐ¸Ð¼Ð¾ÑÑ‚ÑŒ Ð²Ð°ÑÑÐ°Ð»Ñƒ (ÑƒÐ´Ð°Ð»ÑÐµÑ‚ ÐµÐ³Ð¾ ÑŽÐ·ÐµÑ€ÐµÐ½Ð°). Ð˜ÑÐ¿Ð¾Ð»ÑŒÐ·ÑƒÐ¹Ñ‚Ðµ Ð´Ð»Ñ Ð¼Ð¸Ñ€Ð½Ð¾Ð³Ð¾ Ð¿Ñ€ÐµÐ´Ð¾ÑÑ‚Ð°Ð²Ð»ÐµÐ½Ð¸Ñ Ð½ÐµÐ·Ð°Ð²Ð¸ÑÐ¸Ð¼Ð¾ÑÑ‚Ð¸ Ð¸Ð»Ð¸ Ð¿Ñ€Ð¸Ð½ÑÑ‚Ð¸Ñ Ñ‚Ñ€ÐµÐ±Ð¾Ð²Ð°Ð½Ð¸Ñ. Ð•ÑÐ»Ð¸ Ñ‚Ñ€ÐµÐ±Ð¾Ð²Ð°Ð½Ð¸Ðµ Ð¾Ñ‚ÐºÐ»Ð¾Ð½ÐµÐ½Ð¾, ÐÐ• Ð¸ÑÐ¿Ð¾Ð»ÑŒÐ·ÑƒÐ¹Ñ‚Ðµ ÑÑ‚Ð¾ Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸Ðµ; Ð²Ð¼ÐµÑÑ‚Ð¾ ÑÑ‚Ð¾Ð³Ð¾ Ð²Ð°ÑÑÐ°Ð» Ð´Ð¾Ð»Ð¶ÐµÐ½ Ð¸ÑÐ¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÑŒ declareWar Ñ casus_belli independence_war.",
        fr: "Accorde l'indÃ©pendance Ã  un vassal (retire son lige). Utilisez-le pour accorder pacifiquement l'indÃ©pendance ou accepter une demande d'indÃ©pendance. Si la demande est rejetÃ©e, utilisez plutÃ´t declareWar avec le casus_belli independence_war.",
        es: "Otorga la independencia a un vasallo (elimina a su seÃ±or). Ãšselo para conceder la independencia pacÃficamente o aceptar una demanda de independencia. Si se rechaza, use declareWar con el casus_belli independence_war.",
        de: "GewÃ¤hrt einem Vasallen die UnabhÃ¤ngigkeit (entfernt seinen Lehnsherrn). Verwenden Sie dies fÃ¼r eine friedliche Trennung oder um einer Forderung zuzustimmen. Wenn abgelehnt, verwenden Sie stattdessen declareWar mit independence_war.",
        ja: "å®¶è‡£ã«ç‹¬ç«‹ã‚’ä¸Žãˆã¾ã™ï¼ˆä¸»å›ã‚’å¤–ã—ã¾ã™ï¼‰ã€‚å¹³å’Œè£ã«ç‹¬ç«‹ã‚’èªã‚ã‚‹ã‹ã€è¦æ±‚ã‚’å—ã‘å…¥ã‚Œã‚‹å ´åˆã«ä½¿ç”¨ã—ã¾ã™ã€‚æ‹’å¦ã™ã‚‹å ´åˆã¯ã€ä»£ã‚ã‚Šã« independence_war ã‚’ä½¿ã£ã¦ declareWar ã‚’å®Ÿè¡Œã—ã¦ãã ã•ã„ã€‚",
        ko: "ë´‰ì‹ ì—ê²Œ ë…ë¦½ì„ ë¶€ì—¬í•©ë‹ˆë‹¤(êµ°ì£¼ë¥¼ ì œê±°í•©ë‹ˆë‹¤). í‰í™”ë¡­ê²Œ ë…ë¦½ì„ ë¶€ì—¬í•˜ê±°ë‚˜ ë…ë¦½ ìš”êµ¬ë¥¼ ìˆ˜ë½í•  ë•Œ ì‚¬ìš©í•˜ì‹ì‹œì˜¤. ê±°ì ˆí•  ê²½ìš° independence_warì™€ í•¨ê»˜ declareWarë¥¼ ì‚¬ìš©í•˜ì‹ì‹œì˜¤.",
        pl: "Nadaje niepodlegÅ‚oÅ›Ä‡ wasalowi (usuwa jego seniora). UÅ¼yj tego, aby pokojowo przyznaÄ‡ niepodlegÅ‚oÅ›Ä‡ lub zaakceptowaÄ‡ Å¼Ä…danie. W przypadku odmowy uÅ¼yj declareWar z casus_belli independence_war.",
        pt: "Concede a independÃªncia a um vassalo (remove seu suserano). Use isso para conceder a independÃªncia pacificamente ou aceitar uma exigÃªncia de independÃªncia. Se for rejeitada, use declareWar com o casus_belli independence_war."
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
            zh: `{{character1Name}} å’Œ {{character2Name}} ä¹‹é—´çš„é¢†ä¸»-é™„åº¸å…³ç³»å·²ç»è§£é™¤ã€‚`,  
            ru: `ÐžÑ‚Ð½Ð¾ÑˆÐµÐ½Ð¸Ñ ÑŽÐ·ÐµÑ€ÐµÐ½Ð°-Ð²Ð°ÑÑÐ°Ð»Ð° Ð¼ÐµÐ¶Ð´Ñƒ {{character1Name}} Ð¸ {{character2Name}} Ð±Ñ‹Ð»Ð¸ Ñ€Ð°ÑÑ‚Ð¾Ñ€Ð³Ð½ÑƒÑ‚Ñ‹.`,
            fr: `La relation suzerain-vassal entre {{character1Name}} et {{character2Name}} a Ã©tÃ© dissoute.`,
            es: `La relaciÃ³n seÃ±or-vasallo entre {{character1Name}} y {{character2Name}} se ha disuelto.`,  
            de: `Die Lehnsherr-Vasall-Beziehung zwischen {{character1Name}} und {{character2Name}} wurde aufgelÃ¶st.`,
            ja: `{{character1Name}} ã¨ {{character2Name}} ã®é–“ã®ä¸»å›ãƒ»å®¶è‡£é–“ã®é–¢ä¿‚ãŒè§£æ¶ˆã•ã‚Œã¾ã—ãŸã€‚`,
            ko: `{{character1Name}}ì™€ {{character2Name}} ì‚¬ì´ì˜ êµ°ì£¼-ë´‰ì‹  ê´€ê³„ê°€ í•´ì†Œë˜ì—ˆìŠµë‹ˆë‹¤.`,
            pl: `Relacja senior-wasal miÄ™dzy {{character1Name}} a {{character2Name}} zostaÅ‚a rozwiÄ…zana.`,
            pt: `A relaÃ§Ã£o suserano-vassalo entre {{character1Name}} e {{character2Name}} foi dissolvida.`  
        };
    },

    chatMessageClass: "neutral-action-message"
};
