import json

class JsonListZip:
    """
    JSON列表同步合并：JSON List Zip (PixNodes)
    功能：接收多个 JSON 列表（数组），像拉链一样将它们按索引一一对应合并。
    
    特性：
    1. 动态端口：根据文本框内容生成输入端口。
    2. 自动展开：如果输入是对象列表，自动展开其属性。
    3. 广播机制：@开头的 Key 会取第一个值广播到所有行。
    4. 宽容输入：支持 STRING, list, dict 等任意类型输入。
    """
    
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "merge_keys": ("STRING", {
                    "multiline": True, 
                    "default": "key",
                    "placeholder": "输入Key名称，每行一个。\n@开头表示广播属性（取第一个值赋给所有行）。"
                }),
            },
            # 动态输入将通过 **kwargs 传递
            "optional": {} 
        }

    # [修改] 仅保留 JSON 输出，对应 Python 列表对象
    RETURN_TYPES = ("JSON",)
    # [修改] 输出名称改为 json_list
    RETURN_NAMES = ("json_list",)
    
    FUNCTION = "zip_lists"
    CATEGORY = "PixNodes/JSON"

    # --- 辅助工具 ---

    def _extract_json_body(self, text):
        """提取最外层 JSON 结构"""
        text = text.strip()
        first_bracket = text.find('[')
        if first_bracket == -1: return text
        end_idx = text.rfind(']')
        if end_idx != -1 and end_idx >= first_bracket:
            return text[first_bracket : end_idx + 1]
        return text[first_bracket:]

    def _repair_json_syntax(self, json_str):
        """基础语法修复"""
        json_str = json_str.strip()
        if "'" in json_str and '"' not in json_str:
             json_str = json_str.replace("'", '"')
        json_str = json_str.replace("None", "null").replace("True", "true").replace("False", "false")
        return json_str

    def _parse_input_to_list(self, input_val):
        """
        智能解析输入数据：
        1. 如果是 list -> 直接返回
        2. 如果是 dict -> 包装成 [dict]
        3. 如果是 str -> 尝试解析 JSON，失败则包装成 [str]
        4. 其他类型 -> 包装成 [val]
        """
        if input_val is None:
            return []

        # 1. 原生列表支持 (非字符串的 List)
        if isinstance(input_val, list):
            return input_val
        
        # 2. 原生字典支持 (单个对象)
        if isinstance(input_val, dict):
            return [input_val]

        # 3. 字符串处理 (可能是 JSON)
        if isinstance(input_val, str):
            clean_body = self._extract_json_body(input_val)
            try:
                data = json.loads(clean_body)
                if isinstance(data, list):
                    return data
                return [data]
            except (json.JSONDecodeError, TypeError):
                try:
                    # 尝试简单的语法修复
                    data = json.loads(self._repair_json_syntax(clean_body))
                    if isinstance(data, list):
                        return data
                    return [data]
                except:
                    # 解析失败，视为普通字符串值
                    return [input_val]
        
        # 4. 其他类型 (int, float, bool, tensor 等)
        # 直接包装为单元素列表
        return [input_val]

    # --- 主执行函数 ---

    def zip_lists(self, merge_keys, **kwargs):
        # 1. 解析 Keys 配置
        raw_keys = [k.strip() for k in merge_keys.split('\n') if k.strip()]
        if not raw_keys:
            # [修改] 返回单个空列表
            return ([],)

        key_configs = []
        normal_data_lengths = []
        
        # 数据缓存
        data_cache = {}

        # 2. 预处理 Keys 和 数据
        for raw_key in raw_keys:
            # 统计 @ 数量
            at_count = 0
            for char in raw_key:
                if char == '@':
                    at_count += 1
                else:
                    break
            
            is_broadcast = (at_count % 2 == 1)
            keep_at_count = (at_count - 1) // 2 if is_broadcast else at_count // 2
            
            target_key = ("@" * keep_at_count) + raw_key[at_count:]
            if not target_key: target_key = "unknown"

            # 获取数据
            raw_input = kwargs.get(raw_key, None)
            if raw_input is None:
                for k, v in kwargs.items():
                    if k.lower() == raw_key.lower():
                        raw_input = v
                        break
            
            # 解析数据
            parsed_list = self._parse_input_to_list(raw_input)
            data_cache[raw_key] = parsed_list

            if is_broadcast:
                val = parsed_list[0] if len(parsed_list) > 0 else None
                key_configs.append({
                    "type": "broadcast",
                    "target_key": target_key,
                    "value": val
                })
            else:
                normal_data_lengths.append(len(parsed_list))
                key_configs.append({
                    "type": "normal",
                    "target_key": target_key,
                    "original_key": raw_key
                })

        # 3. 计算最大行数
        if normal_data_lengths:
            max_length = max(normal_data_lengths)
        else:
            max_length = 1 if key_configs else 0

        # 4. 构建结果
        merged_result = []
        
        for i in range(max_length):
            item_obj = {}
            
            # (A) 广播属性
            for conf in key_configs:
                if conf["type"] == "broadcast":
                    val = conf["value"]
                    if val is not None:
                        if isinstance(val, dict):
                            item_obj.update(val)
                        else:
                            item_obj[conf["target_key"]] = val

            # (B) 普通列表属性
            for conf in key_configs:
                if conf["type"] == "normal":
                    source_list = data_cache[conf["original_key"]]
                    
                    if i < len(source_list):
                        val = source_list[i]
                        if isinstance(val, dict):
                            item_obj.update(val)
                        else:
                            item_obj[conf["target_key"]] = val
                    else:
                        item_obj[conf["target_key"]] = None

            merged_result.append(item_obj)

        # 5. 返回结果 
        # [修改] 不再生成 json_output 字符串，仅返回对象列表
        return (merged_result,)

NODE_CLASS_MAPPINGS = {
    "Pix_JsonListZip": JsonListZip
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_JsonListZip": "JSON List Zip (PixNodes)"
}