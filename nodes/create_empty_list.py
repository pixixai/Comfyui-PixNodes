from typing import Any, Tuple, Dict

class AlwaysEqualProxy(str):
    """一个辅助类，始终认为与任何字符串相等。
    用于 ComfyUI 中的通配符类型（Wildcard）匹配。"""
    def __eq__(self, _): return True
    def __ne__(self, _): return False

# 定义通配符类型
ANY_TYPE = AlwaysEqualProxy("*")

class EmptyListGenerator:
    """
    空列表生成器：初始化一个空的列表容器。
    通常用作循环累加或列表操作的起始起点。
    """
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {},
            "optional": {}
        }
    
    RETURN_TYPES = (ANY_TYPE,)
    RETURN_NAMES = ("list",)
    FUNCTION = "generate_empty_list"
    CATEGORY = "PixNodes"

    def generate_empty_list(self) -> Tuple[list]:
        # 直接返回一个包含空 Python 列表的元组
        return ([],)

# 节点类映射
NODE_CLASS_MAPPINGS = {
    "Pix_CreateEmptyList": EmptyListGenerator
}

# 节点显示名称映射（会被 i18n 配置覆盖）
NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_CreateEmptyList": "CreateEmptyList"
}