import json
import re

def translate_to_russian_key(key_name):
    """Try to generate a Russian translation for a key, fall back to English"""
    # Common key patterns and their Russian equivalents
    translations = {
        # Action keys
        'action': 'Действие'