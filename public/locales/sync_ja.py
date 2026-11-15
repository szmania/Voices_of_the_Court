import json

# Load English and Japanese locale files
with open(r'C:\Users\PDitty\Documents\MEGA\My_Mods\ck3\Voices_of_the_Court-2\public\locales\en.json', 'r', encoding='utf-8') as f:
    en_data = json.load(f)

with open(r'C:\Users\PDitty\Documents\MEGA\My_Mods\ck3\Voices_of_the_Court-2\public\locales\ja.json', 'r', encoding='utf-8') as f:
    ja_data = json.load(f)

def get_value_by_path(data, path):
    keys = path.split('.')
    for key in keys:
        if isinstance(data, dict) and key in data:
            data = data[key]
        else:
            return None
    return data

def set_value_by_path(data, path, value):
    keys = path.split('.')
    for key in keys[:-1]:
        if key not in data:
            data[key] = {}
        data = data[key]
    data[keys[-1]] = value

def get_all_keys(obj, prefix=''):
    keys = []
    for key, value in obj.items():
        full_key = f'{prefix}.{key}' if prefix else key
        if isinstance(value, dict):
            keys.extend(get_all_keys(value, full_key))
        else:
            keys.append(full_key)
    return keys

en_keys = get_all_keys(en_data)
ja_keys = get_all_keys(ja_data)

missing_keys = set(en_keys) - set(ja_keys)

for key in missing_keys:
    value = get_value_by_path(en_data, key)
    set_value_by_path(ja_data, key, value)

# Write updated Japanese locale file
with open(r'C:\Users\PDitty\Documents\MEGA\My_Mods\ck3\Voices_of_the_Court-2\public\locales\ja.json', 'w', encoding='utf-8') as f:
    json.dump(ja_data, f, indent=2, ensure_ascii=False)

print(f'Synchronized {len(missing_keys)} keys.')
