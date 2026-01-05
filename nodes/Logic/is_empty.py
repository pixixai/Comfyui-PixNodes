import torch

class AnyDataIsEmpty:
    """
    一个用于检查输入数据是否为空的节点。
    支持检查 None, 空张量, 空图片, 空字符串, 以及空列表/字典。
    通过包含 input_types 参数的 VALIDATE_INPUTS 彻底绕过 ComfyUI 的类型匹配校验。
    """
    
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "invert": ("BOOLEAN", {"default": False, "label_on": "Invert (Empty=False)", "label_off": "Normal (Empty=True)"}),
            },
            "optional": {
                # 使用 "*" 代表通配符输入，支持任意类型连入
                "any_data": ("*",),
            }
        }

    RETURN_TYPES = ("BOOLEAN",)
    RETURN_NAMES = ("is_empty",)
    FUNCTION = "check_empty"
    CATEGORY = "PixNodes/Logic"

    @classmethod
    def VALIDATE_INPUTS(cls, input_types):
        """
        核心逻辑：当此参数存在时，ComfyUI 会跳过默认的插槽类型匹配校验，
        从而允许 STRING, IMAGE, LATENT, JSON 等任何类型连入 "*" 插槽。
        """
        return True

    def check_empty(self, invert, any_data=None):
        is_empty_flag = False
        
        # 1. 检查是否为 None
        if any_data is None:
            is_empty_flag = True
        
        # 2. 检查 PyTorch 张量 (IMAGE, MASK 等)
        elif isinstance(any_data, torch.Tensor):
            # 只要张量中有元素 (numel > 0)，就认为不为空
            is_empty_flag = (any_data.numel() == 0)
                
        # 3. 检查字典或嵌套结构 (Latent, JSON 对象等)
        elif isinstance(any_data, dict):
            # 如果是 Latent 格式，检查其 samples 键
            if "samples" in any_data and isinstance(any_data["samples"], torch.Tensor):
                is_empty_flag = (any_data["samples"].numel() == 0)
            else:
                # 否则检查字典本身是否有键值对
                is_empty_flag = (len(any_data) == 0)
        
        # 4. 检查常规容器或文本 (STRING, LIST, TUPLE, JSON 文本等)
        elif isinstance(any_data, (list, str, tuple)):
            # 只要长度大于 0，就认为不为空
            is_empty_flag = (len(any_data) == 0)
        
        # 5. 其他基础类型 (INT, FLOAT, BOOLEAN 等) 均视为非空
        else:
            is_empty_flag = False

        # 处理反转逻辑
        # 默认：空 -> True, 不空 -> False
        # 反转：空 -> False, 不空 -> True
        result = is_empty_flag if not invert else not is_empty_flag
        
        return (result,)

# 节点映射
NODE_CLASS_MAPPINGS = {
    "Pix_AnyDataIsEmpty": AnyDataIsEmpty
}

# 显示名称映射
NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_AnyDataIsEmpty": "Any Data Is Empty"
}