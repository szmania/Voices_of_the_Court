import json
import sys

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def get_all_keys(data, prefix=''):
    keys = {}
    for key, value in data.items():
        full_key = f'{prefix}{key}'
        keys[full_key] = value
        if isinstance(value, dict):
            keys.update(get_all_keys(value, f'{full_key}.'))
    return keys

en_data = load_json('public/locales/en.json')
ko_data = load_json('public/locales/ko.json')

en_keys = set(get_all_keys(en_data).keys())
ko_keys = set(get_all_keys(ko_data).keys())

print('en keys:', len(en_keys), file=sys.stderr)
print('ko keys:', len(ko_keys), file=sys.stderr)
print('Missing in ko:', len(en_keys - ko_keys), file=sys.stderr)
print('Extra in ko:', len(ko_keys - en_keys), file=sys.stderr)

for k in sorted(en_keys - ko_keys)[:10]:
    print('  Missing in ko:', k, file=sys.stderr)
for k in sorted(ko_keys - en_keys)[:10]:
    print('  Extra in ko:', k, file=sys.stderr)