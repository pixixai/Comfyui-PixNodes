import json
from typing import Tuple, Dict, Any, List

class CreateJsonList:
    """
    创建 JSON 列表
    
    功能：
    提供一个可视化的列表编辑界面。
    前端存储的是有序的 Entry 列表（无键名），后端将其转换为标准的 JSON List。
    """
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                # 存储编辑器状态的隐藏控件
                # 格式: [{"value": "v", "type": "string"}, ...]
                "json_data": ("STRING", {"default": "[]", "multiline": True}),
            }
        }

    # [修改] 删除 STRING (json_str) 输出，仅保留 JSON
    RETURN_TYPES = ("JSON",) 
    # [修改] 输出名称改为 json_list
    RETURN_NAMES = ("json_list",)
    
    FUNCTION = "do_process"
    CATEGORY = "PixNodes/JSON"

    def do_process(self, json_data: str) -> Tuple[List[Any]]:
        # 1. 解析前端存储的编辑器状态
        try:
            entries = json.loads(json_data)
        except Exception as e:
            print(f"⚠️ [CreateJsonList] JSON Parse Error: {e}")
            entries = []
            
        # 2. 转换为 Python 列表 (List)
        output_list = []
        
        if isinstance(entries, list):
            for entry in entries:
                # 列表模式下，我们只需要 value
                # 兼容性处理：如果是旧格式或字典，取value；否则直接使用
                if isinstance(entry, dict):
                    v = entry.get("value", None)
                    output_list.append(v)
                else:
                    # 极端情况下的容错
                    output_list.append(entry)
        else:
            print("⚠️ [CreateJsonList] Data format warning, expected list of entries.")
            output_list = []

        # 3. 生成格式化字符串
        # [注] 虽然不再输出字符串端口，保留此变量生成逻辑也不会报错，若不需要可忽略
        # indent=2: 保持良好的缩进格式
        json_str_out = json.dumps(output_list, indent=2, ensure_ascii=False)
        
        # [修改] 返回值: (Python列表对象,)，仅对应 JSON 端口
        return (output_list,)

NODE_CLASS_MAPPINGS = {
    "Pix_CreateJsonList": CreateJsonList
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_CreateJsonList": "Create JSON List (PixNodes)"
}