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
    const T = (text) => gameData.localize(text, lang);
    
    let playerPersonaItems = [,
        mainPosition(player), 
        courtAndCouncilPositions(player), 
        houseAndStatus(player), 
        personalityTraits(player), 
        otherTraits(player), 
        marriage(player), 
        family(player),
        `${T('age')}(${player.age})`, 
        `${T('faith')}(${player.faith})`, 
        `${T('culture')}(${player.culture})`,
        `${T('wealth')}(${player.gold} ${T('gold')})`
    ];
    
    let aiPersonaItems = [,
        mainPosition(ai), 
        courtAndCouncilPositions(ai), 
        listRelationsToPlayer(ai), 
        houseAndStatus(ai), 
        opinion(ai), 
        personalityTraits(ai), 
        otherTraits(ai), 
        greedines(ai), 
        marriage(ai),  
        family(ai),
        `${T('age')}(${ai.age})`, 
        `${T('faith')}(${ai.faith})`, 
        `${T('culture')}(${ai.culture})`,
        `${T('wealth')}(${ai.gold} ${T('gold')})`
    ];
    
    //remove "", null, undefined and 0. 
    playerPersonaItems = playerPersonaItems.filter(function(e){return e}); 
    aiPersonaItems = aiPersonaItems.filter(function(e){return e}); 
    
    let output = "";
    output+= `\n[${player.shortName}${T('s_persona')}: ${playerPersonaItems.join("; ")}]`;
    output+=`\n[${ai.shortName}${T('s_persona')}: ${aiPersonaItems.join("; ")}]`;
    output+=`\n[${T('date')}(${date}), ${T('location')}(${location}), ${T('scenario')}(${scenario()})]`;
    
    return output;
    
    function mainPosition(char){
        if(isLandlessAdventurer(char)){
            if(char.isRuler){
                return `${T('leader_of')} ${char.primaryTitle}, ${T('a_group_of')} ${char.liegeRealmLaw}`
            }
            else{
                return `${T('a_follower_of')} ${char.liege}, ${T('they_are_a_group_of')} ${char.liegeRealmLaw}`
            }
        }
        else if(char.isLandedRuler){
            if(char.isIndependentRuler){
                return `${T('independent_ruler_of')} ${char.primaryTitle}`
            }
            else{
                return `${T('ruler_of')} ${char.primaryTitle}, ${T('vassal_of')} ${char.liege}`
            }
            
        }
        else if(char.isKnight){
            return `${T('knight_of')} ${char.liege}`
        }        
    }

    function courtAndCouncilPositions(char){
        if(char.heldCourtAndCouncilPositions){
            return `${char.heldCourtAndCouncilPositions} ${T('of')} ${char.liege}`
        }
        else{
            return ``
        }
    }

    function houseAndStatus(char){
        let output="";
        if(char.house){
            output+=T('noble');
        }
        else{
            output+=T('lowborn') + " ";
        }
    
        if(char.sheHe === "she" || char.sheHe === "她"){
            output+= T('woman');
        }
        else if(char.sheHe === "he" || char.sheHe === "他"){
            output+= T('man');
        }

        if(char.house){
            output+=` ${T('of_house')} ${char.house}`
        }
    
        return output;
    }

    function opinion(char){
        const op = char.opinionOfPlayer;

        if(op>60){
            return `${char.shortName} ${T('opinion_very_favorable')} ${player.shortName}`
        }
        else if(op>20){
            return `${char.shortName} ${T('opinion_slightly_positive')} ${player.shortName}`
        }
        else if(op>-20){
            return `${char.shortName} ${T('opinion_neutral')} ${player.shortName}`
        }
        else if(op>-60){
            return `${char.shortName} ${T('opinion_slight_hatred')} ${player.shortName}`
        }
        else{
             return `${char.shortName} ${T('opinion_strong_hatred')} ${player.shortName}`
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
                return `${T('married_to')} ${player.shortName}`;
            }
            else if(char.consort == ai.fullName){
                return `${T('married_to')} ${ai.shortName}`;
            }
            else{
                return `${T('married_to')} ${char.consort}`
            }
        }
        else{
            return T('unmarried');
        }
    }
    
    function family(char){
        const familyDesc = char.getFamilyDescription();
        if(familyDesc){
            return familyDesc;
        }
        else{
            return null;
        }
    }
    
    function otherTraits(char){
        let otherTraits = char.traits.filter((trait) => trait.category != "Personality Trait");
    
        let traitNames = otherTraits.map(trait => trait.name);
    
        let output = `${T('traits')}(`
        output+= traitNames.join(", ");
        output+=")";
    
        return output;
    }
    
    function personalityTraits(char){
        let personalityTraits = filterTraitsToCategory(char.traits, "Personality Trait");
    
        let traitNames = personalityTraits.map(trait => trait.name);
    
        let output = `${T('personality')}(`
        output+= traitNames.join(", ");
        output+=")";
    
        return output;
    }
    
    function listRelationsToPlayer(char){
        if(char.relationsToPlayer.length === 0){
            return `${T('has_no_relation_to')} ${player.shortName}`;
        }
        else{
            return `${char.shortName} ${T('is_the')} ${char.relationsToPlayer.join(', ')} ${T('of')} ${player.shortName}`;
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
    
    
    }
    
    
    //help functions
    
    function filterTraitsToCategory(traits, category){
        return traits.filter((trait) => trait.category == category);
    }

    function isLandlessAdventurer(char){
        const landlessLaws = ["Wanderers", "Swords-for-Hire", "Scholars", "Explorers", "Freebooters", "Legitimists"]
        return landlessLaws.includes(char.liegeRealmLaw);
    }
