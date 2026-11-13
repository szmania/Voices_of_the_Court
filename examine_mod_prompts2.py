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

for mod in ['A Game of Thrones', 'LotR: Realms in Exile', 'The Fallen Eagle', 'Warcraft: Guardians of Azeroth 2', 'Elder Kings 2', 'Princes of Darkness']:
    print(f'\n=== {mod} ===')
    en_mod_prompts = en_mod.get(mod, {})
    tr_mod_prompts = tr_mod.get(mod, {})
    zh_mod_prompts = zh_mod.get(mod, {})
    
    print(f'EN type: {type(en_mod_prompts)}, keys: {list(en_mod_prompts.keys()) if isinstance(en_mod_prompts, dict) else "N/A"}')
    print(f'TR type: {type(tr_mod_prompts)}, keys: {list(tr_mod_prompts.keys()) if isinstance(tr_mod_prompts, dict) else "N/A"}')
    print(f'ZH type: {type(zh_mod_prompts)}, keys: {list(zh_mod_prompts.keys()) if isinstance(zh_mod_prompts, dict) else "N/A"}')
    
    if isinstance(en_mod_prompts, dict):
        for k, v in en_mod_prompts.items():
            print(f'  EN.{k}: {str(v)[:100]}')
    if isinstance(tr_mod_prompts, dict):
        for k, v in tr_mod_prompts.items():
            print(f'  TR.{k}: {str(v)[:100]}')
    if isinstance(zh_mod_prompts, dict):
        for k, v in zh_mod_prompts.items():
            print(f'  ZH.{k}: {str(v)[:100]}')