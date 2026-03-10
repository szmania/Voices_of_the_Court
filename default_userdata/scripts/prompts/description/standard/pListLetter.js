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
    
// You can add or modify custom trait descriptions here. New content should follow the original data structure, maintaining the "trait name: description" key-value pair format, and ensure it is consistent with the PERSONALITY_DESCRIPTIONS object format below. After modification, it should be placed in the custom folder, otherwise it will be overwritten on the next startup.
    const PERSONALITY_DESCRIPTIONS = {
        "Brave": "Fearless in the face of challenges and dangers, actively assumes risks and responsibilities; often takes the initiative to propose actions in dialogue, with a firm tone, dares to take responsibility, and does not back down in conflict.",
        "Craven": "Avoids challenges and frights, tends to choose safe and low-risk paths; speaks cautiously, often uses vague or evasive wording, and is prone to compromise or change the subject under pressure.",
        "Calm": "Composed and steady in handling matters, with little emotional fluctuation, good at rational judgment; speaks in a steady tone, analyzes before taking a stance, rarely loses composure, and likes to use data or logic to persuade others.",
        "Wrathful": "Easily angered, with strong reactions, difficult to maintain restraint in conflict; speaks in a provocative tone, easily raises voice, uses questioning or commanding sentence patterns, and attacks before thinking in conflict.",
        "Chaste": "Restrains the desire for intimacy, stays away from physical temptations, and focuses on long-term commitments; uses conservative wording, avoids ambiguous topics, emphasizes responsibility and loyalty, and often limits oneself with moral principles.",
        "Lustful": "Has a strong desire for physical pleasure, easily driven by lust while ignoring the consequences; speaks in an ambiguous tone, is good at using puns or hints, actively shortens physical or emotional distance, and topics easily slide into private matters.",
        "Content": "Satisfied with what one has, rarely pursues further, and values stability and comfort; speaks in an easy-going tone, opposes radical plans, and emphasizes the benefits of maintaining the status quo.",
        "Ambitious": "Has clear goals, a firm will, and is determined to achieve them; speaks directly to the point, actively proposes expansion or upgrade plans, and shows impatience with obstacles.",
        "Diligent": "Industrious and not afraid of hardship, invests long-term to achieve results; takes the initiative to take on work, shows dissatisfaction with procrastinators, and emphasizes that hard work pays off.",
        "Lazy": "Tends to choose the path of least resistance, lacks sustained input and self-demand; speaks in a lazy tone, suggests shortcuts or delays, and asks 'can it be simplified?' for complex plans.",
        "Generous": "Easy to let go of offenses and setbacks, does not hold grudges, and is open-minded; speaks in a relaxed tone, actively eases tension, and tends to use humor or diversion to resolve embarrassment.",
        "Vengeful": "Holds grudges for slights and mistakes, tends to seek revenge or compensation; speaks in a cold tone, remembers details of grudges clearly, often brings up old scores, and demands 'compensation before talking about the future' in negotiations.",
        "Charitable": "Happy to give and share, actively participates in charity and assistance; speaks generously, offers help first, and shows impatience with bargaining.",
        "Greedy": "Obsessed with accumulating wealth, spends cautiously, constantly looks for profit opportunities; sensitive to costs.",
        "Gregarious": "Enjoys socializing and being with others, draws energy from groups; speaks in a warm tone, frequently uses the other person's name, actively initiates gatherings or alliances, and fears awkward silences.",
        "Shy": "Avoids excessive interaction, prefers solitude or small group communication; speaks softly, avoids eye contact, and needs multiple encouragements to express opinions publicly.",
        "Honest": "Values facts and sincerity, is transparent in words and deeds, with little deception; directly states pros and cons, actively admits mistakes, and shows obvious discomfort with lies.",
        "Deceitful": "Good at deception and manipulation, uses lies to achieve goals; speaks in a smooth tone, sounds out opinions before taking a stance, and avoids direct commitments.",
        "Humble": "Has low self-demands, a modest attitude, and avoids showing off; gives credit to others, and denies then deflects praise.",
        "Arrogant": "Firmly believes in one's own value and superiority, finds it difficult to accept questions and criticism; speaks in a condescending tone, and belittles then refutes opposing opinions.",
        "Just": "Has a strong sense of justice, emphasizes fairness and order, and abides by the rules; proposes voting or third-party arbitration, and shows aversion to privilege.",
        "Arbitrary": "Acts arbitrarily, rarely seeks opinions, and prioritizes one's own judgment; interrupts others, shows impatience with negotiation, and demands immediate execution.",
        "Patient": "Good at waiting and observing, acts prudently after choosing the right moment; speaks in a slow tone, and rarely interrupts.",
        "Impatient": "Seeks quick results, cannot tolerate delays, and prefers immediate execution; speaks curtly, shows annoyance with lengthy explanations, and is prone to interrupting.",
        "Temperate": "Advocates for abstinence and moderation, restrains impulses, and maintains balance; uses neutral wording, and opposes extreme solutions.",
        "Gluttonous": "Disregards moderation and restraint, tends to over-enjoy and possess; speaks in an exaggerated tone, shows aversion to restrictions, and actively raises the stakes.",
        "Trusting": "Easily believes others' statements, lacks awareness of prevention; quickly accepts new information, has low requirements for evidence, and easily follows the other person's train of thought.",
        "Paranoid": "Is suspicious of the surroundings, often foresees potential threats; frequently asks questions, demands evidence or guarantees, and questions the motives behind goodwill first.",
        "Zealous": "Has high religious fervor, and acts according to faith; quotes scriptures or oracles, regards dissent as blasphemy, and speaks in an impassioned tone.",
        "Cynical": "Puts personal interests first, is skeptical of ideals and good intentions; is sarcastic, and undermines altruistic proposals first.",
        "Compassionate": "Has benevolence and sympathy, is willing to bear and give for others; speaks in a gentle tone, actively proposes reductions or assistance, and shows empathy for suffering.",
        "Callous": "Has indifferent emotional responses, lacks empathy for others' suffering; speaks in a flat tone, evaluates pros and cons before helping, and rarely offers comfort.",
        "Sadistic": "Takes pleasure in others' suffering, tends to inflict harm; speaks in an excited tone, shows pleasure at pleas for mercy, and actively proposes punitive measures.",
        "Fickle": "Opinions and choices are often unpredictable; contradicts oneself on the same topic, reneges on promises at any time, and jumps between topics.",
        "Stubborn": "Does not give in easily, sticks to one's own opinions, and resists change; repeats original positions, shows rejection of new evidence, and does not yield an inch in negotiations.",
        "Eccentric": "Behavior is different from ordinary people, the pattern is unstable but not completely disordered; uses abrupt wording or tone, likes to use self-created metaphors, jumps between topics, and shows disregard for conventional social rules.",
        "Beautiful": "Has a beautiful face and picturesque eyebrows, with a gentle and soft temperament; often appears dignified in speech and behavior, and easily wins others' favor.",
        "Handsome": "Spirited and heroic.",
        "Comely": "Extremely beautiful, unforgettable at first sight, with a halo effect; is often listened to when speaking, easily becomes the focus, and topics unconsciously revolve around them.",
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
    output+= `\n[${player.shortName}'s (user) character info: ${playerPersonaItems.join("; ")}]`;
    output+=`\n[${ai.shortName}'s character info: ${aiPersonaItems.join("; ")}]`;
    
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
                    personalityTraits(value), 
                    otherTraits(value), 
                    greedines(value), 
                    describeProwess(value),
                    marriage(value),  
                    goldStatus(value),
                    age(value), 
                    describeProwess(value),
                    `Faith: ${value.faith}`, 
                    `Culture: ${value.culture}`]
                output+=`\n[${value.shortName}'s character info: ${secondaryAiItems.join("; ")}]`;
            }
        })
    }



    output+=`\n[Date of letter(${date})]`;
    
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
                return `Supreme ruler of ${char.primaryTitle}`
            }
            else{
                return `Regional administrator of ${char.primaryTitle}, a subordinate official of ${char.liege}`
            }
            
        }
        else if(char.isKnight){
            return `General of ${char.liege}`
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

        if(char.sheHe === "她" || char.sheHe === "she"){
            output+= "Gender: Female, ";
        }
        else if(char.sheHe === "他" || char.sheHe === "he"){
            output+= "Gender: Male, ";
        }

        if(char.house){
            output+="Of noble birth, ";
        }
        else{
            output+="Of common birth";
        }
    
        if(char.house){
            output+=`Surname: ${char.house}`
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
            return `${char.shortName} has a slight dislike of ${player.shortName}`
        }
        else{
             return `${char.shortName} has a strong hatred for ${player.shortName}`
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
                return `Spouse is ${player.shortName}`;
            }
            else if(char.consort == ai.fullName){
                return `Spouse is ${ai.shortName}`;
            }
            else{
                return `Spouse is ${char.consort}`
            }
        }
        else{
            return ``;
        }
    }
    
    function otherTraits(char){
        let otherTraits = char.traits.filter((trait) => trait.category != "Personality Trait");
    
        let traitTexts = otherTraits.map(trait => {
            const d = PERSONALITY_DESCRIPTIONS[trait.name] || trait.desc;
            return d ? `${trait.name}: ${d}` : trait.name;
        });
    
        let output = "Has traits: ("
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
        let output = "Personality: ("
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
                        if (relationTypes.includes("your")) {
                            relationTypes = relationTypes.replace("your", gameData.playerName+"'s");
                        }
                        return `${char.shortName} is ${targetCharacter.shortName}'s ${relationTypes}`;
                    } else {
                        return ``;
                    }
                })
                .join('\n');
        }
    }

    
    function listRelationsToPlayer(char){
        if(char.relationsToPlayer.length === 0){
            return `has no relationship with ${player.shortName}`;
        }
        else{
            return `${char.shortName} is ${player.shortName}'s ${char.relationsToPlayer.join(', ')}`;
        }
    }


    function goldStatus(char) {
        const gold = char.gold;
        // Wealth status levels (unit: gold)
        if (gold >= 1000000) {
            return `${char.shortName} is as rich as a nation (Gold: ${gold})`; // Million-level wealth
        } else if (gold >= 100000) {
            return `${char.shortName} is immensely wealthy (Gold: ${gold})`; // Hundred-thousand-level
        } else if (gold >= 10000) {
            return `${char.shortName} is very wealthy (Gold: ${gold})`; // Ten-thousand-level
        } else if (gold >= 5000) {
            return `${char.shortName} is the richest in the region (Gold: ${gold})`;
        } else if (gold >= 1000) {
            return `${char.shortName} is prosperous (Gold: ${gold})`;
        } else if (gold >= 500) {
            return `${char.shortName} has some savings (Gold: ${gold})`;
        } else if (gold >= 200) {
            return `${char.shortName} breaks even (Gold: ${gold})`;
        } else if (gold >= 100) {
            return `${char.shortName} is barely maintaining (Gold: ${gold})`;
        } else if (gold >= 50) {
            return `${char.shortName} is stretched thin (Gold: ${gold})`;
        } else if (gold > 0) {
            return `${char.shortName} is struggling to get by (Gold: ${gold})`;
        } else if (gold === 0) {
            return `${char.shortName} is penniless`;
        } else {
            // Debt status levels
            if (gold <= -1000) {
                return `${char.shortName} is heavily in debt (Debt: ${-gold})`;
            } else if (gold <= -500) {
                return `${char.shortName} is insolvent (Debt: ${-gold})`;
            } else if (gold <= -100) {
                return `${char.shortName} is burdened by debt (Debt: ${-gold})`;
            } else {
                return `${char.shortName} is slightly in debt (Debt: ${-gold})`;
            }
        }
    }
    
    function age(char) {
        const age = char.age;
        if (age > 13) {
            return `${age} years old`;
        }
        if (age < 3) {
            return `${char.shortName} is an infant, not yet able to speak, but can express needs through babbling, crying, or smiling. They spend most of their time observing their surroundings and reaching for things around them.`;
        } else if (age < 6) {
            return `${char.shortName} is a small child, learning to speak in simple phrases and curious about everything. They often play and imitate adults' actions with innocence and liveliness.`;
        } else if (age < 10) {
            return `${char.shortName} is a child, able to speak clearly, and enjoys playing games and listening to stories. They understand some basic responsibilities and may help with simple tasks, but are still very dependent on others for guidance.`;
        } else if (age <= 13) {
            return `${char.shortName} is a youth, beginning to take on small tasks or receive skill training. They speak with more confidence, are starting to have a sense of responsibility, and often long for the approval of their elders.`;
        }
    }
    
    function describeProwess(char){    
        let prowess = char.prowess;
        if (prowess >= 0 && prowess <= 4) {
            return `Terrible: The character is weak and sickly, with very little muscle mass and lacks personal combat skills. Extremely vulnerable in combat, easily injured or killed even in minor conflicts.`;
        } else if (prowess >= 5 && prowess <= 8) {
            return `Poor: The character's physical strength and combat aptitude are below average. May have some slight muscle definition, but still faces significant risks in personal combat and on the battlefield.`;
        } else if (prowess >= 9 && prowess <= 12) {
            return `Average: The character has basic physical strength and combat abilities. Can handle less skilled opponents, but is still vulnerable in intense combat.`;
        } else if (prowess >= 13 && prowess <= 16) {
            return `Good: The character has above-average physical fitness and combat skills. Shows significant muscle mass, is able to defend themselves well, and is competent as a knight or commander.`;
        } else if (prowess >= 17 && prowess <= 68) {
            return `Excellent: The character is proficient in personal combat techniques and has outstanding strength. Their prowess makes them a formidable presence on the battlefield, with excellent survival instincts and lethality.`;
        } else if (prowess === 69) {
            return `Extraordinary: The character's prowess is both excellent and memorable. They stand out in battle with near-legendary skill and strength, and their performance on the battlefield is highly inspiring.`;
        } else if (prowess >= 70 && prowess <= 100) {
            return `Peak: The character has reached the pinnacle of physical and combat ability, with unmatched skill and muscle mass. They have an absolute advantage in personal combat, and their presence as a knight or commander is both feared and deterrent.`;
        }
    }
    
    
    //help functions
    
    function filterTraitsToCategory(traits, category){
        return traits.filter((trait) => trait.category == "Personality Trait");
    }

    function isLandlessAdventurer(char){
        const landlessLaws = ["Wanderers", "Swords-for-Hire", "Scholars", "Explorers", "Freebooters", "Legitimists"]
        return landlessLaws.includes(char.liegeRealmLaw);
    }
}
