import torch

class AlwaysEqualProxy(str):
    def __eq__(self, _): return True
    def __ne__(self, _): return False

any_type = AlwaysEqualProxy("*")

class ListFromLoop:
    """
    从循环创建列表：用于在循环过程中收集每一圈产生的值。
    """
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "item": (any_type, {}), # 这一圈产生的新值
            },
            "optional": {
                "list_in": (any_type, {}), # 上一圈传下来的列表
            }
        }

    # 修改返回名称为英文标识符
    RETURN_TYPES = (any_type, "INT")
    RETURN_NAMES = ("list", "count")
    FUNCTION = "accumulate"
    CATEGORY = "PixNodes"

    def accumulate(self, item, list_in=None):
        if list_in is None or not isinstance(list_in, list):
            new_list = []
        else:
            new_list = list(list_in) 
        
        if item is not None:
            new_list.append(item)
            
        return (new_list, len(new_list))

NODE_CLASS_MAPPINGS = {
    "Pix_ListFromLoop": ListFromLoop
}

# 修改显示名称为英文，汉化交给 JSON 字典
NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_ListFromLoop": "List from Loop (PixNodes)"
}