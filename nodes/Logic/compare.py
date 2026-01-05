class AlwaysEqualProxy(str):
    """
    用于匹配 ComfyUI 中任意类型的代理类
    """
    def __eq__(self, _): return True
    def __ne__(self, _): return False

# 定义通配符类型
any_type = AlwaysEqualProxy("*")

class Compare:
    """
    逻辑比较节点 - PixNodes 系列
    支持等于、不等、大于、小于等多种比较逻辑
    """
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "a": (any_type, {"default": 0}),
                "b": (any_type, {"default": 0}),
                "comparison": (["a == b", "a != b", "a < b", "a > b", "a <= b", "a >= b"], {"default": "a == b"}),
            },
        }
    
    RETURN_TYPES = ("BOOLEAN",)
    RETURN_NAMES = ("boolean",)
    FUNCTION = "execute"
    # 节点分类
    CATEGORY = "PixNodes/Logic"

    def execute(self, a, b, comparison):
        # 内部逻辑保持不变，确保数学运算准确性
        if comparison == "a == b": return (a == b,)
        if comparison == "a != b": return (a != b,)
        if comparison == "a < b": return (a < b,)
        if comparison == "a > b": return (a > b,)
        if comparison == "a <= b": return (a <= b,)
        if comparison == "a >= b": return (a >= b,)
        return (False,)

# 注册映射：统一 Pix_ 前缀
NODE_CLASS_MAPPINGS = {
    "Pix_Compare": Compare
}

# 显示名称映射：代码层级使用英文，汉化交给 JSON
NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_Compare": "Compare (PixNodes)"
}