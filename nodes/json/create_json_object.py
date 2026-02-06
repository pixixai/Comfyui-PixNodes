import json
from typing import Tuple, Dict, Any, List

class CreateJsonObject:
    """
    创建 JSON 对象
    
    功能：
    提供一个 Notion 风格的 Key-Value 编辑界面。
    前端存储的是有序的 Entry 列表，后端将其转换为标准的 JSON Object (Dict)。
    """
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                # 存储编辑器状态的隐藏控件
                # 格式: [{"key": "k", "value": "v", "type": "string"}, ...]
                "json_data": ("STRING", {"default": "[]", "multiline": True}),
            }
        }

    # [修改] 删除 STRING (json_str) 输出，仅保留 JSON
    RETURN_TYPES = ("JSON",) 
    # [修改] 输出名称改为 json_object
    RETURN_NAMES = ("json_object",)
    
    FUNCTION = "do_process"
    CATEGORY = "PixNodes/JSON"

    def do_process(self, json_data: str) -> Tuple[Dict[str, Any]]:
        # 1. 解析前端存储的编辑器状态 (List of Entries)
        try:
            entries = json.loads(json_data)
        except Exception as e:
            print(f"⚠️ [CreateJsonObject] JSON Parse Error: {e}")
            entries = []
            
        # 2. 转换为字典 (JSON Object)
        output_dict = {}
        
        if isinstance(entries, list):
            for entry in entries:
                # 兼容性处理，确保只有包含 key/value 的项才被处理
                if isinstance(entry, dict) and "key" in entry:
                    k = str(entry["key"]) # Key 必须是字符串
                    v = entry.get("value", None)
                    output_dict[k] = v
        else:
            print("⚠️ [CreateJsonObject] Data format warning, expected list of entries.")
            output_dict = {}

        # 3. 生成格式化字符串
        # ensure_ascii=False: 关键参数，防止中文被转义为 \uXXXX
        # indent=2: 保持良好的缩进格式
        # [注] 虽然不再输出字符串端口，保留此变量生成逻辑也不会报错，若不需要可忽略
        json_str_out = json.dumps(output_dict, indent=2, ensure_ascii=False)
        
        # [修改] 返回值顺序必须与 RETURN_TYPES 一致：仅返回 (json,)
        return (output_dict,)

NODE_CLASS_MAPPINGS = {
    "Pix_CreateJsonObject": CreateJsonObject
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_CreateJsonObject": "Create JSON Object (PixNodes)"
}