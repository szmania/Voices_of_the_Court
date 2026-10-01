/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

// Resolves the character to unsilence: prefers the explicit
// targetCharacterId argument (may be the speaker themselves or a third
// party in the conversation), falling back to the positional target
// character. Returns the numeric ID, or null when no valid
// in-conversation character resolves.
function resolveUnsilenceTarget(gameData, args, sourceId, targetId) {
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
    signature: "unsilenceCharacter",
    args: [
        {
            name: "targetCharacterId",
            type: "number",
            desc: {
                en: "ID of the character to unsilence. May be the speaker themselves or any character in the conversation (optional; defaults to the target character).",
                zh: "要解除沉默的角色的ID。可以是说话者本人或对话中的任何角色（可选；默认为目标角色）。",
                ru: "ID персонажа, с которого нужно снять молчание. Это может быть сам говорящий или любой персонаж разговора (необязательно; по умолчанию — целевой персонаж).",
                fr: "ID du personnage dont il faut lever le silence. Il peut s'agir du locuteur lui-même ou de n'importe quel personnage de la conversation (facultatif ; par défaut, le personnage cible).",
                es: "ID del personaje al que se le quita el silencio. Puede ser el propio hablante o cualquier personaje de la conversación (opcional; por defecto, el personaje objetivo).",
                de: "ID des Charakters, dessen Stummschaltung aufgehoben werden soll. Dies kann der Sprecher selbst oder jeder Charakter im Gespräch sein (optional; Standardwert ist der Zielcharakter).",
                ja: "沈黙を解除するキャラクターのID。話者本人または会話内の任意のキャラクターを指定できます（任意；デフォルトはターゲットキャラクター）。",
                ko: "침묵을 해제할 캐릭터의 ID. 화자 본인이나 대화 중의 모든 캐릭터일 수 있습니다(선택 사항; 기본값은 대상 캐릭터).",
                pl: "ID postaci, której należy zdjąć wyciszenie. Może to być sam mówca lub dowolna postać w rozmowie (opcjonalne; domyślnie postać docelowa).",
                pt: "ID do personagem cujo silêncio deve ser removido. Pode ser o próprio falante ou qualquer personagem da conversa (opcional; por padrão, o personagem alvo).",
                tr: "Susturması kaldırılacak karakterin ID'si. Konuşan kişinin kendisi veya konuşmadaki herhangi bir karakter olabilir (isteğe bağlı; varsayılan hedef karakterdir)."
            }
        }
    ],
    description: {
        en: `Executed when a silenced character is allowed to speak again during the conversation. The target (character2) is the character who is unsilenced. The source (character1) is the character who allowed it. This is an app-side action: no game effect is emitted.`,
        zh: `当一个被沉默的角色在对话中重新获准发言时执行。目标（character2）是解除沉默的角色。源（character1）是允许其发言的角色。这是应用侧操作：不会发出任何游戏效果。`,
        ru: `Выполняется, когда заглушённый персонаж снова получает право говорить во время разговора. Цель (персонаж 2) — персонаж, с которого снимается молчание. Источник (персонаж 1) — тот, кто это разрешил. Это действие на стороне приложения: игровой эффект не создаётся.`,
        fr: `Exécuté lorsqu'un personnage réduit au silence est autorisé à reprendre la parole pendant la conversation. La cible (personnage 2) est le personnage dont le silence est levé. La source (personnage 1) est celui qui l'a autorisé. Action côté application : aucun effet de jeu n'est émis.`,
        es: `Se ejecuta cuando un personaje silenciado puede volver a hablar durante la conversación. El objetivo (character2) es el personaje al que se le quita el silencio. El origen (character1) es quien lo permitió. Es una acción del lado de la aplicación: no se emite ningún efecto del juego.`,
        de: `Wird ausgeführt, wenn ein zum Schweigen gebrachter Charakter im Gespräch wieder sprechen darf. Das Ziel (Charakter 2) ist der Charakter, dessen Stummschaltung aufgehoben wird. Die Quelle (Charakter 1) ist der Charakter, der dies erlaubt hat. Dies ist eine App-seitige Aktion: Es wird kein Spieleffekt ausgelöst.`,
        ja: `沈黙させられたキャラクターが会話中に再び話すことを許可されたときに実行されます。ターゲット（キャラクター2）は沈黙を解除されるキャラクターです。ソース（キャラクター1）はそれを許可したキャラクターです。これはアプリ側のアクションです：ゲーム効果は発行されません。`,
        ko: `침묵한 캐릭터가 대화 중에 다시 말할 수 있게 되었을 때 실행됩니다. 대상(캐릭터 2)은 침묵이 해제된 캐릭터입니다. 소스(캐릭터 1)는 이를 허용한 캐릭터입니다. 이것은 앱 측 작업입니다: 게임 효과는 발생하지 않습니다.`,
        pl: `Wykonywane, gdy wyciszona postać może ponownie mówić podczas rozmowy. Cel (postać 2) to postać, której znosi się wyciszenie. Źródło (postać 1) to postać, która na to pozwoliła. To działanie po stronie aplikacji: żaden efekt gry nie jest emitowany.`,
        pt: `Executado quando um personagem silenciado pode voltar a falar durante a conversa. O alvo (personagem 2) é o personagem que tem o silêncio removido. A fonte (personagem 1) é quem permitiu. Esta é uma ação do lado do aplicativo: nenhum efeito de jogo é emitido.`,
        tr: `Susturulmuş bir karakterin konuşma sırasında yeniden konuşmasına izin verildiğinde çalıştırılır. Hedef (karakter 2) susturması kaldırılan karakterdir. Kaynak (karakter 1) izin verendir. Bu uygulama tarafında bir eylemdir: hiçbir oyun efekti tetiklenmez.`
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
        const resolved = resolveUnsilenceTarget(gameData, args, sourceId, targetId);
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
        // App-side action: no game effect is emitted. The unsilence removes the
        // character from gameData's silenced set so Conversation.ts re-admits
        // them into the speaker queues.
        const resolvedTargetId = resolveUnsilenceTarget(gameData, args, sourceId, targetId);
        if (resolvedTargetId == null) return;
        if (!gameData.silencedCharacterIds) {
            gameData.silencedCharacterIds = new Set();
        }
        gameData.silencedCharacterIds.delete(resolvedTargetId);
        // Store the resolved character's short name for the chat message
        // ({{character3Name}}) — the callers run parseVariables after run.
        const unsilencedChar = gameData.getCharacterById(resolvedTargetId);
        if (unsilencedChar) {
            gameData.character3Name = unsilencedChar.shortName;
        }
    },
    chatMessage: (args) =>{
        return {
            en: `{{character3Name}} is no longer silenced.`,
            zh: `{{character3Name}}不再被沉默了。`,
            ru: `{{character3Name}} больше не заглушён.`,
            fr: `{{character3Name}} n'est plus réduit au silence.`,
            es: `{{character3Name}} ya no está silenciado.`,
            de: `{{character3Name}} wird nicht mehr zum Schweigen gebracht.`,
            ja: `{{character3Name}}はもう沈黙させられていません。`,
            ko: `{{character3Name}}은(는) 더 이상 침묵하지 않습니다.`,
            pl: `{{character3Name}} nie jest już wyciszony.`,
            pt: `{{character3Name}} não está mais silenciado.`,
            tr: `{{character3Name}} artık susturulmuyor.`
        }
    },
    chatMessageClass: "neutral-action-message",
}