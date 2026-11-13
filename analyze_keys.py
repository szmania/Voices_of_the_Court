import json

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
        keys[full_key] = k
        if isinstance(v, dict):
            keys.update(get_all_keys(v, full_key))
    return keys

en_keys = get_all_keys(en_data)
tr_keys = get_all_keys(tr_data)
zh_keys = get_all_keys(zh_data)

missing_tr = [k for k in en_keys if k not in tr_keys]
missing_zh = [k for k in en_keys if k not in zh_keys]

# Write results to a file
with open('missing_keys.txt', 'w', encoding='utf-8') as f:
    f.write(f'Total EN keys: {len(en_keys)}\n')
    f.write(f'Total TR keys: {len(tr_keys)}\n')
    f.write(f'Total ZH keys: {len(zh_keys)}\n\n')
    f.write(f'Missing in TR ({len(missing_tr)}):\n')
    for k in sorted(missing_tr):
        f.write(f'  {k}\n')
    f.write(f'\nMissing in ZH ({len(missing_zh)}):\n')
    for k in sorted(missing_zh):
        f.write(f'  {k}\n')

print('Analysis complete. Results written to missing_keys.txt')
print(f'Missing in TR: {len(missing_tr)}')
print(f'Missing in ZH: {len(missing_zh)}')