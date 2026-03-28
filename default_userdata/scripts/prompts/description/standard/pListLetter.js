//Made by: Durond
//NOTE: trait descriptions are not included, you should use this with an exMessages script that includes them, like aliChat.

/**@typedef {import('../../../gamedata_typedefs.js').GameData} GameData */
/**@param {GameData} gameData */
module.exports = (gameData) =>{
    const player = gameData.characters.get(gameData.playerID);
    const ai = gameData.characters.get(gameData.aiID);

    if (!player || !ai) {
        return "";
    }

    const date = gameData.date;
    const lang = gameData.lang || 'en';

    const T = (key, vars) => {
        if (typeof gameData.localize === 'function') {
            return gameData.localize(key, lang, vars);
        }
        console.warn('gameData.localize is not a function. Falling back to key.');
        return key;
    };

    const PERSONALITY_DESCRIPTIONS = {
        "Brave": T('personality_brave'), "Craven": T('personality_craven'), "Calm": T('personality_calm'),
        "Wrathful": T('personality_wrathful'), "Chaste": T('personality_chaste'), "Lustful": T('personality_lustful'),
        "Content": T('personality_content'), "Ambitious": T('personality_ambitious'), "Diligent": T('personality_diligent'),
        "Lazy": T('personality_lazy'), "Generous": T('personality_generous'), "Vengeful": T('personality_vengeful'),
        "Charitable": T('personality_charitable'), "Greedy": T('personality_greedy'), "Gregarious": T('personality_gregarious'),
        "Shy": T('personality_shy'), "Honest": T('personality_honest'), "Deceitful": T('personality_deceitful'),
        "Humble": T('personality_humble'), "Arrogant": T('personality_arrogant'), "Just": T('personality_just'),
        "Arbitrary": T('personality_arbitrary'), "Patient": T('personality_patient'), "Impatient": T('personality_impatient'),
        "Temperate": T('personality_temperate'), "Gluttonous": T('personality_gluttonous'), "Trusting": T('personality_trusting'),
        "Paranoid": T('personality_paranoid'), "Zealous": T('personality_zealous'), "Cynical": T('personality_cynical'),
        "Compassionate": T('personality_compassionate'), "Callous": T('personality_callous'), "Sadistic": T('personality_sadistic'),
        "Fickle": T('personality_fickle'), "Stubborn": T('personality_stubborn'), "Eccentric": T('personality_eccentric'),
        "Beautiful": T('personality_beautiful'), "Handsome": T('personality_handsome'), "Comely": T('personality_comely'),
        "Herculean": T('personality_herculean'), "Amazon": T('personality_amazon'),
    };

    let playerPersonaItems = [
        `id(${player.id})`,
        `${T('name')}: ${player.firstName}`,
        mainPosition(player), 
        courtAndCouncilPositions(player), 
        houseAndStatus(player), 
        personalityTraits(player), 
        otherTraits(player), 
        marriage(player),
        describeProwess(player),
        goldStatus(player),
        age(player),
        `${T('faith')}: ${player.faith}`, 
        `${T('culture')}: ${player.culture}`,
    ];
    
    let aiPersonaItems = [
        `id(${ai.id})`,
        `${T('name')}: ${ai.firstName}`,
        mainPosition(ai), 
        courtAndCouncilPositions(ai), 
        listRelationsToPlayer(ai), 
        listRelationsToCharacters(ai),
        houseAndStatus(ai), 
        opinion(ai),
        personalityTraits(ai), 
        otherTraits(ai), 
        greedines(ai),
        describeProwess(ai),
        marriage(ai),
        goldStatus(ai),
        age(ai), 
        `${T('faith')}: ${ai.faith}`, 
        `${T('culture')}: ${ai.culture}`,
    ];
    

    //remove "", null, undefined and 0. 
    playerPersonaItems = playerPersonaItems.filter(function(e){return e}); 
    aiPersonaItems = aiPersonaItems.filter(function(e){return e}); 
    
    let output = "";
    output+= `\n[${player.shortName}${T('s_persona_user')}: ${playerPersonaItems.join("; ")}]`;
    output+=`\n[${ai.shortName}${T('s_persona')}: ${aiPersonaItems.join("; ")}]`;
    
    const otherCharacters = gameData.getOtherCharacters();
    if (otherCharacters.length > 0){
        otherCharacters.forEach(char => {
            let secondaryAiItems = [
                `id(${char.id})`,
                `${T('name')}: ${char.firstName}`,
                mainPosition(char), 
                courtAndCouncilPositions(char), 
                listRelationsToPlayer(char), 
                listRelationsToCharacters(char),
                houseAndStatus(char), 
                opinion(char),
                personalityTraits(char), 
                otherTraits(char), 
                greedines(char), 
                describeProwess(char),
                marriage(char),  
                goldStatus(char),
                age(char), 
                describeProwess(char),
                `${T('faith')}: ${char.faith}`, 
                `${T('culture')}: ${char.culture}`]
            output+=`\n[${char.shortName}${T('s_persona')}: ${secondaryAiItems.join("; ")}]`;
        })
    }



    output+=`\n[${T('letter_issue_date')}(${date})]`;
    
    return output;
    
    function mainPosition(char){
        if(isLandlessAdventurer(char)){
            if(char.isRuler){
                return T('main_position_landless_ruler', {primaryTitle: char.primaryTitle, liegeRealmLaw: char.liegeRealmLaw});
            }
            else{
                return T('main_position_landless_follower', {liege: char.liege, liegeRealmLaw: char.liegeRealmLaw});
            }
        }
        else if(char.isLandedRuler){
            if(char.isIndependentRuler){
                return T('main_position_independent_ruler', {primaryTitle: char.primaryTitle});
            }
            else{
                return T('main_position_landed_vassal', {primaryTitle: char.primaryTitle, liege: char.liege});
            }
            
        }
        else if(char.isKnight){
            return T('main_position_knight', {liege: char.liege});
        }        
    }

    function courtAndCouncilPositions(char){
        if(char.heldCourtAndCouncilPositions){
            return T('court_position', {position: char.heldCourtAndCouncilPositions, liege: char.liege});
        }
        else{
            return ``;
        }
    }

    function houseAndStatus(char){
        let output="";

        if(char.sheHe === "她" || char.sheHe === "she"){
            output+= `${T('gender')}: ${T('female')}, `;
        }
        else if(char.sheHe === "他" || char.sheHe === "he"){
            output+= `${T('gender')}: ${T('male')}, `;
        }

        if(char.house){
            output+=`${T('noble_birth')}, `;
        }
        else{
            output+=`${T('common_birth')}`;
        }
    
        if(char.house){
            output+=`${T('surname')}: ${char.house}`
        }
    
        return output;
    }

    function opinion(char){
        const op = char.opinionOfPlayer;
        const sign = op >= 0 ? '+' : '';
        let label;
        if(op>60) label = T('opinion_very_favorable', {charShortName: char.shortName, playerShortName: player.shortName});
        else if(op>20) label = T('opinion_slightly_positive', {charShortName: char.shortName, playerShortName: player.shortName});
        else if(op>-20) label = T('opinion_neutral', {charShortName: char.shortName, playerShortName: player.shortName});
        else if(op>-60) label = T('opinion_slight_hatred', {charShortName: char.shortName, playerShortName: player.shortName});
        else label = T('opinion_strong_hatred', {charShortName: char.shortName, playerShortName: player.shortName});

        let result = `${label} (${sign}${op})`;
        if(char.opinionBreakdownToPlayer && char.opinionBreakdownToPlayer.length > 0){
            const breakdown = char.opinionBreakdownToPlayer
                .map(m => `${m.reason}: ${m.value >= 0 ? '+' : ''}${m.value}`)
                .join(', ');
            result += ` [reasons: ${breakdown}]`;
        }
        return result;
    }

    
    function greedines(char){
        if(char.greed>75){
            return T('very_greedy');
        }
        else if(char.greed>50){
            return T('greedy');
        }
        else if(char.greed>25){
            return T('slightly_greedy');
        }
        else{
            return null;
        }
    }
    
    function marriage(char){
        if(char.consort){
            if(char.consort == player.fullName){
                return T('spouse_is', {spouseName: player.shortName});
            }
            else if(char.consort == ai.fullName){
                return T('spouse_is', {spouseName: ai.shortName});
            }
            else{
                return T('spouse_is', {spouseName: char.consort});
            }
        }
        else{
            return ``;
        }
    }
    
    function otherTraits(char){
        let otherTraits = char.traits.filter((trait) => trait.category != T('personality_trait_category') && trait.category != "Personality Trait");
    
        let traitTexts = otherTraits.map(trait => {
            const d = PERSONALITY_DESCRIPTIONS[trait.name] || trait.desc;
            return d ? `${trait.name}: ${d}` : trait.name;
        });
    
        let output = `${T('has_traits')}: (`
        output+= traitTexts.join(", ");
        output+=")";
    
        return output;
    }
    
    function personalityTraits(char){
        let personalityTraits = filterTraitsToCategory(char.traits, T('personality_trait_category'));
        if (personalityTraits.length === 0) {
            personalityTraits = filterTraitsToCategory(char.traits, "Personality Trait");
        }
        let traitTexts = personalityTraits.map(trait => {
            const d = PERSONALITY_DESCRIPTIONS[trait.name] || trait.desc;
            return d ? `${trait.name}: ${d}` : trait.name;
        });
        let output = `${T('personality')}: (`
        output+= traitTexts.join(", ");
        output+=")";
    
        return output;
    }
    
    function listRelationsToCharacters(char) {
        if (char.relationsToCharacters.length === 0) {
            return ` `;
        } else {
            return char.relationsToCharacters
                .map(relation => {
                    const targetCharacter = gameData.characters.get(relation.id);
                    if (targetCharacter) {
                        let relationTypes = relation.relations.join(', ');
                        if (relationTypes.includes(T('your_relation'))) {
                            relationTypes = relationTypes.replace(T('your_relation'), gameData.playerName+"'s");
                        }
                        return T('is_relation_to', {charShortName: char.shortName, targetShortName: targetCharacter.shortName, relations: relationTypes});
                    } else {
                        return ``;
                    }
                })
                .join('\n');
        }
    }

    
    function listRelationsToPlayer(char){
        if(char.relationsToPlayer.length === 0){
            return T('has_no_relation_to', {playerShortName: player.shortName});
        }
        else{
            return T('is_relation_of_player', {charShortName: char.shortName, playerShortName: player.shortName, relations: char.relationsToPlayer.join(', ')});
        }
    }


    function goldStatus(char) {
        const gold = char.gold;
        if (gold >= 1000000) {
            return T('gold_status_nation', {shortName: char.shortName, gold: gold});
        } else if (gold >= 100000) {
            return T('gold_status_immensely_wealthy', {shortName: char.shortName, gold: gold});
        } else if (gold >= 10000) {
            return T('gold_status_very_wealthy', {shortName: char.shortName, gold: gold});
        } else if (gold >= 5000) {
            return T('gold_status_region_rich', {shortName: char.shortName, gold: gold});
        } else if (gold >= 1000) {
            return T('gold_status_prosperous', {shortName: char.shortName, gold: gold});
        } else if (gold >= 500) {
            return T('gold_status_some_savings', {shortName: char.shortName, gold: gold});
        } else if (gold >= 200) {
            return T('gold_status_breaks_even', {shortName: char.shortName, gold: gold});
        } else if (gold >= 100) {
            return T('gold_status_barely_maintains', {shortName: char.shortName, gold: gold});
        } else if (gold >= 50) {
            return T('gold_status_stretched_thin', {shortName: char.shortName, gold: gold});
        } else if (gold > 0) {
            return T('gold_status_struggling', {shortName: char.shortName, gold: gold});
        } else if (gold === 0) {
            return T('gold_status_penniless', {shortName: char.shortName});
        } else {
            if (gold <= -1000) {
                return T('debt_status_heavily', {shortName: char.shortName, debt: -gold});
            } else if (gold <= -500) {
                return T('debt_status_insolvent', {shortName: char.shortName, debt: -gold});
            } else if (gold <= -100) {
                return T('debt_status_burdened', {shortName: char.shortName, debt: -gold});
            } else {
                return T('debt_status_slightly', {shortName: char.shortName, debt: -gold});
            }
        }
    }
    
    function age(char) {
        const age = char.age;
        if (age > 13) {
            return `${age} ${T('years_old')}`;
        }
        if (age < 3) {
            return T('age_infant', {shortName: char.shortName});
        } else if (age < 6) {
            return T('age_small_child', {shortName: char.shortName});
        } else if (age < 10) {
            return T('age_child', {shortName: char.shortName});
        } else if (age <= 13) {
            return T('age_preteen', {shortName: char.shortName});
        }
    }
    
    function describeProwess(char){    
        let prowess = char.prowess;
        if (prowess >= 0 && prowess <= 4) {
            return T('prowess_terrible');
        } else if (prowess >= 5 && prowess <= 8) {
            return T('prowess_poor');
        } else if (prowess >= 9 && prowess <= 12) {
            return T('prowess_average');
        } else if (prowess >= 13 && prowess <= 16) {
            return T('prowess_good');
        } else if (prowess >= 17 && prowess <= 68) {
            return T('prowess_excellent');
        } else if (prowess === 69) {
            return T('prowess_nice');
        } else if (prowess >= 70 && prowess <= 100) {
            return T('prowess_peak');
        }
    }
    
    
    //help functions
    
    function filterTraitsToCategory(traits, category){
        return traits.filter((trait) => trait.category == category);
    }

    function isLandlessAdventurer(char){
        const landlessLaws = ["Wanderers", "Swords-for-Hire", "Scholars", "Explorers", "Freebooters", "Legitimists"]
        return landlessLaws.includes(char.liegeRealmLaw);
    }
}
