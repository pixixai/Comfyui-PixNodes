import json
import sys

# --- 类型欺骗类 (Wildcard) ---
# 增强版：确保与任何类型的比较都判定为“匹配”
class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False
    def __eq__(self, __value: object) -> bool:
        return True
    def __str__(self):
        return self # 保持原始字符串值（通常是 "*"）

class JoinJsonList:
    """
    连接到 JSON 列表
    PixNodes: 将多个动态输入合并为一个 JSON 列表。
    支持智能解析输入字符串，避免二次转义导致的格式混乱。
    """
    
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                # [修复] 移除 lazy: True，防止在聚合多个输入时获取到 None 或未求值对象
                "AnyData_1": (AnyType("*"), {}), 
            },
            "optional": {},
            "hidden": {}
        }

    # [修改] 删除 STRING (JsonList_str) 输出，仅保留 JSON
    RETURN_TYPES = ("JSON",)
    # [修改] 输出名称改为 json_list
    RETURN_NAMES = ("json_list",)
    
    FUNCTION = "join_to_list"
    CATEGORY = "PixNodes/JSON"

    def join_to_list(self, **kwargs):
        # 1. 提取动态输入并排序
        dynamic_inputs = []
        for key, value in kwargs.items():
            if key.startswith("AnyData_"):
                try:
                    index = int(key.split("_")[-1])
                    dynamic_inputs.append((index, value))
                except ValueError:
                    continue
        
        dynamic_inputs.sort(key=lambda x: x[0])
        raw_list = [item[1] for item in dynamic_inputs]

        # 2. 智能处理：解析输入的 JSON 字符串
        processed_list = []
        for val in raw_list:
            # [修复] 跳过空输入，防止 None 导致输出异常
            if val is None:
                continue

            if isinstance(val, str):
                try:
                    # 尝试去除首尾空白
                    val_strip = val.strip()
                    # 只有当看起来像 JSON 对象或数组时才尝试解析
                    if (val_strip.startswith("{") and val_strip.endswith("}")) or \
                       (val_strip.startswith("[") and val_strip.endswith("]")):
                        # [修复] strict=False 允许控制字符（如换行符）在字符串中
                        json_obj = json.loads(val, strict=False)
                        processed_list.append(json_obj)
                    else:
                        processed_list.append(val)
                except Exception as e:
                    # 解析失败（可能是格式错误，如末尾逗号），回退为原始字符串
                    # 在后台打印警告，方便调试
                    print(f"[PixNodes] JSON Parse Warning: {e}. Keeping original string.")
                    processed_list.append(val)
            else:
                # 其他对象（Dict, List, Tensor 等）直接添加
                processed_list.append(val)

        # 3. 自定义序列化函数 (保留逻辑但不输出，如果未来需要调试可以随时加回来)
        def default_serializer(obj):
            if hasattr(obj, 'shape') and hasattr(obj, 'dtype'):
                return f"Tensor(shape={obj.shape}, dtype={obj.dtype})"
            try:
                # 尝试转换自定义对象
                return obj.__dict__
            except:
                return str(obj)

        # [注] 原有的 JSON 字符串生成逻辑已不再作为输出返回
        
        # [修改] 输出：仅返回 Python 列表对象，对应 JSON 端口
        return (processed_list,)

NODE_CLASS_MAPPINGS = {
    "Pix_JoinJsonList": JoinJsonList
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_JoinJsonList": "Join JSON List (PixNodes)"
}