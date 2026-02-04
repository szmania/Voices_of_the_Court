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
    
// 在此处可添加或修改自定义特质描述，新增内容请遵循原有数据结构，保持“特质名: 描述”的键值对形式，并确保与下方 PERSONALITY_DESCRIPTIONS 对象格式一致，自己修改后要放在custom文件夹中不然下次启动会被覆盖。
    const PERSONALITY_DESCRIPTIONS = {
        "勇敢": "面对挑战与危险无所畏惧，积极承担风险与职责；在对话中常主动提议行动，语气坚定，敢于承担责任，遇冲突不退缩。",
        "怯懦": "回避挑战与惊吓，倾向选择安全与低风险的道路；说话谨慎，常用模糊或推脱措辞，遇压力易妥协或转移话题。",
        "冷静": "处事从容，节奏稳健，情绪波动小，善于理性判断；语调平稳，先分析后表态，极少失态，喜用数据或逻辑说服他人。",
        "暴怒": "情绪易被激怒，反应强烈，难以在冲突中保持克制；说话带火药味，易提高音量，使用质问或命令句式，冲突中先攻击后思考。",
        "忠贞": "克制亲密接触的欲望，远离肉体诱惑，专注于长久承诺；用词保守，回避暧昧话题，强调责任与忠诚，常以道德准则自限。",
        "色欲": "对肉体享乐渴求旺盛，易被情欲驱动而忽视后果；语调暧昧，善用双关或暗示，主动拉近身体或情感距离，话题易滑向私密。",
        "安于现状": "满足于已有，少有更进一步的追求，重视稳定与舒适；语气随和，反对激进方案，强调维持现状的好处。",
        "野心勃勃": "目标明确，意志坚定，不达目的誓不罢休；说话直接指向结果，主动提出扩张或升级计划，对阻碍表现不耐。",
        "勤勉": "勤于劳作，不畏艰辛，长期投入以达成成果；主动揽活，对拖延者表现出不满，强调努力必有回报。",
        "懒惰": "趋向最省力的选择，缺乏持续投入与自我要求；语气懒散，提议捷径或推迟，对复杂计划先问“能否简化”。",
        "宽宏大量": "易于释怀冒犯与挫折，不计前嫌，心胸开阔；语调轻松，主动缓和紧张，倾向用幽默或转移化解尴尬。",
        "睚眦必报": "对怠慢与错误耿耿于怀，倾向寻求报复或补偿；语气阴冷，记仇细节清晰，常提醒旧账，谈判中要求“先补偿再谈未来”。",
        "慷慨": "乐于施予与分享，主动参与慈善与援助；说话豪爽，先提出帮助，对讨价还价表现不耐。",
        "贪婪": "执着于财富积累，谨慎花费，不断寻找获利机会；对成本敏感",
        "合群": "乐于社交，享受与他人共处，从群体中汲取能量；语调热情，频繁称呼对方名字，主动发起聚会或联盟，怕冷场。",
        "害羞": "避免过多互动，偏好独处或小范围交流；说话轻声，眼神回避，对公开表态需多次鼓励。",
        "诚实": "重视事实与真诚，言行透明，少有欺瞒；直接陈述利弊，主动承认错误，对谎言表现明显不适。",
        "狡诈": "擅长欺骗与操弄，善用谎言达成目的；语调圆滑，先探口风再表态，回避直接承诺。",
        "谦卑": "自我要求不高，态度谦逊，避免夸耀与炫示；把功劳归于他人，对赞美先否认再转移。",
        "傲慢": "深信自身价值与优越，难以接受质疑与批评；语气居高临下，对反对意见先贬低再反驳。",
        "公正": "强烈的正义感，强调公平与秩序，恪守规则；提议投票或第三方仲裁，对特权表现反感。",
        "专断": "独断行事，鲜少征求意见，以自身判断为先；打断他人发言，对协商表现不耐，要求立即执行。",
        "耐心": "善于等待与观察，选择时机后稳妥行动；语调缓慢，极少打断。",
        "急躁": "追求快速结果，难以忍受拖延，偏好立刻执行；说话短促，对冗长解释表现烦躁，易中途插话。",
        "节制": "主张节欲与适度，克制冲动，保持平衡；用词中性，反对极端方案。",
        "暴食": "轻视节度与克制，倾向过度享受与占有；语气夸张，对限制表现反感，主动加码。",
        "轻信他人": "容易相信他人陈述，防范意识不足；快速接受新信息，对证据要求低，易跟随对方思路。",
        "多疑": "对周遭持怀疑态度，时常预见潜在威胁；频繁提问，要求证据或担保，对好意先质疑动机。",
        "狂热": "宗教热忱高涨，以信仰为行事准绳；引用经典或神谕，对异见视为亵渎，语调激昂。",
        "愤世嫉俗": "以个人利益为先，对理想与善念持怀疑态度；冷嘲热讽，对利他提议先拆台。",
        "慈悲": "心怀仁爱与同情，愿意为他人承担与施予；语调柔和，主动提出减免或援助，对痛苦表现共情。",
        "冷酷": "情感反应淡漠，对他人痛苦缺乏共鸣；语气平淡，对求助先评估利弊，鲜少安慰。",
        "虐待狂": "以他人受苦为乐，倾向施加伤害；语调兴奋，对求饶表现愉悦，主动提议惩罚性方案。",
        "多变": "观点与选择常变化无常，难以预测；同一话题前后矛盾，对承诺随时反悔，话题跳跃大。",
        "固执": "不轻易让步，坚守己见，抵制改变；重复原有立场，对新证据表现排斥，谈判中寸步不让。",
        "怪客": "行为异于常人，模式不稳定但并非彻底失序；用词或语调突兀，喜用自创比喻，话题跳跃，对常规社交规则表现漠视。",
        "螓首蛾眉": "面容姣好，眉目如画，自带温婉柔和的气质；言谈举止间常显端庄，易赢得他人好感。",
        "英姿飒爽": "神采飞扬，气度豪迈",
        "倾国倾城": "美貌绝伦，令人一见难忘，自带光环效应；说话时常被倾听，易成为焦点，话题不自觉围绕其展开。",
        "海格力斯": "拥有超凡体魄与力量，勇猛过人",
        "阿玛宗": "拥有超凡体魄与力量，勇猛过人"
    };

    let playerPersonaItems = [
        `id(${player.id})`,
        `姓名：${player.firstName}`,
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
        `姓名：${ai.firstName}`,
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
    output+= `\n[${player.shortName}'（user）的角色信息: ${playerPersonaItems.join("; ")}]`;
    output+=`\n[${ai.shortName}'的角色信息: ${aiPersonaItems.join("; ")}]`;
    
    if (gameData.characters.size > 2){
        gameData.characters.forEach((value, key) => {
            if(key !== gameData.playerID && key !== gameData.aiID)
            {
                let secondaryAiItems = [
                    `id(${value.id})`,
                    `姓名：${value.firstName}`,
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
                    `信仰：${value.faith}`, 
                    `民族：${value.culture}`]
                output+=`\n[${value.shortName}'的角色信息: ${secondaryAiItems.join("; ")}]`;
            }
        })
    }



    output+=`\n[信件发出日期(${date})]`;
    
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
    
        let traitTexts = otherTraits.map(trait => {
            const d = PERSONALITY_DESCRIPTIONS[trait.name] || trait.desc;
            return d ? `${trait.name}：${d}` : trait.name;
        });
    
        let output = "拥有特质：("
        output+= traitTexts.join(", ");
        output+=")";
    
        return output;
    }
    
    function personalityTraits(char){
        let personalityTraits = filterTraitsToCategory(char.traits, "性格特质");
        let traitTexts = personalityTraits.map(trait => {
            const d = PERSONALITY_DESCRIPTIONS[trait.name] || trait.desc;
            return d ? `${trait.name}：${d}` : trait.name;
        });
        let output = "性格：("
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
        if (age > 13) {
            return `${age} 岁`;
        }
        if (age < 3) {
            return `${char.shortName} 是个婴儿，还不会说话，但能通过咿呀声、哭闹或微笑来表达需求。他们大部分时间都在观察周围，伸手去够身边的东西。`;
        } else if (age < 6) {
            return `${char.shortName} 是个小孩子，正学着用简单的短语说话，对周围的一切充满好奇。他们经常玩耍，天真活泼地模仿大人的动作。`;
        } else if (age < 10) {
            return `${char.shortName} 是个儿童，能清晰地说话，喜欢玩游戏和听故事。他们明白一些基本的责任，可能会帮忙做些简单的事，但仍非常依赖他人的指导。`;
        } else if (age <= 13) {
            return `${char.shortName} 是个少年，开始承担一些小任务或接受技能训练。他们说话更有自信，开始有了责任感，常常渴望得到长辈的认可。`;
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
