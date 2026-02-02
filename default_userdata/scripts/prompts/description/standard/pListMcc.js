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

    const PERSONALITY_DESCRIPTIONS = {
        "Brave": "Fearless in the face of challenge and danger, actively taking risks and responsibilities; often proposes action in dialogue with a firm tone, daring to take responsibility and not backing down from conflict.",
        "Craven": "Avoids challenges and scares, preferring safe and low-risk paths; speaks cautiously, often using vague or evasive wording, easily compromising or shifting topics under pressure.",
        "Calm": "Composed and steady, with little emotional fluctuation, good at rational judgment; speaks in a steady tone, analyzes before taking a stand, rarely loses composure, prefers to persuade others with data or logic.",
        "Wrathful": "Easily provoked, reacts strongly, finds it difficult to remain restrained in conflict; speaks with a touch of hostility, easily raises volume, uses questioning or commanding sentence structures, attacks first and thinks later in conflicts.",
        "Chaste": "Restrains the desire for intimate contact, stays away from physical temptation, focuses on long-term commitment; uses conservative language, avoids ambiguous topics, emphasizes responsibility and loyalty, often limits self with moral standards.",
        "Lustful": "Strong craving for physical pleasure, easily driven by passion while ignoring consequences; speaks in an ambiguous tone, good at using puns or hints, actively closes physical or emotional distance, topics easily slide towards the private.",
        "Content": "Satisfied with what they have, few further pursuits, values stability and comfort; speaks in a relaxed tone, opposes radical plans, emphasizes the benefits of maintaining the status quo.",
        "Ambitious": "Clear goals, firm will, will not stop until the goal is reached; speech points directly to results, actively proposes expansion or upgrade plans, shows impatience with obstacles.",
        "Diligent": "Hardworking, not afraid of hardships, long-term investment to achieve results; actively takes on work, shows dissatisfaction with procrastinators, emphasizes that hard work will pay off.",
        "Lazy": "Tends towards the easiest choice, lacks continuous investment and self-requirement; speaks in a lazy tone, proposes shortcuts or delays, asks \"can it be simplified\" first for complex plans.",
        "Generous": "Easy to let go of offenses and setbacks, holds no grudges, open-minded; speaks in a relaxed tone, actively eases tension, tends to use humor or diversion to resolve awkwardness.",
        "Vengeful": "Broods over slights and mistakes, tends to seek revenge or compensation; speaks in a cold tone, remembers details of grudges clearly, often reminds of old accounts, demands \"compensation before talking about the future\" in negotiations.",
        "Charitable": "Willing to give and share, actively participates in charity and assistance; speaks boldly, offers help first, shows impatience with bargaining.",
        "Greedy": "Obsessed with wealth accumulation, spends cautiously, constantly looking for profit opportunities; sensitive to costs.",
        "Gregarious": "Enjoys socializing and being with others, draws energy from the group; speaks in an enthusiastic tone, frequently calls the other person by name, actively initiates gatherings or alliances, fears silence.",
        "Shy": "Avoids too much interaction, prefers solitude or small-scale communication; speaks softly, avoids eye contact, needs repeated encouragement for public statements.",
        "Honest": "Values facts and sincerity, transparent in words and deeds, rarely deceives; directly states pros and cons, actively admits mistakes, shows obvious discomfort with lies.",
        "Deceitful": "Good at deception and manipulation, uses lies to achieve goals; speaks in a smooth tone, tests the waters before taking a stand, avoids direct commitments.",
        "Humble": "Low self-requirement, modest attitude, avoids boasting and showing off; attributes credit to others, denies praise before shifting it.",
        "Arrogant": "Deeply believes in their own value and superiority, finds it difficult to accept questioning and criticism; speaks in a condescending tone, belittles and then refutes opposing opinions.",
        "Just": "Strong sense of justice, emphasizes fairness and order, abides by rules; proposes voting or third-party arbitration, shows resentment towards privilege.",
        "Arbitrary": "Acts arbitrarily, rarely seeks opinions, puts their own judgment first; interrupts others, shows impatience with consultation, demands immediate execution.",
        "Patient": "Good at waiting and observing, acts steadily after choosing the right moment; speaks in a slow tone, rarely interrupts.",
        "Impatient": "Pursues fast results, finds it difficult to tolerate delays, prefers immediate execution; speaks in short bursts, shows irritability with long explanations, easily interrupts.",
        "Temperate": "Advocates for abstinence and moderation, restrains impulses, maintains balance; uses neutral wording, opposes extreme plans.",
        "Gluttonous": "Disregards moderation and restraint, tends towards excessive enjoyment and possession; speaks in an exaggerated tone, shows resentment towards restrictions, actively increases the stakes.",
        "Trusting": "Easily believes others' statements, lacks awareness of precautions; quickly accepts new information, low requirements for evidence, easily follows the other person's line of thought.",
        "Paranoid": "Suspicious of surroundings, often foresees potential threats; asks frequent questions, demands evidence or guarantees, questions motives behind kindness first.",
        "Zealous": "High religious fervor, uses faith as a guide for action; quotes scriptures or oracles, views dissent as blasphemy, speaks in an excited tone.",
        "Cynical": "Puts personal interests first, suspicious of ideals and good intentions; sarcastic, undermines altruistic proposals first.",
        "Compassionate": "Filled with benevolence and sympathy, willing to take on and give for others; speaks in a soft tone, actively proposes reductions or assistance, empathizes with pain.",
        "Callous": "Indifferent emotional response, lacks resonance with others' pain; speaks in a flat tone, evaluates pros and cons before helping, rarely offers comfort.",
        "Sadistic": "Enjoys others' suffering, tends to inflict harm; speaks in an excited tone, shows pleasure at pleas for mercy, actively proposes punitive plans.",
        "Fickle": "Views and choices often change unpredictably, difficult to predict; contradicts self on the same topic, reneges on promises at any time, topics jump significantly.",
        "Stubborn": "Does not yield easily, sticks to their own views, resists change; repeats original position, rejects new evidence, does not budge an inch in negotiations.",
        "Eccentric": "Behavior differs from ordinary people, patterns are unstable but not completely disordered; uses abrupt words or tones, likes to use self-created metaphors, topics jump, shows disregard for conventional social rules.",
        "Beautiful": "Has a lovely face, picturesque features, carries a gentle and soft temperament; often appears dignified in speech and behavior, easily wins others' favor.",
        "Handsome": "Radiant and spirited, with a heroic bearing.",
        "Comely": "Exquisitely beautiful, unforgettable at first sight, carries a halo effect; often listened to when speaking, easily becomes the focus, topics naturally revolve around them.",
        "Herculean": "Possesses extraordinary physique and strength, exceptionally brave.",
        "Amazon": "Possesses extraordinary physique and strength, exceptionally brave."
    };

    let playerPersonaItems = [
        `id(${player.id})`,
        `Name: ${player.firstName}`,
        mainPosition(player), 
        courtAndCouncilPositions(player), 
        houseAndStatus(player), 
        personalityTraits(player), 
        otherTraits(player), 
        marriage(player),
        describeProwess(player),
        goldStatus(player),
        age(player),
        `Faith: ${player.faith}`, 
        `Culture: ${player.culture}`,
    ];
    
    let aiPersonaItems = [
        `id(${ai.id})`,
        `Name: ${ai.firstName}`,
        mainPosition(ai), 
        courtAndCouncilPositions(ai), 
        listRelationsToPlayer(ai), 
        listRelationsToCharacters(ai),
        houseAndStatus(ai), 
        opinion(ai),
        listOpinionsToCharacters(ai),
        personalityTraits(ai), 
        otherTraits(ai), 
        greedines(ai),
        describeProwess(ai),
        marriage(ai),
        goldStatus(ai),
        age(ai), 
        `Faith: ${ai.faith}`, 
        `Culture: ${ai.culture}`,
    ];
    

    //remove "", null, undefined and 0. 
    playerPersonaItems = playerPersonaItems.filter(function(e){return e}); 
    aiPersonaItems = aiPersonaItems.filter(function(e){return e}); 
    
    let output = "";
    output+= `\n[${player.shortName}'s Persona: ${playerPersonaItems.join("; ")}]`;
    output+=`\n[${ai.shortName}'s Persona: ${aiPersonaItems.join("; ")}]`;
    
    if (gameData.characters.size > 2){
        gameData.characters.forEach((value, key) => {
            if(key !== gameData.playerID && key !== gameData.aiID)
            {
                let secondaryAiItems = [
                    `id(${value.id})`,
                    `Name: ${value.firstName}`,
                    mainPosition(value), 
                    courtAndCouncilPositions(value), 
                    listRelationsToPlayer(value), 
                    listRelationsToCharacters(value),
                    houseAndStatus(value), 
                    opinion(value),
                    listOpinionsToCharacters(value),
                    personalityTraits(value), 
                    otherTraits(value), 
                    greedines(value), 
                    describeProwess(value),
                    marriage(value),  
                    goldStatus(value),
                    age(value), 
                    `Faith: ${value.faith}`, 
                    `Culture: ${value.culture}`]
                output+=`\n[${value.shortName}'s Persona: ${secondaryAiItems.join("; ")}]`;
            }
        })
    }



    output+=`\n[date(${date}), location(${location}), scenario(${scenario()})]`;
    
    return output;
    
    function mainPosition(char){
        if(isLandlessAdventurer(char)){
            if(char.isRuler){
                return `Leader of ${char.primaryTitle}, a group of ${char.liegeRealmLaw}`
            }
            else{
                return `A follower of ${char.liege}, they are a group of ${char.liegeRealmLaw}`
            }
        }
        else if(char.isLandedRuler){
            if(char.isIndependentRuler){
                return `Independent ruler of ${char.primaryTitle}`
            }
            else{
                return `Ruler of ${char.primaryTitle}, vassal of ${char.liege}`
            }
            
        }
        else if(char.isKnight){
            return `Knight of ${char.liege}`
        }        
    }

    function courtAndCouncilPositions(char){
        if(char.heldCourtAndCouncilPositions){
            return `${char.heldCourtAndCouncilPositions} of ${char.liege}`
        }
        else{
            return ``
        }
    }

    function houseAndStatus(char){
        let output="";
        if(char.house){
            output+="noble";
        }
        else{
            output+="lowborn ";
        }
    
        if(char.SheHe === "she"){
            output+= "woman";
        }
        else if(char.SheHe === "he"){
            output+= "man";
        }

        if(char.house){
            output+=` of house ${char.house}`
        }
    
        return output;
    }

    function opinion(char){
        const op = char.opinionOfPlayer;

        if(op>60){
            return `${char.shortName} has a very favorable opinion of ${player.shortName}`
        }
        else if(op>20){
            return `${char.shortName} has a slightly positive opinion of ${player.shortName}`
        }
        else if(op>-20){
            return `${char.shortName} has a neutral opinion of ${player.shortName}`
        }
        else if(op>-60){
            return `${char.shortName} has a slight hatred towards ${player.shortName}`
        }
        else{
             return `${char.shortName} has a very strong hatred towards ${player.shortName}`
        }
    }
    
    
    function greedines(char){
        if(char.greed>75){
            return "very greedy";
        }
        else if(char.greed>50){
            return "greedy";
        }
        else if(char.greed>25){
            return "slightly greedy";
        }
        else{
            return null;
        }
    }
    
    function marriage(char){
        if(char.consort){
            if(char.consort == player.fullName){
                return `married to ${player.shortName}`;
            }
            else if(char.consort == ai.fullName){
                return `married to ${ai.shortName}`;
            }
            else{
                return `married to ${char.consort}`
            }
        }
        else{
            return `unmarried`;
        }
    }
    
    function otherTraits(char){
        let otherTraits = char.traits.filter((trait) => trait.category != "Personality Trait");
    
        let traitTexts = otherTraits.map(trait => {
            const d = PERSONALITY_DESCRIPTIONS[trait.name] || trait.desc;
            return d ? `${trait.name}: ${d}` : trait.name;
        });
    
        let output = "traits("
        output+= traitTexts.join(", ");
        output+=")";
    
        return output;
    }
    
    function personalityTraits(char){
        let personalityTraits = filterTraitsToCategory(char.traits, "Personality Trait");
        let traitTexts = personalityTraits.map(trait => {
            const d = PERSONALITY_DESCRIPTIONS[trait.name] || trait.desc;
            return d ? `${trait.name}: ${d}` : trait.name;
        });
        let output = "personality("
        output+= traitTexts.join(", ");
        output+=")";
    
        return output;
    }
    
    function listRelationsToCharacters(char) {
        if (char.relationsToCharacters.length === 0) {
            return `${char.shortName} has no relations.`;
        } else {
            return char.relationsToCharacters
                .map(relation => {
                    const targetCharacter = gameData.characters.get(relation.id);
                    if (targetCharacter) {
                        let relationTypes = relation.relations.join(', ');
                        if (relationTypes.includes("your")) {
                            relationTypes = relationTypes.replace("your", gameData.playerName+"'s");
                        }
                        return `${char.shortName} is ${relationTypes} for ${targetCharacter.shortName}`;
                    } else {
                        return `${char.shortName} has relations to an unknown character (ID: ${relation.id})`;
                    }
                })
                .join('\n');
        }
    }


    function listOpinionsToCharacters(char) {
        if (gameData.characters.size <= 2) {
            return null; // Not enough characters to analyze opinions
        }  
        return "This are " + char.shortName + "'s opinions about other characters of conversation:" + char.opinions
            .map(opinionData => {
                const targetCharacter = gameData.characters.get(opinionData.id);
                if (targetCharacter && targetCharacter.id !== char.id && targetCharacter.id !== player.id) {
                    const op = opinionData.opinon; // Opinion score
                    if (op > 60) {
                        return `${char.shortName} has a very favorable opinion of ${targetCharacter.shortName}`;
                    } else if (op > 20) {
                        return `${char.shortName} has a slightly positive opinion of ${targetCharacter.shortName}`;
                    } else if (op > -20) {
                        return `${char.shortName} has a neutral opinion of ${targetCharacter.shortName}`;
                    } else if (op > -60) {
                        return `${char.shortName} has a slight hatred towards ${targetCharacter.shortName}`;
                    } else {
                        return `${char.shortName} has a very strong hatred towards ${targetCharacter.shortName}`;
                    }
                } else {
                    return `${char.shortName} has an opinion about an unknown character (ID: ${opinionData.id})`;
                }
            })
            .join('\n');
    }
    
        
    function listRelationsToPlayer(char){
        if(char.relationsToPlayer === 0){
            return `has no relation to ${player.shortName}`;
        }
        else{
            return `${char.shortName} is the ${char.relationsToPlayer.join(', ')} of ${player.shortName}`;
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
                    sceneDescription = `a family meeting convened by ${player.shortName}`;
                    break;
                case "cabinet_meeting_chinese_empire":
                    sceneDescription = `a central meeting convened by ${player.shortName}`;
                    break;
                case "cabinet_meeting":
                case "cabinet_meeting_chinese":
                    sceneDescription = `a cabinet meeting convened by ${player.shortName}`;
                    break;
                case "lingyinsi":
                    sceneDescription = "Lingyin Temple";
                    break;
                case "throneroom_japan":
                    sceneDescription = "Heian Palace";
                    break;
                case "shaolinsidai":
                    sceneDescription = "Shaolin Temple";
                    break;
                case "wudangshandaoguan":
                    sceneDescription = "Wudang Mountain Taoist Temple";
                    break;
                case "yungangshiku":
                    sceneDescription = "Yungang Grottoes";
                    break;
                case "leshandafou":
                    sceneDescription = "Leshan Giant Buddha";
                    break;
                case "taishan":
                    sceneDescription = "Mount Tai";
                    break;
                case "wulingyuan":
                    sceneDescription = "Wulingyuan";
                    break;
                case "kaifenghuangcheng":
                    sceneDescription = "Kaifeng Imperial City";
                    break;
                case "huanghelou":
                    sceneDescription = "Yellow Crane Tower";
                    break;
                case "tengwangge":
                    sceneDescription = "Tengwang Pavilion";
                    break;
                case "yueyanglou":
                    sceneDescription = "Yueyang Tower";
                    break;
                case "bedchamber_east1":
                    sceneDescription = "the bedchamber";
                    break;
                case "garden_east1":
                    sceneDescription = "the Imperial Garden";
                    break;
                case "throneroom_east_fuya1":
                    sceneDescription = "the government office";
                    break;
                case "throneroom_east_fuya":
                    sceneDescription = "the government office";
                    break;
                case "throneroom_east_empire":
                    sceneDescription = "the Imperial Palace Hall";
                    break;
                case "throneroom_east_empire1":
                    sceneDescription = "the Imperial Palace Hall";
                    break;
                case "throneroom":
                    sceneDescription = `${locationController}'s throneroom`;
                    break;
                case "garden":
                    sceneDescription = "the castle garden";
                    break;
                case "bedchamber":
                    sceneDescription = "the private bedchamber";
                    break;
                case "feast":
                    sceneDescription = `the feast hosted by ${locationController}`;
                    break;
                case "armycamp":
                case "army_camp":
                    sceneDescription = "the army camp";
                    break;
                case "hunt":
                    sceneDescription = "the foggy forest";
                    break;
                case "dungeon":
                    sceneDescription = "the dungeon";
                    break;
                case "alley":
                    sceneDescription = "a narrow alley";
                    break;
            }
            
            return `${characterNames} in ${sceneDescription}`;
        }

        switch (scene){
            case "family_meeting_east":
                return `${player.shortName} has convened a family meeting`;
            case "cabinet_meeting_chinese_empire":
                return `${player.shortName} has convened a central meeting`;
            case "cabinet_meeting":
            case "cabinet_meeting_chinese":
                return `${player.shortName} has convened a cabinet meeting`;
            case "lingyinsi":
                return `${ai.shortName} and ${player.shortName} meet at Lingyin Temple`;
            case "throneroom_japan":
                return `${ai.shortName} and ${player.shortName} meet at Heian Palace`;
            case "shaolinsidai":
                return `${ai.shortName} and ${player.shortName} meet at Shaolin Temple`;
            case "wudangshandaoguan":
                return `${ai.shortName} and ${player.shortName} meet at Wudang Mountain Taoist Temple`;
            case "yungangshiku":
                return `${ai.shortName} and ${player.shortName} meet at Yungang Grottoes`;
            case "leshandafou":
                return `${ai.shortName} and ${player.shortName} meet at Leshan Giant Buddha`;
            case "taishan":
                return `${ai.shortName} and ${player.shortName} meet at Mount Tai`;
            case "wulingyuan":
                return `${ai.shortName} and ${player.shortName} meet at Wulingyuan`;
            case "kaifenghuangcheng":
                return `${ai.shortName} and ${player.shortName} meet at Kaifeng Imperial City`;
            case "huanghelou":
                return `${ai.shortName} and ${player.shortName} meet at Yellow Crane Tower`;
            case "tengwangge":
                return `${ai.shortName} and ${player.shortName} meet at Tengwang Pavilion`;
            case "yueyanglou":
                return `${ai.shortName} and ${player.shortName} meet at Yueyang Tower`;
            case "bedchamber_east1":
                return `${ai.shortName} and ${player.shortName} are talking in the bedchamber`;
            case "garden_east1":
                return `${ai.shortName} meets ${player.shortName} in the Imperial Garden`;
            case "throneroom_east_fuya1":
                return `${ai.shortName} pays respects to ${player.shortName} in the government office`;
            case "throneroom_east_fuya":
                return `${ai.shortName} receives ${player.shortName} in the government office`;
            case "throneroom_east_empire":
                return `${ai.shortName} summons ${player.shortName} in the Imperial Palace Hall`;
            case "throneroom_east_empire1":
                return `${ai.shortName} has an audience with ${player.shortName} in the Imperial Palace Hall`;

            case "throneroom":
                return `${ai.shortName} meets ${player.shortName} in ${locationController}'s throneroom.`;
            case "garden":
                return `${ai.shortName} meets ${player.shortName} in ${locationController}'s castle garden.`;
            case "bedchamber":
                return `${ai.shortName} meets ${player.shortName} in their private bedchamber.`;
            case "feast":
                return `${ai.shortName} talks to ${player.shortName} during the feast hosted by ${locationController}.`;
            case "armycamp":
            case "army_camp":
                return `${ai.shortName} meets ${player.shortName} in the army camp.`;
            case "hunt":
                return `${ai.shortName} meets ${player.shortName} while hunting in the foggy forest. Their weapons are bows.`;
            case "dungeon":
                return `${ai.shortName} meets ${player.shortName} in the dungeon, where ${ai.shortName} is held as a prisoner.`;
            case "alley":
                return `${ai.shortName} meets ${player.shortName} in the narrow alley, hidden from everyone`;
        }
    }

    function goldStatus(char) {
        const gold = char.gold;
        // Wealth status levels (unit: gold)
        if (gold >= 1000000) {
            return `${char.shortName} is as wealthy as a nation (gold: ${gold})`; // Millionaire level
        } else if (gold >= 100000) {
            return `${char.shortName} is immensely wealthy (gold: ${gold})`; // Hundred thousand level
        } else if (gold >= 10000) {
            return `${char.shortName} is very wealthy (gold: ${gold})`; // Ten thousand level
        } else if (gold >= 5000) {
            return `${char.shortName} is rich in the region (gold: ${gold})`;
        } else if (gold >= 1000) {
            return `${char.shortName} lives a prosperous life (gold: ${gold})`;
        } else if (gold >= 500) {
            return `${char.shortName} has some savings (gold: ${gold})`;
        } else if (gold >= 200) {
            return `${char.shortName} breaks even (gold: ${gold})`;
        } else if (gold >= 100) {
            return `${char.shortName} barely maintains (gold: ${gold})`;
        } else if (gold >= 50) {
            return `${char.shortName} is stretched thin (gold: ${gold})`;
        } else if (gold > 0) {
            return `${char.shortName} is struggling to survive (gold: ${gold})`;
        } else if (gold === 0) {
            return `${char.shortName} is penniless`;
        } else {
            // Debt status levels
            if (gold <= -1000) {
                return `${char.shortName} is heavily in debt (debt: ${-gold})`;
            } else if (gold <= -500) {
                return `${char.shortName} is insolvent (debt: ${-gold})`;
            } else if (gold <= -100) {
                return `${char.shortName} is burdened with debt (debt: ${-gold})`;
            } else {
                return `${char.shortName} is slightly in debt (debt: ${-gold})`;
            }
        }
    }
    
    function age(char) {
        const age = char.age;
        if (age > 13) {
            return `${age} years old`;
        }
        if (age < 3) {
            return `${char.shortName} is an infant, unable to speak but quick to babble, cry, or smile to convey needs. They spend their time observing and reaching out for what’s near.`;
        } else if (age < 6) {
            return `${char.shortName} is a small child, learning to speak in simple phrases and curious about their surroundings. They play often, imitating the actions of adults with innocence and energy.`;
        } else if (age < 10) {
            return `${char.shortName} is a child, capable of speaking clearly and enjoying games or tales. They understand basic duties and may help with simple tasks, but they still rely heavily on guidance.`;
        } else if (age <= 13) {
            return `${char.shortName} is a preteen, beginning to take on minor tasks or skills training. They speak with more confidence and show a budding sense of duty, often eager to earn approval from elders.`;
        }
    }
    
    function describeProwess(char){    
        let description = `${char.shortName}'s prowess is `;
        let prowess = char.prowess;
        if (prowess >= 0 && prowess <= 4) {
            description = `terrible: This character is physically weak, with little muscle mass and minimal personal combat skills. They are highly vulnerable in battle and likely to be injured or killed even in minor skirmishes.`;
        } else if (prowess >= 5 && prowess <= 8) {
            description = `poor: This character has below-average physical strength and combat aptitude. They may have some muscle definition but are at significant risk in personal combat and on the battlefield.`;
        } else if (prowess >= 9 && prowess <= 12) {
            description = `average: This character has some physical strength and combat ability. They can hold their own in personal combat against less skilled opponents but remain vulnerable in pitched battles.`;
        } else if (prowess >= 13 && prowess <= 16) {
            description = `good: This character is above average in physical strength and combat skills. They show noticeable muscle mass and are capable of defending themselves well in personal combat and as a knight or commander.`;
        } else if (prowess >= 17 && prowess <= 68) {
            description = `excellent: This character is highly skilled in personal combat and possesses significant physical strength. Their prowess makes them a fearsome presence on the battlefield, with a good balance of survival instincts and lethality.`;
        } else if (prowess === 69) {
            description = `nice: This character’s prowess is both exceptional and memorable. They excel in personal combat with an almost legendary balance of skill and strength. Their presence in battle is inspiring.`;
        } else if (prowess >= 70 && prowess <= 100) {
            description = `excellent: This character is at the peak of physical and combat capability, with unmatched skill and muscle mass. They dominate in personal combat, and their presence as a knight or commander is both intimidating and awe-inspiring.`;
        }
    
        return description;
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

