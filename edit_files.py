
import re
import sys

def add_can_perform_at_distance(file_path, can_perform_at_distance):
    with open(file_path, 'r', encoding='utf-8') as f:

    # Remove existing canPerformAtDistance attribute
    content = re.sub(r'\s*canPerformAtDistance: (true|false),?\s*', '', content)

    # Add the canPerformAtDistance attribute after the description block
    content = re.sub(r'(description: {[^}]*},)', r'\\1\n  canPerformAtDistance: ' + str(can_perform_at_distance).lower() + ',', content)

    with open(file_path, 'w', encoding='utf-8') as f:

if __name__ == '__main__':
    files_to_update = {
        'default_userdata/scripts/actions/standard/leaveConversation.js': False,
        'default_userdata/scripts/actions/standard/lowerOpinion.js': True,
        'default_userdata/scripts/actions/standard/marryOrBetroth.js': True,
        'default_userdata/scripts/actions/standard/newAllianceDiplomatic.js': True,
        'default_userdata/scripts/actions/standard/noOp.js': True,
        'default_userdata/scripts/actions/standard/offerVassalage.js': True,
        'default_userdata/scripts/actions/standard/receiveGold.js': True,
        'default_userdata/scripts/actions/standard/undressCharacter.js': False,
        'default_userdata/scripts/actions/standard/woundCharacter.js': False,
    }

    for file_path, value in files_to_update.items():
        add_can_perform_at_distance(file_path, value)