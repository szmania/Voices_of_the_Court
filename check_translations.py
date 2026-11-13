import io
import sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import json

en_path = 'default_userdata/configs/prompts/en.json'
tr_path = 'default_userdata/configs/prompts/tr.json'
zh_path = 'default_userdata/configs/prompts/zh.json'

en_data = json.load(open(en_path, 'r', encoding='utf-8'))
tr_data = json.load(open(tr_path, 'r', encoding='utf-8'))
zh_data = json.load(open(zh_path, 'r', encoding='utf-8'))

en_prompts = en_data.get('prompts', {})
tr_prompts = tr_data.get('prompts', {})
zh_prompts = zh_data.get('prompts', {})

same_tr = sum(1 for k, v in en_prompts.items() if k in tr_prompts and tr_prompts[k] == v)
same_zh = sum(1 for k, v in en_prompts.items() if k in zh_prompts and zh_prompts[k] == v)

print('TR values same as EN:', same_tr, 'out of', len(en_prompts))
print('ZH values same as EN:', same_zh, 'out of', len(en_prompts))

print()
print('Sample key: chroniclePrompt')
en_val = en_prompts.get('chroniclePrompt', '')[:100]
tr_val = tr_prompts.get('chroniclePrompt', '')[:100]
zh_val = zh_prompts.get('chroniclePrompt', '')[:100]
print('EN:', en_val)
print('TR:', tr_val)
print('ZH:', zh_val)