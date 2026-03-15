//Made by: MrAndroPC

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "offerVassalage",
    args: [
        {
            name: "changePoliticalScore",
            type: "number",
            min: -10,
            max: 10,
            desc: { 
                en: "Specifies {{character2Name}}'s vassalization acceptance by {{character1Name}}. Positive values mean acceptance, negative values mean rejection.",
                zh: "指定{{character2Name}}对{{character1Name}}的封臣化接受程度。正值表示倾向于接受，负值表示倾向于拒绝。",
                ru: "Определяет принятие вассализации {{character2Name}} со стороны {{character1Name}}. Положительные значения означают принятие, отрицательные - отказ.",
                fr: "Spécifie l'acceptation de la vassalisation de {{character2Name}} par {{character1Name}}. Les valeurs positives signifient l'acceptation, les valeurs négatives le rejet.",
                es: "Especifica la aceptación de la vasallización de {{character2Name}} por {{character1Name}}. Los valores positivos significan aceptación, los negativos rechazo.",
                de: "Gibt die Akzeptanz der Vasallisierung von {{character2Name}} durch {{character1Name}} an. Positive Werte bedeuten Akzeptanz, negative Werte Ablehnung.",
                ja: "{{character2Name}}の{{character1Name}}による封臣化の受容度を指定します。正の値は受諾、負の値は拒否を意味します。",
                ko: "{{character2Name}}의 {{character1Name}}에 의한 봉신화 수용도를 지정합니다. 양수 값은 수락, 음수 값은 거부를 의미합니다.",
                pl: "Określa akceptację wasalizacji {{character2Name}} przez {{character1Name}}. Wartości dodatnie oznaczają akceptację, a ujemne odrzucenie."
            }
        }
    ],
    description: {
        en: `Executed when two characters discuss vassalization or its terms.`,
        zh: `当两个角色讨论封臣化或其条款时执行。`,
        ru: `Выполняется, когда два персонажа обсуждают вассализацию или ее условия.`,
        fr: `Exécuté lorsque deux personnages discutent de la vassalisation ou de ses conditions.`,
        es: `Ejecutado cuando dos personajes discuten la vasallización o sus términos.`,
        de: `Wird ausgeführt, wenn zwei Charaktere die Vasallisierung oder ihre Bedingungen diskutieren.`,
        ja: `二人のキャラクターが封臣化またはその条件について議論するときに実行されます。`,
        ko: `두 캐릭터가 봉신화 또는 그 조건에 대해 논의할 때 실행됩니다.`,
        pl: `Wykonywane, gdy dwie postacie dyskutują o wasalizacji lub jej warunkach.`,
    },
    
    /**
     * @param {GameData} gameData 
     * @param {number} initiatorId
     * @param {number} targetId
     */
    check: (gameData, initiatorId, targetId) => {
        const initiator = gameData.getCharacterById(initiatorId);
        const target = gameData.getCharacterById(targetId);
        if (!initiator || !target) return false;

        let opinionOfInitiator = 0;
        if (initiator.id === gameData.playerID) {
            opinionOfInitiator = target.opinionOfPlayer;
        } else {
            const opinionEntry = target.opinions.find(o => o.id === initiator.id);
            opinionOfInitiator = opinionEntry ? opinionEntry.opinon : 0;
        }

        console.log(`PVAI: ${opinionOfInitiator} ${initiator.isLandedRuler} ${target.isLandedRuler}`)
        
        // Check basic conditions
        if ((opinionOfInitiator >= -30) && (initiator.isLandedRuler) && (target.isLandedRuler)){
            // Check if AI has the vassalization debate score trait
            if (target.hasTrait("VassalizationDebateScore")) {
                let targetScore = Number(target.traits.find(trait => trait.name === "VassalizationDebateScore").desc);
                
                if (targetScore >= -15 && targetScore <= 25) {
                    const probability = Math.min(0.95, 0.5 + (targetScore + 15) * 0.02);
                    return Math.random() < probability;
                }
                return false;
            }
            else {
                if (opinionOfInitiator > 10) {
                    target.addTrait({
                        category: "politicalVariable",
                        name: "VassalizationDebateScore",
                        desc: `0`
                    });
                    console.log(`PVAI: Added trait to ${target.shortName}`);
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
     * @param {number} initiatorId
     * @param {number} targetId
     */
    run: (gameData, runGameEffect, args, initiatorId, targetId) => {
        const target = gameData.getCharacterById(targetId);
        if (!target) return;
        
        console.log(`PVAI: score: ${target.traits.find(trait => trait.name === "VassalizationDebateScore").desc}`)
        
        let targetScore = Number(target.traits.find(trait => trait.name === "VassalizationDebateScore").desc) + Number(args[0]);
        console.log(`PVAI: new_score: ${targetScore}`)

        if (targetScore >= 30) {
            runGameEffect(`
                create_title_and_vassal_change = {
                    type = swear_fealty
                    save_scope_as = change
                }
                global_var:votcce_action_target = {
                    change_liege = {
                        liege = global_var:votcce_action_source
                        change = scope:change
                    }
                    add_opinion = {
                        modifier = became_vassal
                        target = global_var:votcce_action_source
                        opinion = 10
                    }
                }
                resolve_title_and_vassal_change = scope:change
            `); 
        } else {
            target.traits.find(trait => trait.name === "VassalizationDebateScore").desc = targetScore;
            runGameEffect(``); 
        }
        args[1] = targetScore
    },

    chatMessage: (args) => {
        let score = args[1]
        console.log(`PVAIchat: score: ${score}`)
        if (score >= 30) {
            console.log(`PVAIchat: if`)
            return {
                en: `{{character2Name}} agreed to become {{character1Name}}'s vassal.`,
                zh: `{{character2Name}}同意成为{{character1Name}}的封臣。`,
                ru: `{{character2Name}} согласился стать вассалом {{character1Name}}.`,
                fr: `{{character2Name}} a accepté de devenir le vassal de {{character1Name}}.`,
                es: `{{character2Name}} acordó convertirse en vasallo de {{character1Name}}.`,
                de: `{{character2Name}} hat zugestimmt, Vasall von {{character1Name}} zu werden.`,
                ja: `{{character2Name}}は{{character1Name}}の封臣になることに同意しました。`,
                ko: `{{character2Name}}가 {{character1Name}}의 봉신이 되는 데 동의했습니다.`,
                pl: `{{character2Name}} zgodził się zostać wasalem {{character1Name}}.`,
            };
        } else {
            console.log(`PVAIchat: else`)
            return {
                en: `Acceptance score: ${score} | Vassalization if >30, breakdown if <-20`,
                zh: `接受分数：${score} | 如果分数>30则封臣化，如果分数<-20则谈判破裂`,
                ru: `Очки принятия: ${score} | Вассализация если >30, провал если <-20`,
                fr: `Score d'acceptation : ${score} | Vassalisation si >30, rupture si <-20`,
                es: `Puntuación de aceptación: ${score} | Vasallización si >30, ruptura si <-20`,
                de: `Akzeptanzwert: ${score} | Vasallisierung wenn >30, Abbruch wenn <-20`,
                ja: `受容スコア: ${score} | 封臣化は>30の場合、交渉決裂は<-20の場合`,
                ko: `수용 점수: ${score} | 봉신화는 >30일 경우, 협상 결렬은 <-20일 경우`,
                pl: `Wynik akceptacji: ${score} | Wasalizacja jeśli >30, załamanie jeśli <-20`,
            };
        }
    },
    
    chatMessageClass: "positive-action-message"
};
