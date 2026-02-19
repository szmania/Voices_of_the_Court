//Made by: MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "playerVassalizingAI",
    args: [
        {
            name: "changePoliticalScore",
            type: "number",
            desc: "Required argument, range (-10, 10). Specifies {{aiName}} vassalization acceptance by {{playerName}}. Positive values mean that {{aiName}} tends to accept vassalization by {{playerName}}. Negative values mean that {{aiName}} tends to reject vassalization by {{playerName}}."
        }
    ],
    description: {
        en: `Executed when {{aiName}} and {{playerName}} discuss vassalization or its terms.`,
        zh: `当{{aiName}}和{{playerName}}讨论{{playerName}}将{{aiName}}封臣化或其条款时执行。`,
        ru: `Выполняется, когда {{aiName}} и {{playerName}} обсуждают вассализацию или ее условия.`,
        fr: `Exécuté lorsque {{aiName}} et {{playerName}} discutent de la vassalisation ou de ses conditions.`
    },
    
    /**
     * @param {GameData} gameData 
     */
    check: (gameData) => {
        let ai = gameData.getAi();
        let player = gameData.getPlayer();

        console.log(`PVAI: ${ai.opinionOfPlayer} ${player.isLandedRuler} ${ai.isLandedRuler}`)
        
        // Check basic conditions
        if ((ai.opinionOfPlayer >= -30) && (player.isLandedRuler) && (ai.isLandedRuler)){
            // Check if AI has the vassalization debate score trait
            if (ai.hasTrait("VassalizationDebateScore")) {
                let aiScore = Number(ai.traits.find(trait => trait.name === "VassalizationDebateScore").desc);
                
                // Only allow vassalization discussion if score is in a moderate range (-15 to 25)
                // This prevents triggering too early or too late in the process
                if (aiScore >= -15 && aiScore <= 25) {
                    // Higher scores have higher probability, but never guaranteed
                    // Remove arbitrary randomness - if dialogue warrants it, trigger action
                    // But ensure we're not in 4+ consecutive action responses
                    const probability = Math.min(0.95, 0.5 + (aiScore + 15) * 0.02);
                    return Math.random() < probability;
                }
                return false;
            }
            else {
                // Initial trait addition - only allow if opinion is positive
                if (ai.opinionOfPlayer > 10) {
                    ai.addTrait({
                        category: "politicalVariable",
                        name: "VassalizationDebateScore",
                        desc: `0`
                    });
                    console.log(`PVAI: Added trait to ${ai.shortName}`);
                    
                    // 60% chance to start vassalization discussion when conditions are met
                    // Still some randomness but higher than before
                    return Math.random() < 0.6;
                }
                return false;
            }
        }
        else {
            return false;
        }
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
        let ai = gameData.getAi();
        
        console.log(`PVAI: score: ${ai.traits.find(trait => trait.name === "VassalizationDebateScore").desc}`)
        
        let aiScore = Number(ai.traits.find(trait => trait.name === "VassalizationDebateScore").desc) + Number(args[0]);
        console.log(`PVAI: new_score: ${aiScore}`)

        if (aiScore >= 30) {
            runGameEffect(`
                create_title_and_vassal_change = {
                    type = swear_fealty
                    save_scope_as = change
                }
                global_var:talk_second_scope = {
                    change_liege = {
                        liege = root
                        change = scope:change
                    }
                    add_opinion = {
                        modifier = became_vassal
                        target = root
                        opinion = 10
                    }
                }
                resolve_title_and_vassal_change = scope:change
            `); 
        } else {
            ai.traits.find(trait => trait.name === "VassalizationDebateScore").desc = aiScore;
            runGameEffect(``); 
        }
        args[1] = aiScore
    },

    chatMessage: (args) => {
        let aiScore = args[1]
        console.log(`PVAIchat: score: ${aiScore}`)
        if (aiScore >= 30) {
            console.log(`PVAIchat: if`)
            return {
                en: `{{aiName}} agreed to become {{playerName}}'s vassal.`,
                zh: `{{aiName}}同意成为{{playerName}}的封臣。`,
                ru: `{{aiName}} согласился стать вассалом {{playerName}}.`,
                fr: `{{aiName}} a accepté de devenir le vassal de {{playerName}}.`
            };
        } else {
            console.log(`PVAIchat: else`)
            return {
                en: `Acceptance score: ${aiScore} | Vassalization if >30, breakdown if <-20`,
                zh: `接受分数：${aiScore} | 如果分数>30则封臣化，如果分数<-20则谈判破裂`,
                ru: `Очки принятия: ${aiScore} | Вассализация если >30, провал если <-20`,
                fr: `Score d'acceptation : ${aiScore} | Vassalisation si >30, rupture si <-20`
            };
        }
    },
    
    chatMessageClass: "positive-action-message"
};
