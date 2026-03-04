//Made by: GitHub Sync

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "noOp",
    args: [],
    description: {
        en: `No operation - does nothing.`,
        zh: `无操作 - 什么都不做。`,
        ru: `Нет операции - ничего не делает.`,
        fr: `Aucune opération - ne fait rien.`,
        es: `Sin operación - no hace nada.`,
        de: `Keine Operation - tut nichts.`,
        ja: `操作なし - 何もしません。`,
        ko: `작업 없음 - 아무것도 하지 않습니다.`,
        pl: `Brak operacji - nic nie robi.`
    },

    /**
     * @param {GameData} gameData 
     */
    check: (gameData) => {
        return true;
    },

    /**
     * @param {GameData} gameData 
     * @param {Function} runGameEffect
     * @param {string[]} args 
     */
    run: (gameData, runGameEffect, args) => {
        // No operation
    },
    chatMessage: (args) =>{
        return {
            en: `Nothing happened.`,
            zh: `什么都没发生。`,
            ru: `Ничего не произошло.`,
            fr: `Rien ne s'est passé.`,
            es: `No pasó nada.`,
            de: `Nichts ist passiert.`,
            ja: `何も起こりませんでした。`,
            ko: `아무 일도 일어나지 않았습니다.`,
            pl: `Nic się nie stało.`
        }
    },
    chatMessageClass: "neutral-action-message"
}
