/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

// Resolves the character to silence/unsilence: prefers the explicit
// targetCharacterId argument (may be the speaker themselves or a third
// party in the conversation), falling back to the positional target
// character. Returns the numeric ID, or null when no valid
// in-conversation character resolves.
function resolveSilenceTarget(gameData, args, sourceId, targetId) {
    const argTarget = args && args[0] !== undefined && args[0] !== null ? parseInt(args[0], 10) : NaN;
    if (!isNaN(argTarget) && gameData.getCharacterById(argTarget)) {
        return argTarget;
    }
    if (targetId != null && gameData.getCharacterById(targetId)) {
        return targetId;
    }
    return null;
}
module.exports = {
    signature: "silenceCharacter",
    args: [
        {
            name: "targetCharacterId",
            type: "number",
            desc: {
                en: "ID of the character to silence. May be the speaker themselves or any character in the conversation (optional; defaults to the target character).",
                zh: "要沉默的角色的ID。可以是说话者本人或对话中的任何角色（可选；默认为目标角色）。",
                ru: "ID персонажа, которого нужно заглушить. Это может быть сам говорящий или любой персонаж разговора (необязательно; по умолчанию — целевой персонаж).",
                fr: "ID du personnage à réduire au silence. Il peut s'agir du locuteur lui-même ou de n'importe quel personnage de la conversation (facultatif ; par défaut, le personnage cible).",
                es: "ID del personaje a silenciar. Puede ser el propio hablante o cualquier personaje de la conversación (opcional; por defecto, el personaje objetivo).",
                de: "ID des Charakters, der zum Schweigen gebracht werden soll. Dies kann der Sprecher selbst oder jeder Charakter im Gespräch sein (optional; Standardwert ist der Zielcharakter).",
                ja: "沈黙させるキャラクターのID。話者本人または会話内の任意のキャラクターを指定できます（任意；デフォルトはターゲットキャラクター）。",
                ko: "침묵시킬 캐릭터의 ID. 화자 본인이나 대화 중의 모든 캐릭터일 수 있습니다(선택 사항; 기본값은 대상 캐릭터).",
                pl: "ID postaci, którą należy wyciszyć. Może to być sam mówca lub dowolna postać w rozmowie (opcjonalne; domyślnie postać docelowa).",
                pt: "ID do personagem a silenciar. Pode ser o próprio falante ou qualquer personagem da conversa (opcional; por padrão, o personagem alvo).",
                tr: "Susturulacak karakterin ID'si. Konuşan kişinin kendisi veya konuşmadaki herhangi bir karakter olabilir (isteğe bağlı; varsayılan hedef karakterdir)."
            }
        }
    ],
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
    canPerformAtDistance: false,
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
     * @param {string[]} args
     * @param {number} sourceId
     * @param {number} targetId
     * @returns {{success: boolean, message?: string}}
     */
    preCheck: (gameData, args, sourceId, targetId) => {
        const resolved = resolveSilenceTarget(gameData, args, sourceId, targetId);
        if (resolved == null) {
            return { success: false, message: "Target character not found." };
        }
        return { success: true };
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
        if (!gameData.silencedCharacterIds) {
            gameData.silencedCharacterIds = new Set();
        }
        const resolvedTargetId = resolveSilenceTarget(gameData, args, sourceId, targetId);
        if (resolvedTargetId == null) return;
        gameData.silencedCharacterIds.add(resolvedTargetId);
        // Store the resolved character's short name for the chat message
        // ({{character3Name}}) — the callers run parseVariables after run.
        const silencedChar = gameData.getCharacterById(resolvedTargetId);
        if (silencedChar) {
            gameData.character3Name = silencedChar.shortName;
        }
    },
    chatMessage: (args) =>{
        return {
            en: `{{character3Name}} falls silent.`,
            zh: `{{character3Name}}陷入了沉默。`,
            ru: `{{character3Name}} замолкает.`,
            fr: `{{character3Name}} se tait.`,
            es: `{{character3Name}} enmudece.`,
            de: `{{character3Name}} verstummt.`,
            ja: `{{character3Name}}は沈黙しました。`,
            ko: `{{character3Name}}이(가) 침묵합니다.`,
            pl: `{{character3Name}} milknie.`,
            pt: `{{character3Name}} fica em silêncio.`,
            tr: `{{character3Name}} susuyor.`
        }
    },
    chatMessageClass: "neutral-action-message",
}
