//Made by: MrAndroPC (based on Troller effect)

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "newAllianceDiplomatic",
    args: [],
	
    description: {
        en: `Executed when two characters agree to form an alliance. The source (character1) and target (character2) are the two parties forming the alliance.`,
        zh: `当两个角色同意结成联盟时执行。`,
        ru: `Выполняется, когда два персонажа соглашаются заключить союз.`,
        fr: `Exécuté lorsque deux personnages conviennent de former une alliance.`,
        es: `Ejecutado cuando dos personajes acuerdan formar una alianza.`,
        de: `Wird ausgeführt, wenn zwei Charaktere sich einigen, ein Bündnis zu bilden.`,
        ja: `二人のキャラクターが同盟を結ぶことに同意したときに実行されます。`,
        ko: `두 캐릭터가 동맹을 형성하기로 동의했을 때 실행됩니다.`,
        pl: `Wykonywane, gdy dwie postacie zgadzają się na zawarcie sojuszu.`
    },
	
    /**
     * @param {GameData} gameData
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) => {
        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);
        if (!source || !target) return false;

        let opinionOfSource = 0;
        let conversationOpinion = 0;
        let religion_op = 0;
        let cultural_op = 0;
        let personal_diplo = 0;

        if (source.id === gameData.playerID) {
            opinionOfSource = target.opinionOfPlayer;
            conversationOpinion = target.getOpinionModifierValue("From conversations");
            const religionOpinionModifier = target.opinionBreakdownToPlayer.find(modifier => modifier.reason.includes(`${source.faith} is`));
            if (religionOpinionModifier) {
                religion_op = religionOpinionModifier.value;
            }
            cultural_op = target.getOpinionModifierValue("Cultural Acceptance");
            personal_diplo = target.getOpinionModifierValue("Personal Diplomacy");
        } else {
            const opinionEntry = target.opinions.find(o => o.id === source.id);
            opinionOfSource = opinionEntry ? opinionEntry.opinion : 0;
            conversationOpinion = opinionOfSource > 0 ? opinionOfSource / 2 : 0; // Approximation
            if (target.faith === source.faith) {
                religion_op = 10; // Approximation
            }
            if (target.culture === source.culture) {
                cultural_op = 10; // Approximation
            }
        }
		
        let new_score = (75 + (opinionOfSource / 2) + (conversationOpinion * 2)) * (cultural_op + religion_op + personal_diplo + 100) / 100;
        console.log(`TEST_DIPLO`)
		console.log(`cultural_op: ` + cultural_op);
        console.log(`religion_op: ` + religion_op);
        console.log(`convo_op: ` + conversationOpinion);
        console.log(`personal_diplo: ` + personal_diplo);
        console.log(`opinion: ` + opinionOfSource);
        console.log(`new_score: ` + new_score);

        return (new_score >= 100);
    },
	
    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     * @param {number} sourceId
     * @param {number} targetId
     */
    run: (gameData, runGameEffect, args, sourceId, targetId) => {
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
    chatMessage: () =>{
        return {
            en: `{{character1Name}} and {{character2Name}} formed an alliance.`,
            zh: `{{character1Name}}和{{character2Name}}结为同盟。`,
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
