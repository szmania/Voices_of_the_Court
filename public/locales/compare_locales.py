import json
import sys

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
extra_keys = set(ru_keys.keys()) - set(en_keys.keys())

with open(r'C:\Users\PDitty\Documents\MEGA\My_Mods\ck3\Voices_of_the_Court-2\public\locales\comparison_output.txt', 'w', encoding='utf-8') as out:
    out.write(f'Total keys in en.json: {len(en_keys)}\n')
    out.write(f'Total keys in ru.json: {len(ru_keys)}\n')
    out.write(f'Missing keys in ru.json: {len(missing_keys)}\n')
    out.write(f'Extra keys in ru.json: {len(extra_keys)}\n\n')
    
    missing_by_section = {}
    for key in sorted(missing_keys):
        section = key.split('.')[0]
        if section not in missing_by_section:
            missing_by_section[section] = []
        missing_by_section[section].append(key)
    
    out.write('Missing keys by section:\n')
    for section, keys in missing_by_section.items():
        out.write(f'  {section}: {len(keys)} keys\n')
        for k in keys[:5]:
            out.write(f'    - {k}\n')
        if len(keys) > 5:
            out.write(f'    ... and {len(keys) - 5} more\n')
    
    if extra_keys:
        out.write('\nExtra keys in ru.json:\n')
        for key in sorted(extra_keys):
            out.write(f'  - {key}\n')

print('Comparison complete')