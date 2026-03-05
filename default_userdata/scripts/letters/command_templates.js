module.exports = {
    default: `
send_interface_message = { 
    type = votc_message_popup 
    title = votc_huixin_title{{letterNumber}}
    desc = "{{replyContent}}"
    #left_icon = global_var:message_second_scope_{{letterId}}
}
remove_global_variable ?= votc_{{letterId}}
create_artifact = {
    name = votc_huixin_title{{letterNumber}}
    description = "{{replyContent}}"
    type = journal
    visuals = scroll
    creator = global_var:message_second_scope_{{letterId}}
    modifier = artifact_monthly_minor_prestige_1_modifier
}`,
    secret_letter: `
send_interface_message = { 
    type = votc_message_popup 
    title = "A Secret Missive"
    desc = "{{replyContent}}"
    #left_icon = global_var:message_second_scope_{{letterId}}
}
remove_global_variable ?= votc_{{letterId}}
create_artifact = {
    name = "Secret Letter"
    description = "{{replyContent}}"
    type = secret
    visuals = scroll_encrypted
    creator = global_var:message_second_scope_{{letterId}}
    modifier = artifact_monthly_intrigue_1_modifier
}`
};
