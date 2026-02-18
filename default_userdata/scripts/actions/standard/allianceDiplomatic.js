//Made by: Troller

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "allianceDiplomatic",
    args: [],
	
    description: {
        en: `Executed when {{aiName}} and {{playerName}} agree to form an alliance.`,
        zh: `当{{aiName}}和{{playerName}}同意结成同盟时执行。`,
        ru: `Выполняется, когда {{aiName}} и {{playerName}} соглашаются заключить союз.`,
        fr: `Exécuté lorsque {{aiName}} et {{playerName}} conviennent de former une alliance.`
    },
	
    check: (gameData) => {
        let ai = gameData.getAi();
        let player = gameData.getPlayer();

        let conv = (ai.getOpinionModifierValue("From conversations")) * 2;
        let opinion = ai.opinionOfPlayer;
        let culture_faith = (ai.faith == player.faith && ai.culture == player.culture) ? 40 : ((ai.faith == player.faith || ai.culture == player.culture) ? 20 : 0);

        let score = conv + opinion + culture_faith;

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
     */
    run: (gameData, runGameEffect, args) => {
		console.log(`Diplomatic Alliance Signed`);
        runGameEffect(`
			global_var:talk_first_scope = { 
				create_alliance = { 
					target = global_var:talk_second_scope 
					allied_through_owner = global_var:talk_first_scope
					allied_through_target = global_var:talk_second_scope
				} 
			}
			global_var:talk_second_scope = {
				add_opinion = {
					modifier = perk_negotiated_alliance_opinion
					target = global_var:talk_first_scope
				}
			}
        `);
    },
    chatMessage: () => {
        return {
            en: `{{aiName}} and {{playerName}} formed an alliance.`,
            zh: `{{aiName}}和{{playerName}}结成了同盟。`,
            ru: `{{aiName}} и {{playerName}} заключили союз.`,
            fr: `{{aiName}} et {{playerName}} ont formé une alliance.`
        };
    },
    chatMessageClass: "positive-action-message"
}
