import json
import re

# 定义任意类型常量，方便在 ComfyUI 中表示万能插槽
ANY_TYPE = "*"

class JsonListPluck:
    """
    JSON List Pluck (PixNodes) - V2.2 Multi-Type Enhanced
    功能：从 JSON 数组或 Python 列表对象中提取（摘取）特定字段。
    增强功能：
    1. 任意输入支持：既支持 LLM 输出的 JSON 字符串，也支持其他节点生成的原生 List/Dict 对象。
    2. 深度模糊匹配：支持单复数、词干匹配 (shot_prompt == shots_prompts)。
    3. 智能提取与容错：自动过滤废话，修复截断的 JSON 文本。
    4. 校验绕过：通过 VALIDATE_INPUTS 支持万能输入连接。
    """
    
    MAX_OUTPUTS = 100 

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                # 更改为 ANY_TYPE (*)，使其可以接收任何类型的输入
                "json_list_input": (ANY_TYPE, {"forceInput": True}),
                "filter_keys": ("STRING", {
                    "multiline": True, 
                    "default": "list", 
                    "placeholder": "在此输入Key，每行一个。\n支持模糊匹配: keys, list_keys..."
                }),
                "merge_output": ("BOOLEAN", {
                    "default": False, 
                    "label_on": "Merge to Single Port", 
                    "label_off": "Separate Ports"
                }),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            }
        }

    @classmethod
    def VALIDATE_INPUTS(cls, input_types):
        """
        核心修复逻辑：
        当定义了接收 input_types 参数的 VALIDATE_INPUTS 时，
        ComfyUI 会跳过默认的类型匹配检查，从而允许 STRING/IMAGE 等类型连接到 ANY_TYPE (*) 端口。
        """
        return True

    RETURN_TYPES = ("STRING",) * MAX_OUTPUTS
    RETURN_NAMES = tuple(f"plucked_list_{i}" for i in range(1, MAX_OUTPUTS + 1))
    OUTPUT_IS_LIST = (False,) * MAX_OUTPUTS
    
    FUNCTION = "pluck_list"
    CATEGORY = "PixNodes/JSON"

    # --- 辅助工具 (字符串处理) ---

    def _extract_json_body(self, text):
        """针对字符串输入的 JSON 提取逻辑"""
        text = text.strip()
        first_bracket = text.find('[')
        first_brace = text.find('{')
        
        start_idx = -1
        is_array = True
        
        if first_bracket != -1 and (first_brace == -1 or first_bracket < first_brace):
            start_idx = first_bracket
            is_array = True
        elif first_brace != -1:
            start_idx = first_brace
            is_array = False
        else:
            return text 

        if is_array:
            end_idx = text.rfind(']')
        else:
            end_idx = text.rfind('}')
            
        if end_idx != -1 and end_idx >= start_idx:
            return text[start_idx : end_idx + 1]
        
        return text[start_idx:]

    def _repair_json_syntax(self, json_str):
        """针对字符串输入的语法修复"""
        json_str = json_str.strip()
        if "'" in json_str and '"' not in json_str:
             json_str = json_str.replace("'", '"')
        json_str = json_str.replace("None", "null").replace("True", "true").replace("False", "false")
        
        json_str = re.sub(r'\}\s*\{', '}, {', json_str)
        json_str = re.sub(r'\]\s*\[', '], [', json_str)
        json_str = re.sub(r',\s*([\]}])', r'\1', json_str)
        
        if json_str.count('"') % 2 != 0: 
            json_str += '"'
            
        open_braces = json_str.count('{') - json_str.count('}')
        open_brackets = json_str.count('[') - json_str.count(']')
        
        if open_braces > 0: json_str += '}' * open_braces
        if open_brackets > 0: json_str += ']' * open_brackets
        
        return json_str

    # --- 辅助工具 (匹配逻辑) ---

    def _normalize_key(self, key):
        return re.sub(r'[\s_\-]', '', str(key)).lower()

    def _get_stemmed_key(self, key):
        parts = re.split(r'[\s_\-]+', str(key).lower())
        stemmed_parts = [p.rstrip('s') for p in parts if p]
        return "".join(stemmed_parts)

    def _fuzzy_match_value(self, data_dict, target_key):
        if not isinstance(data_dict, dict): 
            return False, None
        
        if target_key in data_dict: 
            return True, data_dict[target_key]
        
        norm_target = self._normalize_key(target_key)
        for k, v in data_dict.items():
            if self._normalize_key(k) == norm_target:
                return True, v

        stem_target = self._get_stemmed_key(target_key)
        for k, v in data_dict.items():
            if self._get_stemmed_key(k) == stem_target:
                return True, v

        base = target_key.replace('_json', '').replace(' ', '_').lower()
        variations = [
            f"{base}_json", f"{base}_list", f"list_{base}", 
            f"{base}s", base, f"key_{base}",
            target_key.rstrip('s'), f"{target_key}s"
        ]
        
        data_keys = list(data_dict.keys())
        for v in variations:
            for k in data_keys:
                if k.lower() == v.lower(): 
                    return True, data_dict[k]

        return False, None

    # --- 主执行函数 ---

    def pluck_list(self, json_list_input, filter_keys, merge_output, **kwargs):
        keys = [k.strip() for k in filter_keys.split('\n') if k.strip()]
        if not keys: keys = ["plucked_list_1"]

        valid_outputs = []
        
        # --- 智能数据解析逻辑 ---
        input_data = None
        parse_success = False

        # 情况 1: 输入已经是 Python 列表或字典
        if isinstance(json_list_input, (list, dict)):
            input_data = json_list_input
            parse_success = True
        
        # 情况 2: 输入是字符串（可能需要解析 JSON）
        elif isinstance(json_list_input, str):
            clean_body = self._extract_json_body(json_list_input)
            try:
                input_data = json.loads(clean_body)
                parse_success = True
            except json.JSONDecodeError:
                try:
                    repaired_body = self._repair_json_syntax(clean_body)
                    input_data = json.loads(repaired_body)
                    parse_success = True
                except Exception as e:
                    print(f"[PixJsonListPluck] String parsing failed: {str(e)}")
                    input_data = []
        
        # 情况 3: 意外类型
        else:
            print(f"[PixJsonListPluck] Unsupported input type: {type(json_list_input)}")
            input_data = []

        # 归一化为对象列表
        if parse_success:
            if isinstance(input_data, dict):
                input_data = [input_data]
            elif not isinstance(input_data, list):
                input_data = []
        else:
            input_data = []

        # --- 提取逻辑 ---
        if merge_output:
            # 合并模式
            result_list = []
            for item in input_data:
                new_obj = {}
                for key_name in keys:
                    found, val = self._fuzzy_match_value(item, key_name)
                    new_obj[key_name] = val if found else ""
                result_list.append(new_obj)
            
            wrapped = json.dumps(result_list, ensure_ascii=False, indent=2)
            valid_outputs.append(wrapped)
            
        else:
            # 分离模式
            for key_name in keys:
                result_list = []
                for item in input_data:
                    found, val = self._fuzzy_match_value(item, key_name)
                    result_list.append(val if found else "")
                
                wrapped = json.dumps(result_list, ensure_ascii=False, indent=2)
                valid_outputs.append(wrapped)

        # 补齐输出端口
        if len(valid_outputs) < self.MAX_OUTPUTS:
            valid_outputs.extend(["[]"] * (self.MAX_OUTPUTS - len(valid_outputs)))

        return tuple(valid_outputs)

NODE_CLASS_MAPPINGS = {
    "Pix_JsonListPluck": JsonListPluck
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_JsonListPluck": "JSON List Pluck (PixNodes)"
}