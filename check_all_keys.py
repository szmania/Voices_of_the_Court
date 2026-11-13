import json
import io
import sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

en_path = 'default_userdata/configs/prompts/en.json'
tr_path = 'default_userdata/configs/prompts/tr.json'
zh_path = 'default_userdata/configs/prompts/zh.json'

en_data = json.load(open(en_path, 'r', encoding='utf-8'))
tr_data = json.load(open(tr_path, 'r', encoding='utf-8'))
zh_data = json.load(open(zh_path, 'r', encoding='utf-8'))

def get_all_keys(d, prefix=''):
    keys = {}
    for k, v in d.items():
        full_key = f'{prefix}.{k}' if prefix else k
        keys[full_key] = v
        if isinstance(v, dict):
            keys.update(get_all_keys(v, full_key))
    return keys

en_keys = get_all_keys(en_data)
tr_keys = get_all_keys(tr_data)
zh_keys = get_all_keys(zh_data)

missing_tr = [k for k in en_keys if k not in tr_keys]
missing_zh = [k for k in en_keys if k not in zh_keys]

print('Total EN keys:', len(en_keys))
print('Total TR keys:', len(tr_keys))
print('Total ZH keys:', len(zh_keys))
print()
print('Missing in TR:', len(missing_tr))
print('Missing in ZH:', len(missing_zh))
print()

if missing_tr:
    print('=== Missing in Turkish ===')
    for k in sorted(missing_tr):
        print(f'  {k}')
        # Show the English value
        print(f'    EN: {str(en_keys[k])[:100]}')
        print()

if missing_zh:
    print('=== Missing in Chinese ===')
    for k in sorted(missing_zh):
        print(f'  {k}')
        # Show the English value
        print(f'    EN: {str(en_keys[k])[:100]}')
        print()