from comfy_execution.graph import ExecutionBlocker

class AlwaysEqualProxy(str):
    def __eq__(self, _): return True
    def __ne__(self, _): return False

any_type = AlwaysEqualProxy("*")

class IfElseDispatcher:
    """
    IfElse 分发器：将流一分为二。注意：未选中的分支会阻塞下游。
    """
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "any_value": (any_type, {}),
                "if_true": ("BOOLEAN", {"default": True}),
            }
        }

    # 修改输出标识符为英文
    RETURN_TYPES = (any_type, any_type)
    RETURN_NAMES = ("true_branch", "false_branch")
    FUNCTION = "dispatch"
    CATEGORY = "PixNodes"

    def dispatch(self, any_value, if_true):
        if if_true:
            return (any_value, ExecutionBlocker(None))
        else:
            return (ExecutionBlocker(None), any_value)

NODE_CLASS_MAPPINGS = {
    "Pix_IfElseDispatcher": IfElseDispatcher
}

# 修改显示名称映射为英文标识符，后续通过 JSON 进行汉化
NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_IfElseDispatcher": "If-Else Dispatcher (PixNodes)"
}