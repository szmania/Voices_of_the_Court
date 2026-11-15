import json
import sys

with open('public/locales/en.json', 'r', encoding='utf-8') as f:
    en_data = json.load(f)

with open('public/locales/fr.json', 'r', encoding='utf-8') as f:
    fr_data = json.load(f)

def get_all_keys(obj, prefix=''):
    keys = {}
    for key, value in obj.items():
        full_key = f'{prefix}.{key}' if prefix else key
        keys[full_key] = value
        if isinstance(value, dict):
            keys.update(get_all_keys(value, full_key))
    return keys

en_keys = get_all_keys(en_data)
fr_keys = get_all_keys(fr_data)

missing_keys = set(en_keys.keys()) - set(fr_keys.keys())
extra_keys = set(fr_keys.keys()) - set(en_keys.keys())

print(f'Total keys in en.json: {len(en_keys)}', file=sys.stderr)
print(f'Total keys in fr.json: {len(fr_keys)}', file=sys.stderr)
print(f'Missing keys in fr.json: {len(missing_keys)}', file=sys.stderr)
print(f'Extra keys in fr.json: {len(extra_keys)}', file=sys.stderr)

print('MISSING_KEYS_START')
for key in sorted(missing_keys):
    print(f'{key}|{json.dumps(en_keys[key], ensure_ascii=False)}')
print('MISSING_KEYS_END')

if extra_keys:
    print('EXTRA_KEYS_START', file=sys.stderr)
    for key in sorted(extra_keys):
        print(f'{key}|{json.dumps(fr_keys[key], ensure_ascii=False)}', file=sys.stderr)
    print('EXTRA_KEYS_END', file=sys.stderr)