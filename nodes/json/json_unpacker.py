import json

class JsonUnpacker:
    """
    JSON 解包
    一个用于解包JSON数据并将其格式化为字符串的ComfyUI节点。
    包含智能修复功能，可处理截断的JSON数据。
    支持自定义多级分隔符（通过多行文本定义）。
    支持任意类型的输入。
    """
    
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                # 修改为 "*" 以支持任意类型 (String, List, Dict, Int, Float 等)
                "json_data": ("*", {"forceInput": True}), 
                "delimiters": ("STRING", {"default": "\\n\n,", "multiline": True}),
                "keep_key": ("BOOLEAN", {"default": False}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "unpack_json"
    CATEGORY = "PixNodes/JSON"

    # === 关键修复：添加 VALIDATE_INPUTS 方法 ===
    # 这个方法用于覆盖默认的类型检查逻辑
    @classmethod
    def VALIDATE_INPUTS(cls, input_types):
        # input_types 包含了连接到该节点的所有输入的实际类型
        # 我们总是返回 True，表示“不管连进来的是什么类型，我都接受”
        return True

    def unpack_json(self, json_data, delimiters, keep_key):
        # 1. 解析分隔符配置
        raw_delims_list = delimiters.split('\n')
        processed_delims = []
        for d in raw_delims_list:
            d_proc = d.replace("\\n", "\n").replace("\\t", "\t")
            processed_delims.append(d_proc)
        
        if not processed_delims:
            processed_delims = ["\n", ","]

        def get_delim(level):
            if level < len(processed_delims):
                return processed_delims[level]
            return processed_delims[-1]

        # 2. 智能解析与数据标准化
        data = self.smart_parse(json_data)

        # 3. 递归处理函数
        def deep_flatten(obj, level):
            current_sep = get_delim(level)
            
            if isinstance(obj, list):
                return current_sep.join([deep_flatten(x, level + 1) for x in obj])
            
            elif isinstance(obj, dict):
                parts = []
                for k, v in obj.items():
                    val_str = deep_flatten(v, level + 1)
                    if keep_key:
                        parts.append(f"{k}:{val_str}")
                    else:
                        parts.append(val_str)
                return current_sep.join(parts)
            
            else:
                return str(obj)

        # 4. 开始处理
        if not isinstance(data, (list, dict)):
            final_output = str(data)
        else:
            final_output = deep_flatten(data, 0)
        
        return (final_output,)

    def smart_parse(self, raw_input):
        """
        智能解析输入数据。
        - 如果是 List/Dict，直接返回。
        - 如果是 Int/Float/Bool/None，直接返回。
        - 如果是 String，尝试 JSON 解析、修复截断或 Python 字面量解析。
        - 其他对象转字符串处理。
        """
        if isinstance(raw_input, (dict, list)):
            return raw_input
            
        if isinstance(raw_input, (int, float, bool)) or raw_input is None:
            return raw_input

        if not isinstance(raw_input, str):
            return str(raw_input)

        text = raw_input.strip()
        if not text:
            return []

        try:
            return json.loads(text)
        except:
            pass
        
        try:
            import ast
            return ast.literal_eval(text)
        except:
            pass

        start_brace = text.find('{')
        start_bracket = text.find('[')
        start_idx = -1
        
        if start_brace != -1 and start_bracket != -1:
            start_idx = min(start_brace, start_bracket)
        elif start_brace != -1:
            start_idx = start_brace
        elif start_bracket != -1:
            start_idx = start_bracket
        else:
            try:
                if ',' in text:
                    parts = [p.strip() for p in text.split(',')]
                    return parts
                return [text]
            except:
                return [text]

        candidate = text[start_idx:]
        
        stack = []
        pairs = {'{': '}', '[': ']'}
        in_string = False
        quote_char = None
        escape = False
        
        for char in candidate:
            if escape:
                escape = False
                continue
            if char == '\\':
                escape = True
                continue
            if char == '"' or char == "'":
                if not in_string:
                    in_string = True
                    quote_char = char
                elif char == quote_char:
                    in_string = False
                continue
            if in_string:
                continue
            if char == '{' or char == '[':
                stack.append(char)
            elif char == '}' or char == ']':
                if stack:
                    last = stack[-1]
                    if (last == '{' and char == '}') or (last == '[' and char == ']'):
                        stack.pop()
        
        if in_string:
            candidate += (quote_char if quote_char else '"')
            
        while stack:
            last = stack.pop()
            candidate += pairs[last]
            
        try:
            return json.loads(candidate)
        except:
            try:
                import ast
                return ast.literal_eval(candidate)
            except:
                return [text]

# 节点注册
NODE_CLASS_MAPPINGS = {
    "Pix_JsonUnpacker": JsonUnpacker
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_JsonUnpacker": "JSON Unpacker (PixNodes)"
}