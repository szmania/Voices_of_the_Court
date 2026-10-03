/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "silenceCharacter",
    args: [],
    description: {
        en: `Executed when a character falls silent or is silenced during the conversation. The SOURCE (character1) is the character performing the silencing; the TARGET (character2) is the character being silenced. Source and target may be the same character (self-silence) or different characters. This is an app-side action: no game effect is emitted.`,
        zh: `当一个角色在对话中沉默或被制止时执行。源（character1）是执行制止的角色；目标（character2）是被制止的角色。源和目标可以是同一角色（自我沉默）或不同角色。这是应用侧操作：不会发出任何游戏效果。`,
        ru: `Выполняется, когда персонаж замолкает или его заставляют замолчать во время разговора. ИСТОЧНИК (персонаж 1) — персонаж, выполняющий заглушение; ЦЕЛЬ (персонаж 2) — заглушаемый персонаж. Источник и цель могут быть одним и тем же персонажем (самозаглушение) или разными персонажами. Это действие на стороне приложения: игровой эффект не создаётся.`,
        fr: `Exécuté lorsqu'un personnage se tait ou est réduit au silence pendant la conversation. La SOURCE (personnage 1) est le personnage qui impose le silence ; la CIBLE (personnage 2) est le personnage réduit au silence. Source et cible peuvent être le même personnage (auto-silence) ou des personnages différents. Action côté application : aucun effet de jeu n'est émis.`,
        es: `Se ejecuta cuando un personaje enmudece o es silenciado durante la conversación. El ORIGEN (character1) es el personaje que realiza el silenciamiento; el OBJETIVO (character2) es el personaje silenciado. Origen y objetivo pueden ser el mismo personaje (autosilencio) o personajes distintos. Es una acción del lado de la aplicación: no se emite ningún efecto del juego.`,
        de: `Wird ausgeführt, wenn ein Charakter während des Gesprächs verstummt oder zum Schweigen gebracht wird. Die QUELLE (Charakter 1) ist der Charakter, der das Schweigen veranlasst; das ZIEL (Charakter 2) ist der Charakter, der zum Schweigen gebracht wird. Quelle und Ziel können derselbe Charakter (Selbststummschaltung) oder verschiedene Charaktere sein. Dies ist eine App-seitige Aktion: Es wird kein Spieleffekt ausgelöst.`,
        ja: `会話中にキャラクターが沈黙する、または黙らされたときに実行されます。ソース（キャラクター1）は沈黙させる側のキャラクター、ターゲット（キャラクター2）は沈黙させられるキャラクターです。ソースとターゲットは同一キャラクター（自己沈黙）でも別キャラクターでも構いません。これはアプリ側のアクションです：ゲーム効果は発行されません。`,
        ko: `대화 중 캐릭터가 침묵하거나 제지될 때 실행됩니다. 소스(캐릭터 1)는 침묵시키는 캐릭터이고, 대상(캐릭터 2)은 침묵당하는 캐릭터입니다. 소스와 대상은 같은 캐릭터(자기 침묵)일 수도 있고 다른 캐릭터일 수도 있습니다. 이것은 앱 측 작업입니다: 게임 효과는 발생하지 않습니다.`,
        pl: `Wykonywane, gdy postać milknie lub zostaje uciszona podczas rozmowy. ŹRÓDŁO (postać 1) to postać wykonująca wyciszenie; CEL (postać 2) to postać wyciszana. Źródło i cel mogą być tą samą postacią (samowyciszenie) lub różnymi postaciami. To działanie po stronie aplikacji: żaden efekt gry nie jest emitowany.`,
        pt: `Executado quando um personagem fica em silêncio ou é silenciado durante a conversa. A FONTE (personagem 1) é o personagem que realiza o silenciamento; o ALVO (personagem 2) é o personagem silenciado. Fonte e alvo podem ser o mesmo personagem (auto-silenciamento) ou personagens diferentes. Esta é uma ação do lado do aplicativo: nenhum efeito de jogo é emitido.`,
        tr: `Bir karakter konuşma sırasında sustuğunda veya susturulduğunda çalıştırılır. KAYNAK (karakter 1) susturmayı yapan karakterdir; HEDEF (karakter 2) susturulan karakterdir. Kaynak ve hedef aynı karakter (kendini susturma) veya farklı karakterler olabilir. Bu uygulama tarafında bir eylemdir: hiçbir oyun efekti tetiklenmez.`
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
        // App-side action: no game effect is emitted. The silence is tracked on
        // gameData so Conversation.ts filters the silenced character out of all
        // speaker queues (no responses, no random AI-to-AI speech).
        // UI dropdown hint: resolves via global_var:votcce_action_source and global_var:votcce_action_target
        const target = gameData.getCharacterById(targetId);
        if (!target) return;
        if (!gameData.silencedCharacterIds) {
            gameData.silencedCharacterIds = new Set();
        }
        gameData.silencedCharacterIds.add(targetId);
    },
    chatMessage: (args) =>{
        return {
            en: `{{character2Name}} falls silent.`,
            zh: `{{character2Name}}陷入了沉默。`,
            ru: `{{character2Name}} замолкает.`,
            fr: `{{character2Name}} se tait.`,
            es: `{{character2Name}} enmudece.`,
            de: `{{character2Name}} verstummt.`,
            ja: `{{character2Name}}は沈黙しました。`,
            ko: `{{character2Name}}이(가) 침묵합니다.`,
            pl: `{{character2Name}} milknie.`,
            pt: `{{character2Name}} fica em silêncio.`,
            tr: `{{character2Name}} susuyor.`
        }
    },
    chatMessageClass: "neutral-action-message",
    usesSource: true,
    usesTarget: true,
}
