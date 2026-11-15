import json

with open('public/locales/en.json', 'r', encoding='utf-8') as f:
    en_data = json.load(f)

with open('public/locales/es.json', 'r', encoding='utf-8') as f:
    es_data = json.load(f)

def get_all_keys(data, prefix=''):
    keys = set()
    for key, value in data.items():
        full_key = f'{prefix}.{key}' if prefix else key
        keys.add(full_key)
        if isinstance(value, dict):
            keys.update(get_all_keys(value, full_key))
    return keys

en_keys = get_all_keys(en_data)
es_keys = get_all_keys(es_data)

missing = en_keys - es_keys
extra = es_keys - en_keys

print(f'en.json keys: {len(en_keys)}')
print(f'es.json keys: {len(es_keys)}')
print(f'Missing in es: {len(missing)}')
print(f'Extra in es: {len(extra)}')

if not missing and not extra:
    print('SUCCESS: es.json has full parity with en.json!')
else:
    if missing:
        print('\nMissing keys (first 10):')
        for k in sorted(list(missing)[:10]):
            print(f'  {k}')
    if extra:
        print('\nExtra keys:')
        for k in sorted(extra):
            print(f'  {k}')