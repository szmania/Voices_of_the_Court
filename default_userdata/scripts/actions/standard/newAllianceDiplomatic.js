//Made by: MrAndroPC (based on Troller effect)

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "newAllianceDiplomatic",
    args: [],
	
    description: `execute when {{aiName}} and {{playerName}} agree on an alliance.`,
	

    check: (gameData) => {
        let ai = gameData.getAi();
		let player = gameData.getPlayer();
		
        let cultural_op = ai.getOpinionModifierValue("Cultural Acceptance");
        let religion_op = getReligionOpinionValue(ai, player.faith);
		let convo_op = ai.getOpinionModifierValue("From conversations");
        let personal_diplo = ai.getOpinionModifierValue("Personal Diplomacy");
		let opinion = ai.opinionOfPlayer;
        
        let new_score = (75 + (opinion / 2) + (convo_op * 2)) * (cultural_op+religion_op+personal_diplo+100)/100;
        console.log(`TEST_DIPLO`)
		console.log(`cultural_op: ` + cultural_op);
        console.log(`religion_op: ` + religion_op);
        console.log(`convo_op: ` + convo_op);
        console.log(`personal_diplo: ` + personal_diplo);
        console.log(`opinion: ` + opinion);
        console.log(`new_score: ` + new_score);

        return (new_score >= 100);
    },
	
    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
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
        return `{{aiName}} and {{playerName}} agreed to a diplomatic alliance.`;
    },
    chatMessageClass: "positive-action-message"
}

function getReligionOpinionValue(character, faith){
    let target = character.opinionBreakdownToPlayer.find( opinionModifier => opinionModifier.reason.includes(`${faith} is`));

    if(target !== undefined){
        return target.value;
    }
    else{
        return 0;
    }

}