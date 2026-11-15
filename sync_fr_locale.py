import json

def sync_dicts(en_dict, fr_dict):
    """
    Recursively synchronize fr_dict with en_dict.
    - Adds missing keys from en_dict with English values as fallback
    - Keeps existing French values
    - Maintains the same structure as en_dict
    """
    result = {}
    for key, en_value in en_dict.items():
        if key in fr_dict:
            fr_value = fr_dict[key]
            if isinstance(en_value, dict) and isinstance(fr_value, dict):
                # Both are dicts, recurse
                result[key] = sync_dicts(en_value, fr_value)
            else:
                # Keep existing French value (even if types mismatch, prefer existing translation)
                result[key] = fr_value
        else:
            # Key is missing in French, use English value as fallback
            result[key] = en_value
    return result

def main():
    # Load English locale
    with open('public/locales/en.json', 'r', encoding='utf-8') as f:
        en_data = json.load(f)
    
    # Load French locale
    with open('public/locales/fr.json', 'r', encoding='utf-8') as f:
        fr_data = json.load(f)
    
    # Synchronize
    synced_fr_data = sync_dicts(en_data, fr_data)
    
    # Count keys
    def count_keys(obj):
        count = 0
        for k, v in obj.items():
            count += 1
            if isinstance(v, dict):
                count += count_keys(v)
        return count
    
    print(f'Original fr.json keys: {count_keys(fr_data)}')
    print(f'en.json keys: {count_keys(en_data)}')
    print(f'Synced fr.json keys: {count_keys(synced_fr_data)}')
    
    # Save the updated French locale
    with open('public/locales/fr.json', 'w', encoding='utf-8') as f:
        json.dump(synced_fr_data, f, ensure_ascii=False, indent=2)
    
    print('Successfully synchronized public/locales/fr.json with public/locales/en.json')

if __name__ == '__main__':
    main()