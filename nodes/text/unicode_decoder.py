import json
import re

class UniversalUnicodeDecoder:
    """
    Universal Unicode Decoder (PixNodes)
    递归解码 Unicode 转义序列，并通过 JSON 序列化保留列表和对象的格式（如括号）。
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                # 使用 "*" 作为类型提示，并在 VALIDATE_INPUTS 中放行
                "input_data": ("*", {"forceInput": True, "tooltip": "输入数据 (String, List, Dict, 或嵌套对象)."}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "process"
    CATEGORY = "PixNodes/text"

    # --- 关键修复 ---
    @classmethod
    def VALIDATE_INPUTS(cls, input_types):
        # 引入 input_types 参数会告诉 ComfyUI 跳过默认的类型检查机制。
        # 我们直接返回 True，表示允许任何类型的输入连接进来。
        return True
    # ----------------

    def process(self, input_data):
        # 防御性编程：处理 None
        if input_data is None:
            return ("",)
            
        # 1. 递归解码
        decoded_result = self._recursive_decode(input_data)
        
        # 2. 转换为字符串并保留结构
        # 对 list/dict/tuple 使用 json.dumps 以保留 [] 和 {}
        if isinstance(decoded_result, (list, dict, tuple)):
            try:
                # ensure_ascii=False 确保中文等字符正常显示而不是转义
                final_text = json.dumps(decoded_result, indent=2, ensure_ascii=False)
            except:
                # 如果包含无法被 JSON 序列化的对象（如 Tensor），回退到 str()
                final_text = str(decoded_result)
        else:
            final_text = str(decoded_result)
        
        # 3. 处理控制字符和格式
        # 恢复被转义的换行符和制表符，使文本在前端显示更易读
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
        """递归处理嵌套结构"""
        if isinstance(data, str):
            return self._decode_unicode(data)
        elif isinstance(data, list):
            return [self._recursive_decode(item) for item in data]
        elif isinstance(data, dict):
            return {k: self._recursive_decode(v) for k, v in data.items()}
        elif isinstance(data, tuple):
            return tuple(self._recursive_decode(item) for item in data)
        else:
            # 对于数字、None、Tensor 等其他类型，原样返回
            return data

    def _decode_unicode(self, text):
        """尝试多种方式解码 unicode 转义字符"""
        if not isinstance(text, str):
            return text
            
        if "\\u" not in text and "%u" not in text:
            return text

        try:
            # 尝试标准的 unicode_escape
            decoded = text.encode('utf-8').decode('unicode_escape')
            # 修复双重编码情况 (如 \\uXXXX 变成了文本字面量)
            if "\\u" in decoded:
                decoded = decoded.encode('latin1').decode('unicode_escape')
            return decoded
        except:
            try:
                # 备用方案：latin1 编码
                return text.encode('latin1').decode('unicode_escape')
            except:
                # 正则暴力替换方案
                def replace_match(match):
                    try:
                        return chr(int(match.group(1), 16))
                    except:
                        return match.group(0)
                return re.sub(r'\\u([0-9a-fA-F]{4})', replace_match, text)

# 注意：由于使用了你提供的动态加载 __init__.py，
# 这里的 MAPPINGS 需要确保能被该加载器识别。
NODE_CLASS_MAPPINGS = {
    "Pix_UniversalUnicodeDecoder": UniversalUnicodeDecoder
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_UniversalUnicodeDecoder": "Universal Unicode Decoder (PixNodes)"
}