//Made by: Durond
//NOTE: trait descriptions are not included, you should use this with an exMessages script that includes them, like aliChat.

/**@typedef {import('../../../gamedata_typedefs.js').GameData} GameData */
/**@param {GameData} gameData */
module.exports = (gameData) =>{
    const player = gameData.characters.get(gameData.playerID);
    const ai = gameData.characters.get(gameData.aiID);
    const date = gameData.date;
    const location = gameData.location;
    let locationController = gameData.locationController;
    if(locationController === player.fullName){
        locationController = player.shortName;
    }
    else if(locationController === ai.fullName){
        locationController = ai.shortName;
    }
    const scene = gameData.scene;
    const lang = gameData.lang || 'en';

    const T = (key, vars) => {
        return gameData.localize(key, lang, vars);
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
        "勇敢": T('personality_brave'), "怯懦": T('personality_craven'), "冷静": T('personality_calm'),
        "暴怒": T('personality_wrathful'), "忠贞": T('personality_chaste'), "色欲": T('personality_lustful'),
        "安于现状": T('personality_content'), "野心勃勃": T('personality_ambitious'), "勤勉": T('personality_diligent'),
        "懒惰": T('personality_lazy'), "宽宏大量": T('personality_generous'), "睚眦必报": T('personality_vengeful'),
        "慷慨": T('personality_charitable'), "贪婪": T('personality_greedy'), "合群": T('personality_gregarious'),
        "害羞": T('personality_shy'), "诚实": T('personality_honest'), "狡诈": T('personality_deceitful'),
        "谦卑": T('personality_humble'), "傲慢": T('personality_arrogant'), "公正": T('personality_just'),
        "专断": T('personality_arbitrary'), "耐心": T('personality_patient'), "急躁": T('personality_impatient'),
        "节制": T('personality_temperate'), "暴食": T('personality_gluttonous'), "轻信他人": T('personality_trusting'),
        "多疑": T('personality_paranoid'), "狂热": T('personality_zealous'), "愤世嫉俗": T('personality_cynical'),
        "慈悲": T('personality_compassionate'), "冷酷": T('personality_callous'), "虐待狂": T('personality_sadistic'),
        "多变": T('personality_fickle'), "固执": T('personality_stubborn'), "怪客": T('personality_eccentric'),
        "螓首蛾眉": T('personality_beautiful_zh'), "英姿飒爽": T('personality_handsome_zh'), "倾国倾城": T('personality_comely_zh'),
        "海格力斯": T('personality_herculean_zh'), "阿玛宗": T('personality_amazon_zh')
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
    
    if (gameData.characters.size > 2){
        gameData.characters.forEach((value, key) => {
            if(key !== gameData.playerID && key !== gameData.aiID)
            {
                let secondaryAiItems = [
                    `id(${value.id})`,
                    `${T('name')}: ${value.firstName}`,
                    mainPosition(value), 
                    courtAndCouncilPositions(value), 
                    listRelationsToPlayer(value), 
                    listRelationsToCharacters(value),
                    houseAndStatus(value), 
                    opinion(value),
                    personalityTraits(value), 
                    otherTraits(value), 
                    greedines(value), 
                    describeProwess(value),
                    marriage(value),  
                    goldStatus(value),
                    age(value), 
                    describeProwess(value),
                    `${T('faith')}: ${value.faith}`, 
                    `${T('culture')}: ${value.culture}`]
                output+=`\n[${value.shortName}${T('s_persona')}: ${secondaryAiItems.join("; ")}]`;
            }
        })
    }



    output+=`\n[${T('date')}(${date}), ${T('location')}(${location}), ${T('scenario')}(${scenario()})]`;
    
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

        if(op>60){
            return T('opinion_very_favorable', {charShortName: char.shortName, playerShortName: player.shortName});
        }
        else if(op>20){
            return T('opinion_slightly_positive', {charShortName: char.shortName, playerShortName: player.shortName});
        }
        else if(op>-20){
            return T('opinion_neutral', {charShortName: char.shortName, playerShortName: player.shortName});
        }
        else if(op>-60){
            return T('opinion_slight_hatred', {charShortName: char.shortName, playerShortName: player.shortName});
        }
        else{
             return T('opinion_strong_hatred', {charShortName: char.shortName, playerShortName: player.shortName});
        }
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


    function scenario(){
        // If there are more than 2 characters, return all character names in the scene name
        if (gameData.characters.size > 2) {
            const characterNames = Array.from(gameData.characters.values()).map(char => char.shortName).join(', ');
            let sceneDescription = scene; // Default to scene variable

            switch (scene){
                case "family_meeting_east":
                case "family_meeting":
                    sceneDescription = T('scenario_family_meeting', {playerShortName: player.shortName});
                    break;
                case "cabinet_meeting_chinese_empire":
                    sceneDescription = T('scenario_central_meeting', {playerShortName: player.shortName});
                    break;
                case "cabinet_meeting":
                case "cabinet_meeting_chinese":
                    sceneDescription = T('scenario_cabinet_meeting', {playerShortName: player.shortName});
                    break;
                case "lingyinsi":
                    sceneDescription = T('locations.lingyinsi');
                    break;
                case "throneroom_japan":
                    sceneDescription = T('locations.throneroom_japan');
                    break;
                case "shaolinsidai":
                    sceneDescription = T('locations.shaolinsidai');
                    break;
                case "wudangshandaoguan":
                    sceneDescription = T('locations.wudangshandaoguan');
                    break;
                case "yungangshiku":
                    sceneDescription = T('locations.yungangshiku');
                    break;
                case "leshandafou":
                    sceneDescription = T('locations.leshandafou');
                    break;
                case "taishan":
                    sceneDescription = T('locations.taishan');
                    break;
                case "wulingyuan":
                    sceneDescription = T('locations.wulingyuan');
                    break;
                case "kaifenghuangcheng":
                    sceneDescription = T('locations.kaifenghuangcheng');
                    break;
                case "huanghelou":
                    sceneDescription = T('locations.huanghelou');
                    break;
                case "tengwangge":
                    sceneDescription = T('locations.tengwangge');
                    break;
                case "yueyanglou":
                    sceneDescription = T('locations.yueyanglou');
                    break;
                case "bedchamber_east1":
                    sceneDescription = T('locations.bedchamber');
                    break;
                case "garden_east1":
                    sceneDescription = T('locations.imperial_garden');
                    break;
                case "throneroom_east_fuya1":
                case "throneroom_east_fuya":
                    sceneDescription = T('locations.government_office');
                    break;
                case "throneroom_east_empire":
                case "throneroom_east_empire1":
                    sceneDescription = T('locations.imperial_palace_hall');
                    break;
                case "throneroom":
                    sceneDescription = T('scenario_throneroom', {locationController: locationController});
                    break;
                case "garden":
                    sceneDescription = T('locations.castle_garden');
                    break;
                case "bedchamber":
                    sceneDescription = T('locations.private_bedchamber');
                    break;
                case "feast":
                    sceneDescription = T('scenario_feast', {locationController: locationController});
                    break;
                case "armycamp":
                case "army_camp":
                    sceneDescription = T('locations.army_camp');
                    break;
                case "hunt":
                    sceneDescription = T('locations.foggy_forest');
                    break;
                case "dungeon":
                    sceneDescription = T('locations.dungeon');
                    break;
                case "alley":
                    sceneDescription = T('locations.narrow_alley');
                    break;
                case "market":
                    sceneDescription = T('locations.bustling_market');
                    break;
            }

            return `${characterNames} ${T('in')} ${sceneDescription}`;
        }

        switch (scene){
            case "family_meeting_east":
            case "family_meeting":
                return T('scenario_family_meeting_convened', {playerShortName: player.shortName});
            case "cabinet_meeting_chinese_empire":
                return T('scenario_central_meeting_convened', {playerShortName: player.shortName});
            case "cabinet_meeting":
            case "cabinet_meeting_chinese":
                return T('scenario_cabinet_meeting_convened', {playerShortName: player.shortName});
            case "lingyinsi":
                return T('scenario_meet_at', {aiShortName: ai.shortName, playerShortName: player.shortName, location: T('locations.lingyinsi')});
            case "throneroom_japan":
                return T('scenario_meet_at', {aiShortName: ai.shortName, playerShortName: player.shortName, location: T('locations.throneroom_japan')});
            case "shaolinsidai":
                return T('scenario_meet_at', {aiShortName: ai.shortName, playerShortName: player.shortName, location: T('locations.shaolinsidai')});
            case "wudangshandaoguan":
                return T('scenario_meet_at', {aiShortName: ai.shortName, playerShortName: player.shortName, location: T('locations.wudangshandaoguan')});
            case "yungangshiku":
                return T('scenario_meet_at', {aiShortName: ai.shortName, playerShortName: player.shortName, location: T('locations.yungangshiku')});
            case "leshandafou":
                return T('scenario_meet_at', {aiShortName: ai.shortName, playerShortName: player.shortName, location: T('locations.leshandafou')});
            case "taishan":
                return T('scenario_meet_at', {aiShortName: ai.shortName, playerShortName: player.shortName, location: T('locations.taishan')});
            case "wulingyuan":
                return T('scenario_meet_at', {aiShortName: ai.shortName, playerShortName: player.shortName, location: T('locations.wulingyuan')});
            case "kaifenghuangcheng":
                return T('scenario_meet_at', {aiShortName: ai.shortName, playerShortName: player.shortName, location: T('locations.kaifenghuangcheng')});
            case "huanghelou":
                return T('scenario_meet_at', {aiShortName: ai.shortName, playerShortName: player.shortName, location: T('locations.huanghelou')});
            case "tengwangge":
                return T('scenario_meet_at', {aiShortName: ai.shortName, playerShortName: player.shortName, location: T('locations.tengwangge')});
            case "yueyanglou":
                return T('scenario_meet_at', {aiShortName: ai.shortName, playerShortName: player.shortName, location: T('locations.yueyanglou')});
            case "bedchamber_east1":
                return T('scenario_talking_in', {aiShortName: ai.shortName, playerShortName: player.shortName, location: T('locations.bedchamber')});
            case "garden_east1":
                return T('scenario_meet_in', {aiShortName: ai.shortName, playerShortName: player.shortName, location: T('locations.imperial_garden')});
            case "throneroom_east_fuya1":
                return T('scenario_pays_respects', {aiShortName: ai.shortName, playerShortName: player.shortName, location: T('locations.government_office')});
            case "throneroom_east_fuya":
                return T('scenario_receives', {aiShortName: ai.shortName, playerShortName: player.shortName, location: T('locations.government_office')});
            case "throneroom_east_empire":
                return T('scenario_summons', {aiShortName: ai.shortName, playerShortName: player.shortName, location: T('locations.imperial_palace_hall')});
            case "throneroom_east_empire1":
                return T('scenario_audience_with', {aiShortName: ai.shortName, playerShortName: player.shortName, location: T('locations.imperial_palace_hall')});
            case "throneroom":
                return T('scenario_meet_in_controller', {aiShortName: ai.shortName, playerShortName: player.shortName, locationController: locationController, location: T('locations.throneroom')});
            case "garden":
                return T('scenario_meet_in_controller', {aiShortName: ai.shortName, playerShortName: player.shortName, locationController: locationController, location: T('locations.castle_garden')});
            case "bedchamber":
                return T('scenario_meet_in_private', {aiShortName: ai.shortName, playerShortName: player.shortName, location: T('locations.private_bedchamber')});
            case "feast":
                return T('scenario_talks_during_feast', {aiShortName: ai.shortName, playerShortName: player.shortName, locationController: locationController});
            case "armycamp":
            case "army_camp":
                return T('scenario_meet_in', {aiShortName: ai.shortName, playerShortName: player.shortName, location: T('locations.army_camp')});
            case "hunt":
                return T('scenario_hunt', {aiShortName: ai.shortName, playerShortName: player.shortName});
            case "dungeon":
                return T('scenario_dungeon', {aiShortName: ai.shortName, playerShortName: player.shortName});
            case "alley":
                return T('scenario_alley', {aiShortName: ai.shortName, playerShortName: player.shortName});
            case "market":
                return T('scenario_market', {aiShortName: ai.shortName, playerShortName: player.shortName});
            default:
                return T('scenario_default', {aiShortName: ai.shortName, playerShortName: player.shortName, location: location});
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
