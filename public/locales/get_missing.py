import json

with open(r'C:\Users\PDitty\Documents\MEGA\My_Mods\ck3\Voices_of_the_Court-2\public\locales\en.json', 'r', encoding='utf-8') as f:
    en_data = json.load(f)

with open(r'C:\Users\PDitty\Documents\MEGA\My_Mods\ck3\Voices_of_the_Court-2\public\locales\ru.json', 'r', encoding='utf-8') as f:
    ru_data = json.load(f)

def get_all_keys(obj, prefix=''):
    keys = {}
    for key, value in obj.items():
        full_key = f'{prefix}.{key}' if prefix else key
        keys[full_key] = value
        if isinstance(value, dict):
            keys.update(get_all_keys(value, full_key))
    return keys

en_keys = get_all_keys(en_data)
ru_keys = get_all_keys(ru_data)

missing_keys = set(en_keys.keys()) - set(ru_keys.keys())

with open(r'C:\Users\PDitty\Documents\MEGA\My_Mods\ck3\Voices_of_the_Court-2\public\locales\missing_keys_list.txt', 'w', encoding='utf-8') as out:
    for key in sorted(missing_keys):
        out.write(key + '\n')
    out.write(f'\nTotal missing: {len(missing_keys)}')

print('Done')