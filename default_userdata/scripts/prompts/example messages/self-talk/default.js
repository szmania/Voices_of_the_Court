/**
 * @param {import('../../../gamedata_typedefs.js').GameData} gameData
 * @param {number} characterId
 * @returns {import('../../../../main/ts/conversation_interfaces.js').Message[]}
 */
function getExampleMessages(gameData, characterId) {
    const character = gameData.getCharacter(characterId);
    const playerName = character.fullName;

    return [
        {
            role: "user",
            name: playerName,
            content: "What should I do about the upcoming council meeting?"
        },
        {
            role: "assistant",
            name: playerName,
            content: "The Baron will surely oppose my proposal. I need to secure the support of the Guildmaster beforehand. Perhaps a private word, a shared drink... or a shared interest could sway him. I must be careful; the Baron has eyes everywhere."
        },
        {
            role: "user",
            name: playerName,
            content: "And what of the rumors about the northern border?"
        },
        {
            role: "assistant",
            name: playerName,
            content: "Whispers of raids and strange creatures... If they are true, the kingdom is in more danger than the Regent admits. I should send a scout to investigate, discreetly. I cannot rely on official reports alone. My own people must be my eyes and ears."
        }
    ];
}

module.exports = getExampleMessages;
