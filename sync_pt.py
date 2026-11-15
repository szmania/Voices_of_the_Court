import json
import sys

en_path = r"C:\Users\PDitty\Documents\MEGA\My_Mods\ck3\Voices_of_the_Court-2\public\locales\en.json"
pt_path = r"C:\Users\PDitty\Documents\MEGA\My_Mods\ck3\Voices_of_the_Court-2\public\locales\pt.json"

# Read both files
with open(en_path, 'r', encoding='utf-8') as f:
    en_data = json.load(f)

with open(pt_path, 'r', encoding='utf-8') as f:
    pt_data = json.load(f)

def deep_merge(source, target):
    """
    Recursively merge source dict into target dict.
    For keys present in source but missing in target, add them with source value.
    For nested dicts, recurse.
    Returns the modified target dict.
    """
    if not isinstance(source, dict) or not isinstance(target, dict):
        return target
    
    for key in source:
        if key not in target:
            # Key missing in target - add it with source value (English fallback)
            target[key] = source[key]
        else:
            # Key exists in both - recurse if both are dicts
            if isinstance(source[key], dict) and isinstance(target[key], dict):
                target[key] = deep_merge(source[key], target[key])
            # If target[key] is not a dict but source[key] is, 
            # or vice versa, keep target as-is (don't overwrite non-dict with dict)
    
    return target

# Perform the merge
merged_data = deep_merge(en_data, pt_data)

# Count before/after
def count_keys(d, depth=0):
    """Count total keys including nested."""
    count = len(d)
    for k, v in d.items():
        if isinstance(v, dict):
            count += count_keys(v, depth+1)
    return count

en_key_count = count_keys(en_data)
pt_before = count_keys(pt_data)
pt_after = count_keys(merged_data)

# Write the merged data back to pt.json
with open(pt_path, 'w', encoding='utf-8') as f:
    json.dump(merged_data, f, ensure_ascii=False, indent=2)

pt_after_save = count_keys(merged_data)

print(f"en.json total keys: {en_key_count}")
print(f"pt.json keys before merge: {pt_before}")
print(f"pt.json keys after merge: {pt_after_save}")
print(f"New keys added: {pt_after_save - pt_before}")
print(f"\npt.json successfully updated at: {pt_path}")