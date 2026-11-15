import json

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def recursive_sync(source, target):
    for key, value in source.items():
        if isinstance(value, dict):
            if key not in target or not isinstance(target.get(key), dict):
                target[key] = {}
            recursive_sync(value, target[key])
        elif isinstance(value, list):
            if key not in target or not isinstance(target.get(key), list):
                target[key] = []
            target[key] = value
        else:
            if key not in target:
                target[key] = value

en_data = load_json('public/locales/en.json')
ru_data = load_json('public/locales/ru.json')

recursive_sync(en_data, ru_data)
save_json('public/locales/ru.json', ru_data)

print('Synchronization complete.')
