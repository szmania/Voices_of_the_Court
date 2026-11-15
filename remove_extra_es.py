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

en_keys = get_all_keys(en_data)
es_keys = get_all_keys(es_data)

# Find extra keys (keys in es but not in en)
extra = set(es_keys.keys()) - set(en_keys.keys())

print(f'Removing {len(extra)} extra keys from es.json')
for key in sorted(extra):
    print(f'  Extra key: {key}')

# Build a set of all en key paths for filtering
en_set = set(en_keys.keys())

def filter_es_data(data, parent_path=''):
    """Recursively filter es_data to only keep keys that exist in en.json"""
    if not isinstance(data, dict):
        return data
    
    result = {}
    for key, value in data.items():
        full_key = f'{parent_path}.{key}' if parent_path else key
        
        # Check if this key path exists in en.json
        if full_key in en_set:
            # Key exists in en.json, keep it (recursively process children)
            result[key] = filter_es_data(value, full_key)
        else:
            # Key does NOT exist in en.json, skip it
            pass
    
    return result

filtered_es = filter_es_data(es_data)

print(f'\nOriginal es.json had {len(es_keys)} keys')
print(f'Filtered es.json now has {len(get_all_keys(filtered_es))} keys')

# Save the updated es.json
with open('public/locales/es.json', 'w', encoding='utf-8') as f:
    json.dump(filtered_es, f, ensure_ascii=False, indent=2)

print('\nUpdated es.json saved successfully!')