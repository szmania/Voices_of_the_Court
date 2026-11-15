import json

# Read both files
with open('public/locales/en.json', 'r', encoding='utf-8') as f:
    en_data = json.load(f)

with open('public/locales/es.json', 'r', encoding='utf-8') as f:
    es_data = json.load(f)

def get_all_keys(data, prefix=''):
    keys = {}
    for key, value in data.items():
        full_key = f'{prefix}.{key}' if prefix else key
        keys[full_key] = value
        if isinstance(value, dict):
            keys.update(get_all_keys(value, full_key))
    return keys

def set_nested_key(data, key_path, value):
    key_list = key_path.split('.')
    current = data
    for k in key_list[:-1]:
        if k not in current:
            current[k] = {}
        current = current[k]
    current[key_list[-1]] = value

en_keys = get_all_keys(en_data)
es_keys = get_all_keys(es_data)

missing_keys = set(en_keys.keys()) - set(es_keys.keys())
extra_keys = set(es_keys.keys()) - set(en_keys.keys())

print(f'Total keys in en.json: {len(en_keys)}')
print(f'Total keys in es.json: {len(es_keys)}')
print(f'Missing keys in es.json: {len(missing_keys)}')
print(f'Extra keys in es.json: {len(extra_keys)}')

# Add missing keys to es_data with English values as fallback
added_count = 0
for key in missing_keys:
    set_nested_key(es_data, key, en_keys[key])
    added_count += 1

# Save updated es.json
with open('public/locales/es.json', 'w', encoding='utf-8') as f:
    json.dump(es_data, f, ensure_ascii=False, indent=2)

print('\nUpdated es.json saved successfully!')
print(f'Added {added_count} keys')
print(f'Total keys after update: {len(es_keys) + added_count}')