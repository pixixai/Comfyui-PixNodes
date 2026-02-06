import json as json_module

# 1. 定义一个万能类型，用于欺骗 ComfyUI 的后端类型检查
class AnyType(str):
    """一个特殊的字符串类，与任何对象比较都返回 True"""
    def __ne__(self, __value: object) -> bool:
        return False
    def __eq__(self, __value: object) -> bool:
        return True
    def __str__(self):
        return "*"

class JSONSlicer:
    """
    JSON 切片工具
    功能：
    1. Chunk (分块) 模式：将数据按 length 分组，取第 index 组。
    2. Range (范围) 模式：从 index 开始，取 length 个数据。
    """
    
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                # [保持] 使用 json_data
                "json_data": (AnyType("*"), {"tooltip": "输入数据：支持 JSON 字符串、Python 列表或字典"}),
                "mode": (["chunk", "range"], {"default": "chunk"}),
                "length": ("INT", {"default": 1, "min": 1, "max": 0xffffffffffffffff, "step": 1, "tooltip": "Chunk模式下为分块大小，Range模式下为切片长度"}),
                "index": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff, "step": 1, "tooltip": "Chunk模式下为块索引，Range模式下为起始位置"}),
            }
        }

    # [修改] 删除 STRING (json_data_str) 输出
    RETURN_TYPES = (AnyType("*"), "INT", "INT")
    # [修改] 输出端口名称更改，移除了 json_data_str
    RETURN_NAMES = ("json_data", "count", "index")
    FUNCTION = "slice_json"
    CATEGORY = "PixNodes/JSON"

    def slice_json(self, json_data, mode, length, index):
        # 3. 数据预处理
        processed_data = None
        data_input = json_data 
        
        # 检查是否为字符串，尝试解析 JSON
        if isinstance(data_input, str):
            if not data_input.strip():
                print(f"⚠️ [JSONSlicer] 输入为空")
                # [修改] 返回值移除字符串部分
                return ([], 0, index)
            try:
                processed_data = json_module.loads(data_input)
            except Exception:
                processed_data = [data_input]
        else:
            processed_data = data_input

        # 4. 确定处理模式 (List vs Dict)
        target_list = None
        mode_type = "list" 

        if isinstance(processed_data, list):
            target_list = processed_data
            mode_type = "list"
        elif isinstance(processed_data, dict):
            target_list = list(processed_data.items())
            mode_type = "dict"
        else:
            try:
                target_list = list(processed_data)
                mode_type = "list"
            except Exception:
                target_list = [processed_data]
                mode_type = "list"

        # 5. 核心逻辑：计算索引范围与 Count
        total_items = len(target_list)
        start_idx = 0
        end_idx = 0
        out_count = 0

        if mode == "chunk":
            if length > 0:
                out_count = (total_items + length - 1) // length
            else:
                out_count = 0
            start_idx = index * length
            end_idx = (index + 1) * length
        else: # range
            out_count = total_items
            start_idx = index
            end_idx = index + length

        # 6. 执行切片
        sliced_result = target_list[start_idx : end_idx]

        # 7. 结构还原
        final_data = None
        if mode_type == "dict":
            final_data = dict(sliced_result)
        else:
            final_data = sliced_result

        # 8. 格式化输出 (虽然不再输出字符串端口，保留逻辑用于可能的调试或日志)
        # json_output = "[]"
        # try:
        #     json_output = json_module.dumps(final_data, ensure_ascii=False, indent=2)
        # except TypeError:
        #     try:
        #         json_output = str(final_data)
        #     except Exception:
        #         pass

        # [修改] 仅返回数据对象和计数索引
        return (final_data, out_count, index)

# 节点注册
NODE_CLASS_MAPPINGS = {
    "Pix_JSONSlicer": JSONSlicer
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_JSONSlicer": "JSON Slicer (PixNodes)"
}