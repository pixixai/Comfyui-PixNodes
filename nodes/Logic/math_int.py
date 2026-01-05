class MathIntOperation:
    """
    整数数学运算节点 - PixNodes 系列
    支持加、减、乘、除、取模和幂运算
    """
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "a": ("INT", {"default": 0, "min": -0xffffffffffffffff, "max": 0xffffffffffffffff}),
                "b": ("INT", {"default": 0, "min": -0xffffffffffffffff, "max": 0xffffffffffffffff}),
                "operation": (["add", "subtract", "multiply", "divide", "modulo", "power"],),
            },
        }
    
    RETURN_TYPES = ("INT",)
    RETURN_NAMES = ("result",)
    FUNCTION = "execute"
    # 节点分类
    CATEGORY = "PixNodes/Logic"

    def execute(self, a, b, operation):
        # 核心数学逻辑处理
        if operation == "add": return (a + b,)
        if operation == "subtract": return (a - b,)
        if operation == "multiply": return (a * b,)
        if operation == "divide": return (a // b if b != 0 else 0,)
        if operation == "modulo": return (a % b if b != 0 else 0,)
        if operation == "power": return (a ** b,)
        return (0,)

# 注册映射：统一使用 Pix_ 前缀
NODE_CLASS_MAPPINGS = {
    "Pix_MathInt": MathIntOperation
}

# 显示名称映射：代码层级使用英文标识
NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_MathInt": "Math Integer (PixNodes)"
}