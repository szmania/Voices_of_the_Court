import json

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

en_data = load_json('public/locales/en.json')
ru_data = load_json('public/locales/ru.json')

en_top_keys = set(en_data.keys())
ru_top_keys = set(ru_data.keys())

missing_top = en_top_keys - ru_top_keys
print(f'Missing top-level keys in ru.json: {missing_top}')

sections_to_check = ['app', 'nav', 'actions', 'settings', 'summarization', 'prompts', 'letters', 'diaries']
for section in sections_to_check:
    en_section = en_data.get(section, {})
    ru_section = ru_data.get(section, {})
    en_keys = set(en_section.keys())
    ru_keys = set(ru_section.keys())
    missing = en_keys - ru_keys
    print(f'Section "{section}": Missing keys: {missing}')
