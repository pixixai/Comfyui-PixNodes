import json
from typing import Any, List, Tuple

class JsonKeyValueSplit:
    """
    PixNodes JSON KV Split
    将 JSON 对象或列表解构为键（或索引）列表、值列表以及元素总数。
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                # 使用 "*" 以接受任何类型的连接（Dict, List, 或 JSON 字符串）
                "json_data": ("*", {"forceInput": True}),
            }
        }

    RETURN_TYPES = ("LIST", "LIST", "INT")
    RETURN_NAMES = ("keys", "values", "count")
    FUNCTION = "split_kv"
    CATEGORY = "PixNodes/JSON"

    # --- 关键修复：解决类型匹配报错 ---
    @classmethod
    def VALIDATE_INPUTS(cls, input_types):
        # 允许任何类型的输入连接进来，跳过 ComfyUI 的默认检查
        return True

    def split_kv(self, json_data: Any) -> Tuple[List[str], List[Any], int]:
        # 1. 预处理：尝试解析字符串为 Python 对象
        data = self._parse_input(json_data)
        
        keys = []
        values = []
        
        # 2. 根据数据类型执行拆解逻辑
        if isinstance(data, dict):
            # 处理对象（字典），Python 3.7+ 默认保持插入顺序
            keys = list(data.keys())
            values = list(data.values())
        elif isinstance(data, list):
            # 处理列表，生成对应的索引字符串
            keys = [str(i) for i in range(len(data))]
            values = data
        else:
            # 防御性处理：如果不是容器类型，视作单元素处理
            if data is not None:
                keys = ["0"]
                values = [data]
            else:
                keys = []
                values = []

        return (keys, values, len(values))

    def _parse_input(self, inp: Any) -> Any:
        """尝试将字符串解析为 JSON 对象"""
        if isinstance(inp, str):
            try:
                # 尝试解析 JSON 字符串
                return json.loads(inp)
            except:
                # 如果不是有效的 JSON 字符串，则作为普通字符串返回
                return inp
        return inp

# 节点注册映射
NODE_CLASS_MAPPINGS = {
    "Pix_JsonKeyValueSplit": JsonKeyValueSplit
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_JsonKeyValueSplit": "JSON KV Split (PixNodes)"
}