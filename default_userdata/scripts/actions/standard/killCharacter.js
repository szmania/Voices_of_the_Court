//Made by: Sin

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "killCharacter",
    args: [
        {
            name: "quickPick",
            type: "enum",
            options: [
                { value: 'death_murder', display: { en: 'Murder', zh: '谋杀', ru: 'Убийство', fr: 'Meurtre', es: 'Asesinato', de: 'Mord', ja: '暗殺', ko: '살인', pl: 'Morderstwo', pt: 'Assassinato', tr: 'Cinayet' }},
                { value: 'death_execution', display: { en: 'Execution', zh: '处决', ru: 'Казнь', fr: 'Exécution', es: 'Ejecución', de: 'Hinrichtung', ja: '処刑', ko: '처형', pl: 'Egzekucja', pt: 'Execução', tr: 'İdam' }},
                { value: 'death_duel', display: { en: 'Duel', zh: '决斗', ru: 'Дуэль', fr: 'Duel', es: 'Duelo', de: 'Duell', ja: '決闘', ko: '결투', pl: 'Pojedynek', pt: 'Duelo', tr: 'Düello' }},
                { value: 'death_sacrificed_to_gods', display: { en: 'Sacrificed', zh: '献祭', ru: 'Жертвоприношение', fr: 'Sacrifice', es: 'Sacrificio', de: 'Opferung', ja: '生贄', ko: '제물', pl: 'Poświęcenie', pt: 'Sacrifício', tr: 'Kurban' }},
                { value: 'death_punishment', display: { en: 'Punishment', zh: '惩罚', ru: 'Наказание', fr: 'Punition', es: 'Castigo', de: 'Strafe', ja: '罰', ko: '처벌', pl: 'Kara', pt: 'Punição', tr: 'Ceza' }}
            ],
            desc: {
                en: "Quick-pick death reason for the kill (optional, overrides free text).",
                zh: "击杀的快速选择死因（可选，覆盖自由文本）。",
                ru: "Быстрый выбор причины смерти (необязательно, переопределяет свободный текст).",
                fr: "Raison de décès en sélection rapide (facultatif, remplace le texte libre).",
                es: "Causa de muerte de selección rápida (opcional, anula el texto libre).",
                de: "Schnellauswahl-Todesursache (optional, überschreibt Freitext).",
                ja: "殺害の簡単な死因選択（任意、自由テキストを上書き）。",
                ko: "살해에 대한 빠른 선택 사인(선택 사항, 자유 텍스트를 덮어씀).",
                pl: "Szybki wybór przyczyny śmierci (opcjonalne, zastępuje dowolny tekst).",
                pt: "Motivo de morte de seleção rápida (opcional, substitui o texto livre).",
                tr: "Ölüm nedeni için hızlı seçim (isteğe bağlı, serbest metni geçersiz kılar)."
            }
        },
        {
            name: "deathReason",
            type: "string",
            desc: {
                en: "Free-text death reason key (e.g. death_dungeon). Overridden by quickPick if selected.",
                zh: "自由文本死因键（例如 death_dungeon）。如果选择了快速选择，则被覆盖。",
                ru: "Свободный ключ причины смерти (например, death_dungeon). Переопределяется быстрым выбором, если он выбран.",
                fr: "Clé de raison de décès en texte libre (ex. death_dungeon). Remplacée par la sélection rapide si choisie.",
                es: "Clave de causa de muerte de texto libre (p. ej. death_dungeon). Anulada por selección rápida si se elige.",
                de: "Freitext-Schlüssel für Todesursache (z. B. death_dungeon). Wird durch Schnellauswahl überschrieben.",
                ja: "自由テキストの死因キー（例：death_dungeon）。クイックピックが選択されている場合は上書きされます。",
                ko: "자유 텍스트 사인 키(예: death_dungeon). 빠른 선택이 선택된 경우 무시됩니다.",
                pl: "Dowolny klucz przyczyny śmierci (np. death_dungeon). Zastąpiony przez szybki wybór, jeśli go wybrano.",
                pt: "Chave do motivo da morte em texto livre (ex: death_dungeon). Substituído por seleção rápida se escolhido.",
                tr: "Serbest metin ölüm nedeni anahtarı (örn. death_dungeon). Hızlı seçim seçilirse geçersiz kılınır."
            }
        }
    ],
	
    description: {
        en: `Executed when a character is killed by another. The source (character1) is the KILLER. The target (character2) is the character being KILLED.`,
        zh: `当一个角色被另一个角色杀死时执行。`,
        ru: `Выполняется, когда один персонаж убит другим.`,
        fr: `Exécuté lorsqu'un personnage est tué par un autre.`,
        es: `Ejecutado cuando un personaje es asesinado por otro.`,
        de: `Wird ausgeführt, wenn ein Charakter von einem anderen getötet wird.`,
        ja: `あるキャラクターが別のキャラクターに殺されたときに実行されます。`,
        ko: `한 캐릭터가 다른 캐릭터에게 살해당했을 때 실행됩니다.`,
        pl: `Wykonywane, gdy jedna postać zostaje zabita przez inną.`,
        pt: `Executado quando um personagem é morto por outro. A fonte (character1) é o ASSASSINO. O alvo (character2) é o personagem sendo MORTO.`,
        tr: `Bir karakter başka biri tarafından öldürüldüğünde çalıştırılır. Kaynak (character1) KATİL'dir. Hedef (character2) ÖLDÜRÜLEN karakterdir.`
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
        return !!source && !!target && sourceId !== targetId;
    },

    /**
     * @param {GameData} gameData 
     * @param {string[]} args 
     * @param {number} sourceId
     * @param {number} targetId
     * @returns {{success: boolean, message?: string}}
     */
    preCheck: (gameData, args, sourceId, targetId) => {
        const source = gameData.getCharacterById(sourceId);
        const target = gameData.getCharacterById(targetId);
        if (!source || !target) {
            return { success: false, message: "Source or target character not found." };
        }
        if (sourceId === targetId) {
            return { success: false, message: "A character cannot kill themselves via this action." };
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
    run: (gameData, runGameEffect, args, sourceId, targetId) =>{
        const quickPick = args && args[0] ? String(args[0]).trim() : "";
        const freeText = args && args[1] ? String(args[1]).trim() : "";

        let deathReason = quickPick || freeText;
        if (!deathReason) {
            deathReason = "death_murder";
        } else if (!deathReason.startsWith("death_")) {
            deathReason = `death_${deathReason}`;
        }
        deathReason = deathReason.toLowerCase().replace(/[^a-z0-9_]/g, "");

        runGameEffect(`
			global_var:votcce_action_target = {
				death = {
					death_reason = ${deathReason} killer = global_var:votcce_action_source
				}
            }`);
        if (deathReason === "death_murder") {
            runGameEffect(`
            global_var:votcce_action_source = {
                create_character_memory = {
                    type = successful_murder
                    participants = { victim = global_var:votcce_action_target }
                }
            }`);
        }
    },
    chatMessage: (args) => {
        const quickPick = args && args[0] ? String(args[0]).trim() : "";
        const freeText = args && args[1] ? String(args[1]).trim() : "";

        let deathReason = quickPick || freeText;
        if (!deathReason) {
            deathReason = "death_murder";
        } else if (!deathReason.startsWith("death_")) {
            deathReason = `death_${deathReason}`;
        }
        deathReason = deathReason.toLowerCase().replace(/[^a-z0-9_]/g, "");

        return {
            en: `{{character2Name}} was killed by {{character1Name}} (Reason: ${deathReason}).`,
            zh: `{{character2Name}}被{{character1Name}}杀死了（死因：${deathReason}）。`,
            ru: `{{character2Name}} был(а) убит(а) {{character1Name}} (Причина: ${deathReason}).`,
            fr: `{{character2Name}} a été tué(e) par {{character1Name}} (Raison: ${deathReason}).`,
            es: `{{character2Name}} fue asesinado(a) por {{character1Name}} (Motivo: ${deathReason}).`,
            de: `{{character2Name}} wurde von {{character1Name}} getötet (Ursache: ${deathReason}).`,
            ja: `{{character2Name}}は{{character1Name}}に殺されました（理由：${deathReason}）。`,
            ko: `{{character2Name}}가 {{character1Name}}에게 살해당했습니다 (사인: ${deathReason}).`,
            pl: `{{character2Name}} został(a) zabity(a) przez {{character1Name}} (Powód: ${deathReason}).`,
            pt: `{{character2Name}} foi morto(a) por {{character1Name}} (Motivo: ${deathReason}).`,
            tr: `{{character2Name}}, {{character1Name}} tarafından öldürüldü (Nedeni: ${deathReason}).`
        };
    },
    chatMessageClass: "negative-action-message",
}
