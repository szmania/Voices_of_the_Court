/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "unsilenceCharacter",
    args: [],
    description: {
        en: `Executed when a silenced character is allowed to speak again during the conversation. The SOURCE (character1) is the character performing the unsilencing; the TARGET (character2) is the character being unsilenced. Source and target may be the same character (self-unsilence) or different characters. This is an app-side action: no game effect is emitted.`,
        zh: `当一个被沉默的角色在对话中重新获准发言时执行。源（character1）是执行解除沉默的角色；目标（character2）是被解除沉默的角色。源和目标可以是同一角色（自我解除）或不同角色。这是应用侧操作：不会发出任何游戏效果。`,
        ru: `Выполняется, когда заглушённый персонаж снова получает право говорить во время разговора. ИСТОЧНИК (персонаж 1) — персонаж, снимающий заглушение; ЦЕЛЬ (персонаж 2) — персонаж, с которого снимается молчание. Источник и цель могут быть одним и тем же персонажем (самоснятие) или разными персонажами. Это действие на стороне приложения: игровой эффект не создаётся.`,
        fr: `Exécuté lorsqu'un personnage réduit au silence est autorisé à reprendre la parole pendant la conversation. La SOURCE (personnage 1) est le personnage qui lève le silence ; la CIBLE (personnage 2) est le personnage dont le silence est levé. Source et cible peuvent être le même personnage (auto-levée) ou des personnages différents. Action côté application : aucun effet de jeu n'est émis.`,
        es: `Se ejecuta cuando un personaje silenciado puede volver a hablar durante la conversación. El ORIGEN (character1) es el personaje que realiza la anulación del silencio; el OBJETIVO (character2) es el personaje al que se le quita el silencio. Origen y objetivo pueden ser el mismo personaje (autoanulación) o personajes distintos. Es una acción del lado de la aplicación: no se emite ningún efecto del juego.`,
        de: `Wird ausgeführt, wenn ein zum Schweigen gebrachter Charakter im Gespräch wieder sprechen darf. Die QUELLE (Charakter 1) ist der Charakter, der die Stummschaltung aufhebt; das ZIEL (Charakter 2) ist der Charakter, dessen Stummschaltung aufgehoben wird. Quelle und Ziel können derselbe Charakter (Selbstaufhebung) oder verschiedene Charaktere sein. Dies ist eine App-seitige Aktion: Es wird kein Spieleffekt ausgelöst.`,
        ja: `沈黙させられたキャラクターが会話中に再び話すことを許可されたときに実行されます。ソース（キャラクター1）は沈黙を解除する側のキャラクター、ターゲット（キャラクター2）は沈黙を解除されるキャラクターです。ソースとターゲットは同一キャラクター（自己解除）でも別キャラクターでも構いません。これはアプリ側のアクションです：ゲーム効果は発行されません。`,
        ko: `침묵한 캐릭터가 대화 중에 다시 말할 수 있게 되었을 때 실행됩니다. 소스(캐릭터 1)는 침묵을 해제하는 캐릭터이고, 대상(캐릭터 2)은 침묵이 해제되는 캐릭터입니다. 소스와 대상은 같은 캐릭터(자기 해제)일 수도 있고 다른 캐릭터일 수도 있습니다. 이것은 앱 측 작업입니다: 게임 효과는 발생하지 않습니다.`,
        pl: `Wykonywane, gdy wyciszona postać może ponownie mówić podczas rozmowy. ŹRÓDŁO (postać 1) to postać zdejmująca wyciszenie; CEL (postać 2) to postać, której znosi się wyciszenie. Źródło i cel mogą być tą samą postacią (samozniesienie) lub różnymi postaciami. To działanie po stronie aplikacji: żaden efekt gry nie jest emitowany.`,
        pt: `Executado quando um personagem silenciado pode voltar a falar durante a conversa. A FONTE (personagem 1) é o personagem que remove o silenciamento; o ALVO (personagem 2) é o personagem que tem o silêncio removido. Fonte e alvo podem ser o mesmo personagem (auto-remoção) ou personagens diferentes. Esta é uma ação do lado do aplicativo: nenhum efeito de jogo é emitido.`,
        tr: `Susturulmuş bir karakterin konuşma sırasında yeniden konuşmasına izin verildiğinde çalıştırılır. KAYNAK (karakter 1) susturmayı kaldıran karakterdir; HEDEF (karakter 2) susturması kaldırılan karakterdir. Kaynak ve hedef aynı karakter (kendini kaldırma) veya farklı karakterler olabilir. Bu uygulama tarafında bir eylemdir: hiçbir oyun efekti tetiklenmez.`
    },
    canPerformAtDistance: false,

    /**
     * @param {GameData} gameData
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) => {
        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);
        return !!source && !!target;
    },

    /**
     * @param {GameData} gameData
     * @param {Function} runGameEffect
     * @param {string[]} args
     * @param {number} sourceId
     * @param {number} targetId
     */
    run: (gameData, runGameEffect, args, sourceId, targetId) => {
        // App-side action: no game effect is emitted. The unsilence removes the
        // character from gameData's silenced set so Conversation.ts re-admits
        // them into the speaker queues.
        const target = gameData.getCharacterById(targetId);
        if (!target) return;
        if (!gameData.silencedCharacterIds) {
            gameData.silencedCharacterIds = new Set();
        }
        gameData.silencedCharacterIds.delete(targetId);
    },
    chatMessage: (args) =>{
        return {
            en: `{{character2Name}} is no longer silenced.`,
            zh: `{{character2Name}}不再被沉默了。`,
            ru: `{{character2Name}} больше не заглушён.`,
            fr: `{{character2Name}} n'est plus réduit au silence.`,
            es: `{{character2Name}} ya no está silenciado.`,
            de: `{{character2Name}} wird nicht mehr zum Schweigen gebracht.`,
            ja: `{{character2Name}}はもう沈黙させられていません。`,
            ko: `{{character2Name}}은(는) 더 이상 침묵하지 않습니다.`,
            pl: `{{character2Name}} nie jest już wyciszony.`,
            pt: `{{character2Name}} não está mais silenciado.`,
            tr: `{{character2Name}} artık susturulmuyor.`
        }
    },
    chatMessageClass: "neutral-action-message",
    usesSource: true,
    usesTarget: true,
}