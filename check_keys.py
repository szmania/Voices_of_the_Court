import json

def count_keys(obj):
    count = 0
    for k, v in obj.items():
        count += 1
        if isinstance(v, dict):
            count += count_keys(v)
    return count

with open('public/locales/en.json', 'r', encoding='utf-8') as f:
    en_data = json.load(f)

with open('public/locales/fr.json', 'r', encoding='utf-8') as f:
    fr_data = json.load(f)

print(f'en.json keys: {count_keys(en_data)}')
print(f'fr.json keys: {count_keys(fr_data)}')
print(f'Match: {count_keys(en_data) == count_keys(fr_data)}')