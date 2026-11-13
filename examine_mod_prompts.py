import json
import io
import sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

en_data = json.load(open('default_userdata/configs/prompts/en.json', 'r', encoding='utf-8'))
tr_data = json.load(open('default_userdata/configs/prompts/tr.json', 'r', encoding='utf-8'))
zh_data = json.load(open('default_userdata/configs/prompts/zh.json', 'r', encoding='utf-8'))

en_mod = en_data.get('mod_prompt_sets', {})
tr_mod = tr_data.get('mod_prompt_sets', {})
zh_mod = zh_data.get('mod_prompt_sets', {})

print('EN mod_prompt_sets keys:', list(en_mod.keys()))
print('TR mod_prompt_sets keys:', list(tr_mod.keys()))
print('ZH mod_prompt_sets keys:', list(zh_mod.keys()))
print()

# Check each mod
for mod in ['agot', 'lotr_realms_in_exile', 'the_fallen_eagle', 'warcraft_goa2', 'elder_kings_2', 'princes_of_darkness']:
    print(f'\n=== {mod} ===')
    en_mod_prompts = en_mod.get(mod, {})
    tr_mod_prompts = tr_mod.get(mod, {})
    zh_mod_prompts = zh_mod.get(mod, {})
    
    en_keys = set(en_mod_prompts.keys())
    tr_keys = set(tr_mod_prompts.keys())
    zh_keys = set(zh_mod_prompts.keys())
    
    print(f'EN keys: {len(en_keys)} - {sorted(en_keys)}')
    print(f'TR keys: {len(tr_keys)} - {sorted(tr_keys)}')
    print(f'ZH keys: {len(zh_keys)} - {sorted(zh_keys)}')
    
    missing_tr = en_keys - tr_keys
    missing_zh = en_keys - zh_keys
    
    if missing_tr:
        print(f'Missing in TR: {sorted(missing_tr)}')
    if missing_zh:
        print(f'Missing in ZH: {sorted(missing_zh)}')