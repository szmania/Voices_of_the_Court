//Made by: Durond

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "undressCharacter",
    args: [],
    description: {
        en: `Executed when a character undresses. The source (character1) is the character causing the action (can be the same as target). The target (character2) is the character who is UNDRESSING.`,
        zh: `当一个角色自愿或被迫脱去衣服时执行。`,
        ru: `Выполняется, когда персонаж раздевается, добровольно или принудительно.`,
        fr: `Exécuté lorsqu'un personnage se déshabille, de plein gré ou par la force.`,
        es: `Ejecutado cuando un personaje se desviste, voluntariamente o por la fuerza.`,
        de: `Wird ausgeführt, wenn ein Charakter sich auszieht, freiwillig oder gewaltsam.`,
        ja: `キャラクターが服を脱いだときに実行されます。自発的または強制的に。`,
        ko: `캐릭터가 옷을 벗을 때 실행됩니다. 자발적이거나 강제로.`,
        pl: `Wykonywane, gdy postać rozbiera się, dobrowolnie lub siłą.`,
        pt: `Executado quando um personagem se despe, voluntariamente ou à força. A fonte (character1) é o personagem que causa a ação (pode ser o mesmo que o alvo). O alvo (character2) é o personagem que está SE DESPIRINDO.`,
        tr: `Bir karakter soyunduğunda çalıştırılır, gönüllü olarak veya zorla. Kaynak (character1) eyleme neden olan karakterdir (hedef ile aynı olabilir). Hedef (character2) SOYUNAN karakterdir.`
    },

    /**
     * @param {GameData} gameData 
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) => {
        return true;
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
        global_var:votcce_action_target = {
            add_character_flag = {
                flag = is_naked
                days = 1
            }
        }
    `);
    },
    chatMessage: (args) =>{
        return {
            en: `{{character2Name}} undressed.`,
            zh: `{{character2Name}}脱去了衣服`,
            ru: `{{character2Name}} разделся.`,
            fr: `{{character2Name}} s'est déshabillé.`,
            es: `{{character2Name}} se desvistió.`,
            de: `{{character2Name}} hat sich ausgezogen.`,
            ja: `{{character2Name}}は服を脱ぎました。`,
            ko: `{{character2Name}}가 옷을 벗었습니다.`,
            pl: `{{character2Name}} rozebrał się.`,
            pt: `{{character2Name}} se despiu.`,
            tr: `{{character2Name}} soyundu.`
        }
    },
    chatMessageClass: "neutral-action-message"
}
