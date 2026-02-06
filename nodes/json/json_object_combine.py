import json
import torch

# --- 1. 定义任意类型类 ---
class AnyType(str):
    """
    合并为 JSON 对象
    一个特殊的类，用于欺骗 ComfyUI 的类型检查系统。
    它与任何类型比较都返回 True (相等)。
    """
    def __ne__(self, __value: object) -> bool:
        return False

    def __eq__(self, __value: object) -> bool:
        return True

    def __str__(self):
        return "*"

    def __repr__(self):
        return "*"

# 实例化一个全局的 AnyType 对象
ANY = AnyType("*")

# --- 2. 节点定义 ---
class JsonObjectCombine:
    """
    JSON Object Combine (PixNodes)
    功能：
    1. 动态接收输入。
    2. 智能合并：如果输入是字典/JSON对象，自动打散合并到根节点（忽略Key名）。
    3. 普通赋值：如果输入是普通值，使用Key名作为字段名。
    4. 空值处理：可通过 skip_unconnected 参数控制未连接端口的行为。
    """
    
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "merge_keys": ("STRING", {
                    "multiline": True, 
                    "default": "param1\nparam2",
                    "placeholder": "输入端口名称，每行一个。\n- 如果输入是对象：自动解构合并，端口名仅作占位符。\n- 如果输入是数值/字符：端口名将作为Key。"
                }),
                "skip_unconnected": ("BOOLEAN", {
                    "default": True, 
                    "label_on": "跳过未连接 (Skip)", 
                    "label_off": "保留为空 (Keep Empty)"
                }),
            },
            "optional": {} 
        }

    # 仅保留 JSON 输出
    RETURN_TYPES = ("JSON",)
    # 输出名称改为 json_object
    RETURN_NAMES = ("json_object",)
    
    FUNCTION = "combine_to_json"
    CATEGORY = "PixNodes/JSON"

    # --- 辅助：安全序列化 ---
    def _safe_serialize(self, obj):
        if isinstance(obj, torch.Tensor):
            return f"<Tensor shape={obj.shape} dtype={obj.dtype}>"
        if isinstance(obj, set):
            return list(obj)
        try:
            json.dumps(obj)
            return obj
        except (TypeError, OverflowError):
            return str(obj)

    # --- 辅助：尝试解析为字典 ---
    def _try_parse_dict(self, value):
        # 1. 如果本身就是 dict
        if isinstance(value, dict):
            return value
        
        # 2. 如果是 JSON 字符串，尝试解析
        if isinstance(value, str):
            value = value.strip()
            # 简单的快速检查，避免对所有字符串都做 json.loads
            if value.startswith("{") and value.endswith("}"):
                try:
                    # 容错处理：替换单引号
                    if "'" in value and '"' not in value:
                        value = value.replace("'", '"')
                    parsed = json.loads(value)
                    if isinstance(parsed, dict):
                        return parsed
                except:
                    pass
        return None

    # --- 主执行函数 ---
    def combine_to_json(self, merge_keys, skip_unconnected, **kwargs):
        # 1. 解析 Keys
        keys = [k.strip() for k in merge_keys.split('\n') if k.strip()]
        
        result_dict = {}
        
        # 2. 遍历 Key 并从 kwargs 中获取对应的值
        for key in keys:
            value = None
            
            # 尝试获取输入值
            if key in kwargs:
                value = kwargs[key]
            else:
                # 容错：不区分大小写查找
                for k_in, v_in in kwargs.items():
                    if k_in.lower() == key.lower():
                        value = v_in
                        break
            
            # 3. 核心逻辑分支
            if value is not None:
                # 【分支 1】：端口已连接且有值
                
                # 尝试解析是否为字典（用于 Spread/解构操作）
                dict_value = self._try_parse_dict(value)
                
                if dict_value is not None:
                    # 如果输入是字典（或 JSON 对象字符串），则打散合并，忽略当前的 key 名称
                    result_dict.update(dict_value)
                else:
                    # 如果输入是普通值，使用 key 名称作为键
                    result_dict[key] = value
            else:
                # 【分支 2】：端口未连接（或值为 None）
                if not skip_unconnected:
                    # 如果[关闭]了跳过 -> 赋值为空字符串
                    result_dict[key] = ""
                # 否则 -> 默认跳过，不做任何操作

        # 4. 返回结果
        return (result_dict,)

# 导出节点映射
NODE_CLASS_MAPPINGS = {
    "Pix_JsonObjectCombine": JsonObjectCombine
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_JsonObjectCombine": "JSON Object Combine (PixNodes)"
}