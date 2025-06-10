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
    
    let playerPersonaItems = [
        `id(${player.id})`,
        mainPosition(player), 
        courtAndCouncilPositions(player), 
        houseAndStatus(player), 
        personalityTraits(player), 
        otherTraits(player), 
        marriage(player),
        describeProwess(player),
        goldStatus(player),
        age(player),
        `信仰： ${player.faith}`, 
        `民族： ${player.culture}`,
    ];
    
    let aiPersonaItems = [
        `id(${ai.id})`,
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
        `信仰： ${ai.faith}`, 
        `民族： ${ai.culture}`,
    ];
    

    //remove "", null, undefined and 0. 
    playerPersonaItems = playerPersonaItems.filter(function(e){return e}); 
    aiPersonaItems = aiPersonaItems.filter(function(e){return e}); 
    
    let output = "";
    output+= `\n[${player.house}${player.firstName}的角色信息: ${playerPersonaItems.join("; ")}]`;
    output+=`\n[${ai.house}${ai.firstName}的角色信息: ${aiPersonaItems.join("; ")}]`;
    
    if (gameData.characters.size > 2){
        gameData.characters.forEach((value, key) => {
            if(key !== gameData.playerID && key !== gameData.aiID)
            {
                let secondaryAiItems = [
                    `id(${value.id})`,
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
                    `信仰：${value.faith}`, 
                    `民族：${value.culture}`]
                output+=`\n[${value.house}${value.firstName}的角色信息: ${secondaryAiItems.join("; ")}]`;
            }
        })
    }



    output+=`\n[日期(${date}), 位置(${location}), 对话场景(${scenario()})]`;
    
    return output;
    
    function mainPosition(char){
        if(isLandlessAdventurer(char)){
            if(char.isRuler){
                return `${char.primaryTitle}的首领, 一群${char.liegeRealmLaw}`
            }
            else{
                return `${char.liege}的追随者,他们是一群${char.liegeRealmLaw}`
            }
        }
        else if(char.isLandedRuler){
            if(char.isIndependentRuler){
                return `${char.primaryTitle}的最高统治者`
            }
            else{
                return `${char.primaryTitle}的地区行政长官, ${char.liege}的下属命官`
            }
            
        }
        else if(char.isKnight){
            return `${char.liege}的将领`
        }        
    }

    function courtAndCouncilPositions(char){
        if(char.heldCourtAndCouncilPositions){
            return `${char.liege}的${char.heldCourtAndCouncilPositions} `
        }
        else{
            return ``
        }
    }

    function houseAndStatus(char){
        let output="";

        if(char.sheHe === "她"){
            output+= "性别：女，";
        }
        else if(char.sheHe === "他"){
            output+= "性别：男，";
        }

        if(char.house){
            output+="出身贵族，";
        }
        else{
            output+="出身平民";
        }
    
        if(char.house){
            output+=`姓氏：${char.house}`
        }
    
        return output;
    }

    function opinion(char){
        const op = char.opinionOfPlayer;

        if(op>60){
            return `${char.shortName}对${player.shortName}有很大好感`
        }
        else if(op>20){
            return `${char.shortName}对${player.shortName}有轻微好感`
        }
        else if(op>-20){
            return `${char.shortName}对${player.shortName}态度中立`
        }
        else if(op>-60){
            return `${char.shortName}对${player.shortName}轻微厌恶`
        }
        else{
             return `${char.shortName}对${player.shortName}强烈憎恨`
        }
    }

    
    function greedines(char){
        if(char.greed>75){
            return "非常贪婪";
        }
        else if(char.greed>50){
            return "一般贪婪";
        }
        else if(char.greed>25){
            return "轻微贪婪";
        }
        else{
            return null;
        }
    }
    
    function marriage(char){
        if(char.consort){
            if(char.consort == player.fullName){
                return `配偶是${player.shortName}`;
            }
            else if(char.consort == ai.fullName){
                return `配偶是${ai.shortName}`;
            }
            else{
                return `配偶是${char.consort}`
            }
        }
        else{
            return ``;
        }
    }
    
    function otherTraits(char){
        let otherTraits = char.traits.filter((trait) => trait.category != "性格特质");
    
        let traitNames = otherTraits.map(trait => trait.name);
    
        let output = "拥有特质：("
        output+= traitNames.join(", ");
        output+=")";
    
        return output;
    }
    
    function personalityTraits(char){
        let personalityTraits = filterTraitsToCategory(char.traits, "性格特质");
    
        let traitNames = personalityTraits.map(trait => trait.name);
    
        let output = "性格：("
        output+= traitNames.join(", ");
        output+=")";
    
        return output;
    }
    
    function listRelationsToCharacters(char) {
        if (char.relationsToCharacters.length === 0) {
            return `${char.shortName}没有什么人际关系。`;
        } else {
            return char.relationsToCharacters
                .map(relation => {
                    const targetCharacter = gameData.characters.get(relation.id);
                    if (targetCharacter) {
                        let relationTypes = relation.relations.join(', ');
                        if (relationTypes.includes("你的")) {
                            relationTypes = relationTypes.replace("你的", gameData.playerName+"的");
                        }
                        return `${char.shortName}是${targetCharacter.shortName}的${relationTypes}`;
                    } else {
                        return ``;
                    }
                })
                .join('\n');
        }
    }

    
    function listRelationsToPlayer(char){
        if(char.relationsToPlayer === 0){
            return `和${player.shortName}没有人际关系`;
        }
        else{
            return `${char.shortName}是${player.shortName}的${char.relationsToPlayer.join(', ')}`;
        }
    }


    function scenario(){

        switch (scene){
             //添加更多场景
            case "bedchamber_east1":
                return `${ai.shortName}与${player.shortName}在卧室里对话`;
            case "garden_east1":
                return `${ai.shortName}在御花园里与${player.shortName}对话`;
            case "throneroom_east_fuya1":
                return `${ai.shortName}在府衙里拜见${player.shortName}`;
            case "throneroom_east_fuya":
                return `${ai.shortName}在府衙里接见${player.shortName}`;
            case "throneroom_east_empire":
                return `${ai.shortName}在皇宫大殿里召见${player.shortName}`;
            case "throneroom_east_empire1":
                return `${ai.shortName}在皇宫大殿里觐见${player.shortName}`;

            //原作者设置的场景
            case "throneroom":
                return `${ai.shortName}在${locationController}的王座厅会见${player.shortName}`;
            case "garden":
                return `${ai.shortName}在城堡花园与${player.shortName}会面`;
            case "bedchamber":
                return `${ai.shortName}在私人寝宫接待${player.shortName}`;
            case "feast":
                return `${ai.shortName}在${locationController}举办的宴会上与${player.shortName}交谈`;
            case "army_camp":
                return `${ai.shortName}在军营中会见${player.shortName}`;
            case "hunt":
                return `${ai.shortName}在迷雾森林狩猎时遇见${player.shortName}，他们都拿着弓箭`;
            case "dungeon":
                return `${ai.shortName}在地牢里以囚犯身份见到${player.shortName}`;
            case "alley":
                return `${ai.shortName}在隐蔽小巷中私会${player.shortName}`;
        }
    }

    function goldStatus(char) {
        const gold = char.gold;
        // 财富状态分级（单位：黄金）
        if (gold >= 1000000) {
            return `${char.shortName}富可敌国（黄金：${gold}）`; // 百万级财富
        } else if (gold >= 100000) {
            return `${char.shortName}家财万贯（黄金：${gold}）`; // 十万级
        } else if (gold >= 10000) {
            return `${char.shortName}腰缠万贯（黄金：${gold}）`; // 万级
        } else if (gold >= 5000) {
            return `${char.shortName}富甲一方（黄金：${gold}）`;
        } else if (gold >= 1000) {
            return `${char.shortName}生活富足（黄金：${gold}）`;
        } else if (gold >= 500) {
            return `${char.shortName}略有积蓄（黄金：${gold}）`;
        } else if (gold >= 200) {
            return `${char.shortName}收支平衡（黄金：${gold}）`;
        } else if (gold >= 100) {
            return `${char.shortName}勉强维持（黄金：${gold}）`;
        } else if (gold >= 50) {
            return `${char.shortName}捉襟见肘（黄金：${gold}）`;
        } else if (gold > 0) {
            return `${char.shortName}艰难维生（黄金：${gold}）`;
        } else if (gold === 0) {
            return `${char.shortName}身无分文`;
        } else {
            // 负债状态分级
            if (gold <= -1000) {
                return `${char.shortName}债台高筑（负债：${-gold}）`;
            } else if (gold <= -500) {
                return `${char.shortName}资不抵债（负债：${-gold}）`;
            } else if (gold <= -100) {
                return `${char.shortName}债务缠身（负债：${-gold}）`;
            } else {
                return `${char.shortName}略有负债（负债：${-gold}）`;
            }
        }
    }
    
    function age(char) {
        const age = char.age;
    
        if (age < 3) {
            return `${char.shortName} 是个婴儿，还不会说话，但能通过咿呀声、哭闹或微笑来表达需求。他们大部分时间都在观察周围，伸手去够身边的东西。`;
        } else if (age < 6) {
            return `${char.shortName} 是个小孩子，正学着用简单的短语说话，对周围的一切充满好奇。他们经常玩耍，天真活泼地模仿大人的动作。`;
        } else if (age < 10) {
            return `${char.shortName} 是个儿童，能清晰地说话，喜欢玩游戏和听故事。他们明白一些基本的责任，可能会帮忙做些简单的事，但仍非常依赖他人的指导。`;
        } else if (age < 13) {
            return `${char.shortName} 是个少年，开始承担一些小任务或接受技能训练。他们说话更有自信，开始有了责任感，常常渴望得到长辈的认可。`;
        } else if (age < 16) {
            return `${char.shortName} 是个青少年，在言行上表现出独立性。他们可能正在为未来的职责接受训练，并且可能会为承担早期责任而感到自豪。`;
        } else if (age < 20) {
            return `${char.shortName} 是个年轻人，自信满满，通常已准备好做决定。他们处理日常事务，言语中透露出雄心壮志和青春活力。`;
        } else if (age < 30) {
            return `${char.shortName} 是个成熟的年轻人，做事有目的、有条理。他们常常独立平衡工作和个人事务，说话有目的且充满信念。`;
        } else if (age < 40) {
            return `${char.shortName} 经验丰富，行事稳健。他们说话直截了当，稳定地完成任务，值得信赖。`;
        } else if (age < 60) {
            return `${char.shortName} 是个阅历丰富的成年人，言行审慎。他们带着一种沉稳的自信，往往会给年轻人提供建议或指导。`;
        } else {
            return `${char.shortName} 是位长者，常常善于反思且深思熟虑。他们可能更为内敛，只在必要时发言，但身上散发着一种平静的气质，反映出他们丰富的人生阅历。`;
        }
    }
    
    function describeProwess(char){    
        let description = `${char.shortName}的武勇值为`;
        let prowess = char.prowess;
        if (prowess >= 0 && prowess <= 4) {
            description = `极差：该角色体弱多病，肌肉量极少且缺乏个人战斗技能。在战斗中极其脆弱，即使在小规模冲突中也容易受伤或死亡。`;
        } else if (prowess >= 5 && prowess <= 8) {
            description = `较差：该角色身体力量和战斗资质低于平均水平。可能有少量肌肉轮廓，但在个人战斗和战场上仍面临重大风险。`;
        } else if (prowess >= 9 && prowess <= 12) {
            description = `普通：该角色具备基本的身体力量和战斗能力。可以应付技能较差的对手，但在激烈战斗中仍然脆弱。`;
        } else if (prowess >= 13 && prowess <= 16) {
            description = `良好：该角色拥有优于常人的身体素质和战斗技巧。展现出明显的肌肉量，能够很好地防御自身并胜任骑士或指挥官职责。`;
        } else if (prowess >= 17 && prowess <= 68) {
            description = `优秀：该角色精通个人战斗技巧且力量出众。其武勇值使其成为战场上令人畏惧的存在，兼具出色的生存本能和杀伤力。`;
        } else if (prowess === 69) {
            description = `非凡：该角色的武勇值既卓越又令人难忘。他们以近乎传奇般的技巧与力量在战斗中脱颖而出，其战场表现极具鼓舞性。`;
        } else if (prowess >= 70 && prowess <= 100) {
            description = `巅峰：该角色达到身体与战斗能力的顶峰，拥有无可匹敌的技巧和肌肉量。在个人战斗中占据绝对优势，作为骑士或指挥官的存在既令人畏惧又充满威慑。`;
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
