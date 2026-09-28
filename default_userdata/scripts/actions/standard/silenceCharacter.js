/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "silenceCharacter",
    args: [],
    description: {
        en: `Executed when a character falls silent or is silenced during the conversation. The target (character2) is the character who goes silent. The source (character1) is the character who caused it. This is an app-side action: no game effect is emitted.`,
        zh: `当一个角色在对话中沉默或被制止时执行。目标（character2）是沉默的角色。源（character1）是导致沉默的角色。这是应用侧操作：不会发出任何游戏效果。`,
        ru: `Выполняется, когда персонаж замолкает или его заставляют замолчать во время разговора. Цель (персонаж 2) — персонаж, который замолкает. Источник (персонаж 1) — тот, кто это вызвал. Это действие на стороне приложения: игровой эффект не создаётся.`,
        fr: `Exécuté lorsqu'un personnage se tait ou est réduit au silence pendant la conversation. La cible (personnage 2) est le personnage qui se tait. La source (personnage 1) est celui qui l'a provoqué. Action côté application : aucun effet de jeu n'est émis.`,
        es: `Se ejecuta cuando un personaje enmudece o es silenciado durante la conversación. El objetivo (character2) es el personaje que enmudece. El origen (character1) es quien lo causó. Es una acción del lado de la aplicación: no se emite ningún efecto del juego.`,
        de: `Wird ausgeführt, wenn ein Charakter während des Gesprächs verstummt oder zum Schweigen gebracht wird. Das Ziel (Charakter 2) ist der Charakter, der verstummt. Die Quelle (Charakter 1) ist der Charakter, der es verursacht hat. Dies ist eine App-seitige Aktion: Es wird kein Spieleffekt ausgelöst.`,
        ja: `会話中にキャラクターが沈黙する、または黙らされたときに実行されます。ターゲット（キャラクター2）は沈黙するキャラクターです。ソース（キャラクター1）はそれを引き起こしたキャラクターです。これはアプリ側のアクションです：ゲーム効果は発行されません。`,
        ko: `대화 중 캐릭터가 침묵하거나 제지될 때 실행됩니다. 대상(캐릭터 2)은 침묵하는 캐릭터입니다. 소스(캐릭터 1)는 이를 유발한 캐릭터입니다. 이것은 앱 측 작업입니다: 게임 효과는 발생하지 않습니다.`,
        pl: `Wykonywane, gdy postać milknie lub zostaje uciszona podczas rozmowy. Cel (postać 2) to postać, która milknie. Źródło (postać 1) to postać, która to spowodowała. To działanie po stronie aplikacji: żaden efekt gry nie jest emitowany.`,
        pt: `Executado quando um personagem fica em silêncio ou é silenciado durante a conversa. O alvo (personagem 2) é o personagem que fica em silêncio. A fonte (personagem 1) é quem o causou. Esta é uma ação do lado do aplicativo: nenhum efeito de jogo é emitido.`,
        tr: `Bir karakter konuşma sırasında sustuğunda veya susturulduğunda çalıştırılır. Hedef (karakter 2) susan karakterdir. Kaynak (karakter 1) bunu neden olandır. Bu uygulama tarafında bir eylemdir: hiçbir oyun efekti tetiklenmez.`
    },
    canPerformAtDistance: true,
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
        // App-side action: no game effect is emitted. The silence is purely
        // narrative — the chat message below informs the conversation.
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
}