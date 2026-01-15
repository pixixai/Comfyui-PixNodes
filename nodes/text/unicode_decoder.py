import json
import re

class UniversalUnicodeDecoder:
    """
    Universal Unicode Decoder (PixNodes)
    Recursively decodes Unicode escape sequences and keeps formatting (brackets/braces)
    for lists and objects by using JSON stringification.
    """
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "input_data": ("*", {"forceInput": True, "tooltip": "Input data (String, List, Dict, or nested objects)."}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "process"
    CATEGORY = "PixNodes/text"

    def process(self, input_data):
        if input_data is None:
            return ("",)
            
        # 1. Recursive decoding
        decoded_result = self._recursive_decode(input_data)
        
        # 2. Convert result to string while preserving structure
        # Use JSON dumps for list/dict/tuple to keep [] and {}
        if isinstance(decoded_result, (list, dict, tuple)):
            try:
                final_text = json.dumps(decoded_result, indent=2, ensure_ascii=False)
            except:
                final_text = str(decoded_result)
        else:
            final_text = str(decoded_result)
        
        # 3. Handle control characters and formatting
        # We replace escaped backslashes specifically to restore newlines and tabs
        replacements = {
            "\\n": "\n",
            "\\t": "\t",
            "\\r": "\r",
            "\\\"": "\"",
            "\\'": "'",
        }
        
        for old, new in replacements.items():
            final_text = final_text.replace(old, new)
        
        return (final_text,)

    def _recursive_decode(self, data):
        if isinstance(data, str):
            return self._decode_unicode(data)
        elif isinstance(data, list):
            return [self._recursive_decode(item) for item in data]
        elif isinstance(data, dict):
            return {k: self._recursive_decode(v) for k, v in data.items()}
        elif isinstance(data, tuple):
            return tuple(self._recursive_decode(item) for item in data)
        else:
            return data

    def _decode_unicode(self, text):
        if not isinstance(text, str):
            return text
            
        if "\\u" not in text and "%u" not in text:
            return text

        try:
            decoded = text.encode('utf-8').decode('unicode_escape')
            if "\\u" in decoded:
                decoded = decoded.encode('latin1').decode('unicode_escape')
            return decoded
        except:
            try:
                return text.encode('latin1').decode('unicode_escape')
            except:
                def replace_match(match):
                    try:
                        return chr(int(match.group(1), 16))
                    except:
                        return match.group(0)
                return re.sub(r'\\u([0-9a-fA-F]{4})', replace_match, text)

NODE_CLASS_MAPPINGS = {
    "Pix_UniversalUnicodeDecoder": UniversalUnicodeDecoder
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_UniversalUnicodeDecoder": "Universal Unicode Decoder (PixNodes)"
}