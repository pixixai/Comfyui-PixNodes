import json
import re

# --- 核心修复：定义万能类型 ---
class AnyType(str):
    """
    JSON 对象提取
    一个特殊的字符串类，与任何对象比较时都返回 True。
    用于绕过 ComfyUI 后端的严格类型检查。
    """
    def __ne__(self, __value: object) -> bool:
        return False

    def __eq__(self, __value: object) -> bool:
        return True

    def __str__(self):
        return self

# 实例化一个万能类型对象，用于 INPUT_TYPES
ANY = AnyType("*")
# ---------------------------

class JsonObjectExtract:
    """
    JSON Object Extract (PixNodes) - V2.7.1 Universal Input Fix
    增强功能：
    1. 归一化模糊匹配。
    2. 正则回退机制。
    3. 合并输出模式：输出纯净的大对象。
    4. 分离输出模式：原生输出。
    5. 深度词干匹配：解决单词中间复数问题。
    6. [修复] 任意类型输入支持：使用 AnyType 解决后端类型验证报错问题。
    """
    
    # 定义最大支持端口数
    MAX_OUTPUTS = 100 

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                # [修改] 更改端口名称为 json_object
                # 修改为 ANY 对象，它在与上游的 "JSON", "STRING" 等类型比较时永远返回 True
                "json_object": (ANY, {"forceInput": True}),
                "match_keys": ("STRING", {
                    "multiline": True, 
                    "default": "object_1", 
                    "placeholder": "在此输入Key，每行一个。\n支持模糊匹配: keys, list_keys..."
                }),
                "merge_output": ("BOOLEAN", {
                    "default": False, 
                    "label_on": "Merge All Keys to Single Port", 
                    "label_off": "Separate Ports per Key"
                }),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            }
        }

    # [修改] 输出类型改为 JSON
    RETURN_TYPES = ("JSON",) * MAX_OUTPUTS
    RETURN_NAMES = tuple(f"object_{i}" for i in range(1, MAX_OUTPUTS + 1))
    OUTPUT_IS_LIST = (False,) * MAX_OUTPUTS
    
    FUNCTION = "extract"
    CATEGORY = "PixNodes/JSON"

    # --- 核心处理逻辑 ---

    def _extract_json_body(self, text):
        """增强的 JSON 提取"""
        text = text.strip()
        first_brace = text.find('{')
        first_bracket = text.find('[')
        
        start_idx = -1
        is_object = False
        
        if first_brace != -1 and first_bracket != -1:
            if first_brace < first_bracket:
                start_idx = first_brace
                is_object = True
            else:
                start_idx = first_bracket
                is_object = False
        elif first_brace != -1:
            start_idx = first_brace
            is_object = True
        elif first_bracket != -1:
            start_idx = first_bracket
            is_object = False
            
        if start_idx == -1: return text 
            
        end_idx = -1
        if is_object: end_idx = text.rfind('}')
        else: end_idx = text.rfind(']')
            
        if end_idx != -1 and end_idx >= start_idx:
            return text[start_idx : end_idx + 1]
        return text[start_idx:]

    def _repair_json_syntax(self, json_str):
        """语法级修复"""
        json_str = json_str.strip()
        if "'" in json_str and '"' not in json_str:
             json_str = json_str.replace("'", '"')
             json_str = json_str.replace("None", "null").replace("True", "true").replace("False", "false")
        json_str = re.sub(r'\}\s*\{', '}, {', json_str)
        json_str = re.sub(r'\]\s*\[', '], [', json_str)
        json_str = re.sub(r',\s*([\]}])', r'\1', json_str)
        if json_str.count('"') % 2 != 0: json_str += '"'
        open_braces = json_str.count('{') - json_str.count('}')
        open_brackets = json_str.count('[') - json_str.count(']')
        if open_braces > 0: json_str += '}' * open_braces
        if open_brackets > 0: json_str += ']' * open_brackets
        return json_str

    def _normalize_key(self, key):
        """基础归一化 Key：去符号转小写"""
        return re.sub(r'[\s_\-]', '', str(key)).lower()

    def _get_stemmed_key(self, key):
        """深度词干归一化"""
        parts = re.split(r'[\s_\-]+', str(key).lower())
        stemmed_parts = [p.rstrip('s') for p in parts if p]
        return "".join(stemmed_parts)

    def _fuzzy_match_key(self, data_dict, target_key):
        """增强版模糊匹配逻辑"""
        if not isinstance(data_dict, dict): return None
        
        # 1. 精确匹配
        if target_key in data_dict: return data_dict[target_key]
        
        # 2. 基础归一化匹配
        norm_target = self._normalize_key(target_key)
        for k, v in data_dict.items():
            if self._normalize_key(k) == norm_target:
                return v

        # 3. 深度词干匹配
        stem_target = self._get_stemmed_key(target_key)
        for k, v in data_dict.items():
            if self._get_stemmed_key(k) == stem_target:
                return v

        # 4. 传统变体匹配
        base = target_key.replace('_json', '').replace(' ', '_').lower()
        variations = [
            f"{base}_json", f"{base}_list", f"list_{base}", 
            f"{base}s", base, f"key_{base}",
            target_key.rstrip('s'), f"{target_key}s"
        ]
        
        data_keys = list(data_dict.keys())
        for v in variations:
            for k in data_keys:
                if k.lower() == v.lower(): return data_dict[k]
        return None

    def _deep_search(self, data, target_key):
        if not target_key: return None
        if isinstance(data, dict): return self._fuzzy_match_key(data, target_key)
        if isinstance(data, list):
            collected = []
            found_any = False
            for item in data:
                val = None
                if isinstance(item, dict): val = self._fuzzy_match_key(item, target_key)
                if val is not None:
                    found_any = True
                    collected.append(val)
            if found_any: return collected
            return None
        return None
    
    def _regex_fallback(self, text, target_key):
        """正则暴力回退 (仅对字符串有效)"""
        keys_to_try = [target_key, target_key.lower(), target_key.replace(" ", "_")]
        
        for k in keys_to_try:
            pattern = r'"' + re.escape(k) + r'"\s*:\s*(?:"([^"\\]*(?:\\.[^"\\]*)*)"|([^\s,"\}]+))'
            match = re.search(pattern, text, re.IGNORECASE)
            
            if match:
                if match.group(1) is not None:
                    return match.group(1)
                elif match.group(2) is not None:
                    val = match.group(2)
                    if val.lower() == 'true': return True
                    if val.lower() == 'false': return False
                    if val.lower() == 'null': return None
                    try: return float(val)
                    except: return val
        return None

    # [修改] 参数名 json_input -> json_object
    def extract(self, json_object, match_keys, merge_output, **kwargs):
        keys = [k.strip() for k in match_keys.split('\n') if k.strip()]
        if not keys: keys = ["object_1"]

        valid_outputs = []
        
        data = None
        parse_success = False
        
        # --- 1. 数据解析：支持对象或字符串 ---
        # [修改] 使用新的参数名 json_object
        if isinstance(json_object, (dict, list)):
            # 如果已经是结构化数据（来自其他节点输出的列表或字典）
            data = json_object
            parse_success = True
        else:
            # 尝试作为字符串解析
            text_input = str(json_object)
            clean_body = self._extract_json_body(text_input)
            
            try:
                data = json.loads(clean_body)
                parse_success = True
            except json.JSONDecodeError:
                try:
                    repaired_body = self._repair_json_syntax(clean_body)
                    data = json.loads(repaired_body)
                    parse_success = True
                except Exception as e:
                    print(f"[PixJsonObjectExtract] JSON Parse Failed: {str(e)}. Attempting regex fallback.")
                    data = {}

        # --- 2. 提取逻辑 ---
        if merge_output:
            # --- 合并模式 ---
            merged_obj = {}
            for key_name in keys:
                raw_val = None
                if parse_success:
                    raw_val = self._deep_search(data, key_name)
                
                # 正则回退
                if raw_val is None and isinstance(json_object, str):
                    raw_val = self._regex_fallback(json_object, key_name)
                
                merged_obj[key_name] = raw_val
            
            # [修改] 直接返回对象
            valid_outputs.append(merged_obj)
            
        else:
            # --- 分离模式 ---
            for key_name in keys:
                raw_val = None
                if parse_success:
                    raw_val = self._deep_search(data, key_name)
                
                if raw_val is None and isinstance(json_object, str):
                    raw_val = self._regex_fallback(json_object, key_name)
                
                final_output = None
                
                if isinstance(raw_val, dict):
                    final_output = raw_val
                elif isinstance(raw_val, list):
                    final_output = raw_val
                elif raw_val is None:
                    # [保留] 此处保持提取失败返回空列表的逻辑，或根据需要改为 None
                    final_output = []
                else:
                    final_output = raw_val # [修改] 不再强制包装成列表，保持原始值
                
                # [修改] 直接返回对象
                valid_outputs.append(final_output)

        # 补齐端口
        current_len = len(valid_outputs)
        if current_len < self.MAX_OUTPUTS:
            # [修改] 填充 None 代替字符串 "[]"
            valid_outputs += [None] * (self.MAX_OUTPUTS - current_len)

        return tuple(valid_outputs)

NODE_CLASS_MAPPINGS = {
    "Pix_JsonObjectExtract": JsonObjectExtract
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_JsonObjectExtract": "JSON Object Extract (PixNodes)"
}