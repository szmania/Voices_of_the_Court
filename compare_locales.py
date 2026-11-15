import json
import copy

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def get_all_keys(data, prefix=''):
    """Get all keys in a nested dict with their full path."""
    keys = {}
    for key, value in data.items():
        full_key = f'{prefix}{key}'
        keys[full_key] = value
        if isinstance(value, dict):
            keys.update(get_all_keys(value, f'{full_key}.'))
    return keys

def set_nested_key(data, key_path, value):
    """Set a nested key using dot notation."""
    keys = key_path.split('.')
    current = data
    for k in keys[:-1]:
        if k not in current:
            current[k] = {}
        current = current[k]
    current[keys[-1]] = value

def merge_locales(en_data, ko_data):
    """Merge en.json keys into ko.json, using English as fallback for missing keys."""
    en_keys = get_all_keys(en_data)
    ko_keys = get_all_keys(ko_data)
    
    missing_keys = {}
    for key, value in en_keys.items():
        if key not in ko_keys:
            missing_keys[key] = value
    
    # Create a deep copy of ko_data to modify
    result = copy.deepcopy(ko_data)
    
    # Add missing keys with English fallback values
    for key, value in missing_keys.items():
        set_nested_key(result, key, value)
    
    return result, missing_keys

# Load files
en_data = load_json('public/locales/en.json')
ko_data = load_json('public/locales/ko.json')

# Merge
result, missing_keys = merge_locales(en_data, ko_data)

print(f'Total keys in en.json: {len(get_all_keys(en_data))}')
print(f'Total keys in ko.json: {len(get_all_keys(ko_data))}')
print(f'Missing keys added: {len(missing_keys)}')

# Save updated ko.json
save_json('public/locales/ko.json', result)
print('Updated ko.json saved!')

# Print first 20 missing keys
for i, (k, v) in enumerate(missing_keys.items()):
    if i < 30:
        print(f'  {k}: {str(v)[:100]}')

if len(missing_keys) > 30:
    print(f'... and {len(missing_keys) - 30} more missing keys')