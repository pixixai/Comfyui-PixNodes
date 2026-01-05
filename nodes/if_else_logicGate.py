from comfy_execution.graph import ExecutionBlocker

class AlwaysEqualProxy(str):
    def __eq__(self, _): return True
    def __ne__(self, _): return False

any_type = AlwaysEqualProxy("*")

class IfElseLogicGate:
    """
    IfElse逻辑阀：将两个分支合并回一个流。
    """
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "true_path": (any_type, {}), 
                "false_path": (any_type, {}),
            }
        }

    # 修改返回名称为英文标识符
    RETURN_TYPES = (any_type,)
    RETURN_NAMES = ("output",)
    FUNCTION = "pick_valid"
    CATEGORY = "PixNodes"

    def pick_valid(self, true_path, false_path):
        # 逻辑：如果 true_path 被阻塞，则尝试返回 false_path
        if isinstance(true_path, ExecutionBlocker):
            return (false_path,)
        return (true_path,)

NODE_CLASS_MAPPINGS = {
    "Pix_IfElseLogicGate": IfElseLogicGate
}

# 修改显示名称映射为英文，确保后端通用性
NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_IfElseLogicGate": "If-Else Logic Gate (PixNodes)"
}