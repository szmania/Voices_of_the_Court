import json
import io
import sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

en_data = json.load(open('default_userdata/configs/prompts/en.json', 'r', encoding='utf-8'))
tr_data = json.load(open('default_userdata/configs/prompts/tr.json', 'r', encoding='utf-8'))
zh_data = json.load(open('default_userdata/configs/prompts/zh.json', 'r', encoding='utf-8'))

print('EN top-level keys:', list(en_data.keys()))
print('TR top-level keys:', list(tr_data.keys()))
print('ZH top-level keys:', list(zh_data.keys()))
print()

if 'prompts' in en_data:
    print('EN prompts keys:', list(en_data['prompts'].keys()))
if 'prompts' in tr_data:
    print('TR prompts keys:', list(tr_data['prompts'].keys()))
if 'prompts' in zh_data:
    print('ZH prompts keys:', list(zh_data['prompts'].keys()))

# Check if there are mod-specific prompts
for key in ['agot', 'lotr_realms_in_exile', 'the_fallen_eagle', 'warcraft_goa2', 'elder_kings_2', 'princes_of_darkness']:
    if key in en_data:
        print(f'EN has {key} key with {len(en_data[key])} subkeys')
        print(f'  Subkeys:', list(en_data[key].keys()))
    if key in tr_data:
        print(f'TR has {key} key with {len(tr_data[key])} subkeys')
    if key in zh_data:
        print(f'ZH has {key} key with {len(zh_data[key])} subkeys')