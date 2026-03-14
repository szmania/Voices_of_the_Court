//Made by: Troller

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "allianceDiplomatic",
    args: [],
	
    description: {
        en: `Executed when {{aiName}} and {{playerName}} agree to form an alliance.`,
        zh: `当{{aiName}}和{{playerName}}同意结成同盟时执行。`,
        ru: `Выполняется, когда {{aiName}} и {{playerName}} соглашаются заключить союз.`,
        fr: `Exécuté lorsque {{aiName}} et {{playerName}} conviennent de former une alliance.`,
        es: `Ejecutado cuando {{aiName}} y {{playerName}} acuerdan formar una alianza.`,
        de: `Wird ausgeführt, wenn {{aiName}} und {{playerName}} sich einigen, ein Bündnis zu bilden.`,
        ja: `{{aiName}}と{{playerName}}が同盟を結ぶことに同意したときに実行されます。`,
        ko: `{{aiName}}와 {{playerName}}가 동맹을 형성하기로 동의했을 때 실행됩니다.`,
        pl: `Wykonywane, gdy {{aiName}} i {{playerName}} zgadzają się na zawarcie sojuszu.`
    },
	
    check: (gameData, initiatorId, targetId) => {
        const initiator = gameData.getCharacterById(initiatorId);
        const target = gameData.getCharacterById(targetId);
        if (!initiator || !target) return false;

        let opinionOfInitiator = 0;
        let conversationOpinion = 0;

        if (initiator.id === gameData.playerID) {
            opinionOfInitiator = target.opinionOfPlayer;
            conversationOpinion = target.getOpinionModifierValue("From conversations");
        } else {
            const opinionEntry = target.opinions.find(o => o.id === initiator.id);
            opinionOfInitiator = opinionEntry ? opinionEntry.opinon : 0;
            // Simulate conversation opinion for AI-AI
            conversationOpinion = opinionOfInitiator > 0 ? opinionOfInitiator / 2 : 0;
        }

        let conv = conversationOpinion * 2;
        let culture_faith = (target.faith == initiator.faith && target.culture == initiator.culture) ? 40 : ((target.faith == initiator.faith || target.culture == initiator.culture) ? 20 : 0);

        let score = conv + opinionOfInitiator + culture_faith;

        console.log(`culture & faith score: ` + culture_faith);
        console.log(`Diplomatic Alliance Score: ` + score);

        console.log((score >= 60));
        
        // Only allow alliance if score is high enough AND there's some randomness
        // Higher scores have higher probability
        if (score >= 60) {
            // Range: 60% chance at score 60 to 90% chance at score 100+
            const probability = Math.min(0.9, 0.6 + (Math.min(score, 100) - 60) * 0.0075);
            return Math.random() < probability;
        }
        return false;
    },
	
    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     * @param {number} initiatorId
     * @param {number} targetId
     */
    run: (gameData, runGameEffect, args, initiatorId, targetId) => {
		console.log(`Diplomatic Alliance Signed`);
        runGameEffect(`
			global_var:votcce_action_source = { 
				create_alliance = { 
					target = global_var:votcce_action_target 
					allied_through_owner = global_var:votcce_action_source
					allied_through_target = global_var:votcce_action_target
				} 
			}
			global_var:votcce_action_target = {
				add_opinion = {
					modifier = perk_negotiated_alliance_opinion
					target = global_var:votcce_action_source
				}
			}
        `);
    },
    chatMessage: () => {
        return {
            en: `{{character1Name}} and {{character2Name}} formed an alliance.`,
            zh: `{{character1Name}}和{{character2Name}}结成了同盟。`,
            ru: `{{character1Name}} и {{character2Name}} заключили союз.`,
            fr: `{{character1Name}} et {{character2Name}} ont formé une alliance.`,
            es: `{{character1Name}} y {{character2Name}} formaron una alianza.`,
            de: `{{character1Name}} und {{character2Name}} haben ein Bündnis gebildet.`,
            ja: `{{character1Name}}と{{character2Name}}は同盟を結びました。`,
            ko: `{{character1Name}}와 {{character2Name}}가 동맹을 형성했습니다.`,
            pl: `{{character1Name}} i {{character2Name}} zawarli sojusz.`
        };
    },
    chatMessageClass: "positive-action-message"
}
