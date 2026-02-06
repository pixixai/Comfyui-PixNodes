import json

# --- 类型欺骗类 (Wildcard) ---
# 复用自 json_list_join.py，确保能连接任意类型
class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False
    def __eq__(self, __value: object) -> bool:
        return True
    def __str__(self):
        return self

# [修改] 类名称 JsonObjectJoin -> JoinJsonObject
class JoinJsonObject:
    """
    连接到 JSON 对象
    PixNodes: 将多个动态输入合并为一个 JSON 对象 (Dictionary)。
    - 如果输入是 Dict/JSON 对象，将其属性合并到结果中。
    - 如果输入是其他值，以输入端口名作为 Key 存入结果。
    """
    
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                # 使用 AnyType("*") 允许连接任意类型的输出
                "AnyData_1": (AnyType("*"), {}), 
            },
            "optional": {},
            "hidden": {}
        }

    # [修改] 删除 STRING (JsonObject_str) 输出，仅保留 JSON
    RETURN_TYPES = ("JSON",)
    # [修改] 输出名称改为 json_object
    RETURN_NAMES = ("json_object",)
    
    FUNCTION = "join_to_object"
    CATEGORY = "PixNodes/JSON"

    def join_to_object(self, **kwargs):
        # 1. 提取动态输入并排序
        # 我们需要同时保留 索引(用于排序) 和 原始键名(用于作为非Dict数据的Key)
        dynamic_inputs = []
        for key, value in kwargs.items():
            if key.startswith("AnyData_"):
                try:
                    index = int(key.split("_")[-1])
                    dynamic_inputs.append((index, key, value))
                except ValueError:
                    continue
        
        # 按索引排序，确保合并顺序（后面的输入会覆盖前面的同名Key）
        dynamic_inputs.sort(key=lambda x: x[0])

        merged_dict = {}

        # 2. 遍历并处理数据
        for idx, key_name, val in dynamic_inputs:
            # 跳过空输入
            if val is None:
                continue

            processed_val = val

            # 智能解析：如果是字符串，尝试解析为 JSON
            if isinstance(val, str):
                try:
                    val_strip = val.strip()
                    if (val_strip.startswith("{") and val_strip.endswith("}")) or \
                       (val_strip.startswith("[") and val_strip.endswith("]")):
                        processed_val = json.loads(val, strict=False)
                except Exception as e:
                    # 解析失败则保持原样字符串
                    print(f"[PixNodes] JSON Object Parse Warning for {key_name}: {e}")
                    pass

            # 3. 合并逻辑
            if isinstance(processed_val, dict):
                # 如果是字典，使用 update 合并（扁平化合并）
                merged_dict.update(processed_val)
            else:
                # 如果不是字典（如列表、字符串、数字、Tensor），将其作为 Value，端口名作为 Key
                merged_dict[key_name] = processed_val

        # 4. 自定义序列化函数 (保留但不输出)
        def default_serializer(obj):
            if hasattr(obj, 'shape') and hasattr(obj, 'dtype'):
                return f"Tensor(shape={obj.shape}, dtype={obj.dtype})"
            try:
                return obj.__dict__
            except:
                return str(obj)

        # [注] 不再生成并返回 JSON 字符串
        # try:
        #     json_str = json.dumps(merged_dict, ensure_ascii=False, indent=2, default=default_serializer)
        # except Exception as e:
        #     json_str = json.dumps({"error": f"Serialization failed: {str(e)}"})

        # [修改] 仅返回 merged_dict 对象，对应 JSON 端口
        return (merged_dict,)

# 节点映射
NODE_CLASS_MAPPINGS = {
    # [修改] 注册名称 Pix_JsonObjectJoin -> Pix_JoinJsonObject
    "Pix_JoinJsonObject": JoinJsonObject
}

NODE_DISPLAY_NAME_MAPPINGS = {
    # [修改] 显示名称 JSON Object Join -> Join JSON Object
    "Pix_JoinJsonObject": "Join JSON Object (PixNodes)"
}