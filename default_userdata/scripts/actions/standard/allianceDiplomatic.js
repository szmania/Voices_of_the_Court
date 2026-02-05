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
        return (score >= 60);
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
    chatMessage: () =>{
        return `{{aiName}}和{{playerName}}结成了同盟。`;
    },
    chatMessageClass: "positive-action-message"
}
