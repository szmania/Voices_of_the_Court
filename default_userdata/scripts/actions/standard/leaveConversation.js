//Made by: GitHub Sync

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */
module.exports = {
    signature: "leaveConversation",
    args: [],
    description: {
        en: `Executed when a character leaves the conversation. The target (character2) is the character who is leaving. The source (character1) is not used.`,
        zh: `当一个角色离开对话时执行。`,
        ru: `Выполняется, когда персонаж покидает разговор.`,
        fr: `Exécuté lorsqu'un personnage quitte la conversation.`,
        es: `Ejecutado cuando un personaje abandona la conversación.`,
        de: `Wird ausgeführt, wenn ein Charakter das Gespräch verlässt.`,
        ja: `キャラクターが会話を離れたときに実行されます。`,
        ko: `캐릭터가 대화를 떠날 때 실행됩니다.`,
        pl: `Wykonywane, gdy postać opuszcza rozmowę.`
    },

    /**
     * @param {GameData} gameData 
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) => {
        // Get all characters except the player
        const allIds = Array.from(gameData.characters.keys());
        const validTargets = allIds.filter((id) => id !== gameData.playerID);

        return {
            canExecute: validTargets.length > 1,
            validTargetCharacterIds: validTargets
        };
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
                remove_list_global_variable = {
                    name = mcc_characters_list_v2
                    target = global_var:votcce_action_target
                }
                if ={
                    limit = {
                        global_var:mcc_character_0 = global_var:votcce_action_target
                    }
                    remove_global_variable = mcc_character_0
                    if = {
                        limit = { 
                            global_variable_list_size = {
                                name = mcc_characters_list_v2
                                value > 15
                            }
                        }
                        ordered_in_global_list = {
                            variable = mcc_characters_list_v2
                            position = 15
                            set_global_variable = {
                                name = mcc_character_0
                                value = this
                            }
                        }
                    }
                }
                if ={
                    limit = {
                        global_var:mcc_character_1 = global_var:votcce_action_target
                    }
                    remove_global_variable = mcc_character_1
                    if = {
                        limit = { 
                            global_variable_list_size = {
                                name = mcc_characters_list_v2
                                value > 15
                            }
                        }
                        ordered_in_global_list = {
                            variable = mcc_characters_list_v2
                            position = 15
                            set_global_variable = {
                                name = mcc_character_1
                                value = this
                            }
                        }
                    }
                }
                if ={
                    limit = {
                        global_var:mcc_character_2 = global_var:votcce_action_target
                    }
                    remove_global_variable = mcc_character_2   
                    if = {
                        limit = { 
                            global_variable_list_size = {
                                name = mcc_characters_list_v2
                                value > 15
                            }
                        }
                        ordered_in_global_list = {
                            variable = mcc_characters_list_v2
                            position = 15
                            set_global_variable = {
                                name = mcc_character_2
                                value = this
                            }
                        }
                    }
                }
                if ={
                    limit = {
                        global_var:mcc_character_3 = global_var:votcce_action_target
                    }
                    remove_global_variable = mcc_character_3
                    if = {
                        limit = { 
                            global_variable_list_size = {
                                name = mcc_characters_list_v2
                                value > 15
                            }
                        }
                        ordered_in_global_list = {
                            variable = mcc_characters_list_v2
                            position = 15
                            set_global_variable = {
                                name = mcc_character_3
                                value = this
                            }
                        }
                    }
                }
                if ={
                    limit = {
                        global_var:mcc_character_4 = global_var:votcce_action_target
                    }
                    remove_global_variable = mcc_character_4   
                    if = {
                        limit = { 
                            global_variable_list_size = {
                                name = mcc_characters_list_v2
                                value > 15
                            }
                        }
                        ordered_in_global_list = {
                            variable = mcc_characters_list_v2
                            position = 15
                            set_global_variable = {
                                name = mcc_character_4
                                value = this
                            }
                        }
                    }
                }
                if ={
                    limit = {
                        global_var:mcc_character_5 = global_var:votcce_action_target
                    }
                    remove_global_variable = mcc_character_5
                    if = {
                        limit = { 
                            global_variable_list_size = {
                                name = mcc_characters_list_v2
                                value > 15
                            }
                        }
                        ordered_in_global_list = {
                            variable = mcc_characters_list_v2
                            position = 15
                            set_global_variable = {
                                name = mcc_character_5
                                value = this
                            }
                        }
                    }
                }
                if ={
                    limit = {
                        global_var:mcc_character_6 = global_var:votcce_action_target
                    }
                    remove_global_variable = mcc_character_6
                    if = {
                        limit = { 
                            global_variable_list_size = {
                                name = mcc_characters_list_v2
                                value > 6
                            }
                        }
                        ordered_in_global_list = {
                            variable = mcc_characters_list_v2
                            position = 6
                            set_global_variable = {
                                name = mcc_character_6
                                value = this
                            }
                        }
                    }
                } 
                if ={
                    limit = {
                        global_var:mcc_character_7 = global_var:votcce_action_target
                    }
                    remove_global_variable = mcc_character_7
                    if = {
                        limit = { 
                            global_variable_list_size = {
                                name = mcc_characters_list_v2
                                value > 7
                            }
                        }
                        ordered_in_global_list = {
                            variable = mcc_characters_list_v2
                            position = 7
                            set_global_variable = {
                                name = mcc_character_7
                                value = this
                            }
                        }
                    }
                }
                if ={
                    limit = {
                        global_var:mcc_character_8 = global_var:votcce_action_target
                    }
                    remove_global_variable = mcc_character_8
                    if = {
                        limit = { 
                            global_variable_list_size = {
                                name = mcc_characters_list_v2
                                value > 8
                            }
                        }
                        ordered_in_global_list = {
                            variable = mcc_characters_list_v2
                            position = 8
                            set_global_variable = {
                                name = mcc_character_8
                                value = this
                            }
                        }
                    }
                }
                if ={
                    limit = {
                        global_var:mcc_character_9 = global_var:votcce_action_target
                    }
                    remove_global_variable = mcc_character_9
                    if = {
                        limit = { 
                            global_variable_list_size = {
                                name = mcc_characters_list_v2
                                value > 9
                            }
                        }
                        ordered_in_global_list = {
                            variable = mcc_characters_list_v2
                            position = 9
                            set_global_variable = {
                                name = mcc_character_9
                                value = this
                            }
                        }
                    }
                }
                if ={
                    limit = {
                        global_var:mcc_character_10 = global_var:votcce_action_target
                    }
                    remove_global_variable = mcc_character_10
                    if = {
                        limit = { 
                            global_variable_list_size = {
                                name = mcc_characters_list_v2
                                value > 10
                            }
                        }
                        ordered_in_global_list = {
                            variable = mcc_characters_list_v2
                            position = 10
                            set_global_variable = {
                                name = mcc_character_10
                                value = this
                            }
                        }
                    }
                }
                if ={
                    limit = {
                        global_var:mcc_character_11 = global_var:votcce_action_target
                    }
                    remove_global_variable = mcc_character_11
                    if = {
                        limit = { 
                            global_variable_list_size = {
                                name = mcc_characters_list_v2
                                value > 11
                            }
                        }
                        ordered_in_global_list = {
                            variable = mcc_characters_list_v2
                            position = 11
                            set_global_variable = {
                                name = mcc_character_11
                                value = this
                            }
                        }
                    }
                }
                if ={
                    limit = {
                        global_var:mcc_character_12 = global_var:votcce_action_target
                    }
                    remove_global_variable = mcc_character_12
                    if = {
                        limit = { 
                            global_variable_list_size = {
                                name = mcc_characters_list_v2
                                value > 12
                            }
                        }
                        ordered_in_global_list = {
                            variable = mcc_characters_list_v2
                            position = 12
                            set_global_variable = {
                                name = mcc_character_12
                                value = this
                            }
                        }
                    }
                }
                if ={
                    limit = {
                        global_var:mcc_character_13 = global_var:votcce_action_target
                    }
                    remove_global_variable = mcc_character_13
                    if = {
                        limit = { 
                            global_variable_list_size = {
                                name = mcc_characters_list_v2
                                value > 13
                            }
                        }
                        ordered_in_global_list = {
                            variable = mcc_characters_list_v2
                            position = 13
                            set_global_variable = {
                                name = mcc_character_13
                                value = this
                            }
                        }
                    }
                }
                if ={
                    limit = {
                        global_var:mcc_character_14 = global_var:votcce_action_target
                    }
                    remove_global_variable = mcc_character_14
                    if = {
                        limit = { 
                            global_variable_list_size = {
                                name = mcc_characters_list_v2
                                value > 14
                            }
                        }
                        ordered_in_global_list = {
                            variable = mcc_characters_list_v2
                            position = 14
                            set_global_variable = {
                                name = mcc_character_14
                                value = this
                            }
                        }
                    }
                }
                if ={
                    limit = {
                        global_var:mcc_character_15 = global_var:votcce_action_target
                    }
                    remove_global_variable = mcc_character_15
                    if = {
                        limit = { 
                            global_variable_list_size = {
                                name = mcc_characters_list_v2
                                value > 15
                            }
                        }
                        ordered_in_global_list = {
                            variable = mcc_characters_list_v2
                            position = 15
                            set_global_variable = {
                                name = mcc_character_15
                                value = this
                            }
                        }
                    }
                }            
            `);
    },
    chatMessage: (args) =>{
        return {
            en: `{{character2Name}} left the conversation.`,
            zh: `{{character2Name}}离开了对话。`,
            ru: `{{character2Name}} покинул разговор.`,
            fr: `{{character2Name}} a quitté la conversation.`,
            es: `{{character2Name}} abandonó la conversación.`,
            de: `{{character2Name}} hat das Gespräch verlassen.`,
            ja: `{{character2Name}}は会話を離れました。`,
            ko: `{{character2Name}}가 대화를 떠났습니다。`,
            pl: `{{character2Name}} opuścił rozmowę.`
        }
    },
    chatMessageClass: "neutral-action-message"
}
