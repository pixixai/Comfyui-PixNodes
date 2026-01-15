import torch
import colorsys

# --- 核心修复 ---
class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False

ANY = AnyType("*")
# ----------------

class ColorPicker:
    """
    PixNodes 自定义拾色器节点
    支持 RGB/HSV 模式，单接口动态多格式输出
    """
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "mode": (["RGB", "HSV"], {"default": "RGB"}), 
                # 增加了 "Brightness (Float)"
                "output_format": ([
                    "RGB (List)", 
                    "HSV (List)", 
                    "Hex (String)", 
                    "Decimal (Int)",
                    "Image (Tensor)",
                    "Brightness (Float)"
                ], {"default": "RGB (List)"}),
                "red": ("INT", {"default": 255, "min": 0, "max": 360, "step": 1, "display": "number"}),
                "green": ("INT", {"default": 255, "min": 0, "max": 360, "step": 1, "display": "number"}),
                "blue": ("INT", {"default": 255, "min": 0, "max": 360, "step": 1, "display": "number"}),
            },
        }

    RETURN_TYPES = (ANY,)
    # 改为通用名称，实际显示名称由前端 JS 动态修改
    RETURN_NAMES = ("Output",)
    
    FUNCTION = "get_color"
    CATEGORY = "PixNodes"

    def get_color(self, mode, output_format, red, green, blue):
        # 1. 统一归一化处理，计算 H, S, V (0.0 - 1.0) 和 RGB (0-255)
        h, s, v = 0.0, 0.0, 0.0
        r_int, g_int, b_int = 0, 0, 0
        r_norm, g_norm, b_norm = 0.0, 0.0, 0.0

        if mode == "HSV":
            # HSV 输入归一化
            h = max(0.0, min(1.0, red / 360.0))
            s = max(0.0, min(1.0, green / 100.0))
            v = max(0.0, min(1.0, blue / 100.0))

            # 转 RGB
            r_norm, g_norm, b_norm = colorsys.hsv_to_rgb(h, s, v)
            r_int, g_int, b_int = int(r_norm * 255), int(g_norm * 255), int(b_norm * 255)
            
        else:
            # RGB 输入
            r_int = min(255, red)
            g_int = min(255, green)
            b_int = min(255, blue)
            
            r_norm = r_int / 255.0
            g_norm = g_int / 255.0
            b_norm = b_int / 255.0

            # 转 HSV
            h, s, v = colorsys.rgb_to_hsv(r_norm, g_norm, b_norm)

        # 2. 根据格式输出
        if output_format == "Image (Tensor)":
            # [1, 1, 1, 3]
            tensor_rgb = torch.tensor([r_norm, g_norm, b_norm], dtype=torch.float32)
            image_tensor = tensor_rgb.reshape(1, 1, 1, 3)
            return (image_tensor,)

        elif output_format == "RGB (List)":
            return ([r_int, g_int, b_int],)
            
        elif output_format == "HSV (List)":
            # 输出标准单位: H(0-360), S(0-100), V(0-100)
            return ([round(h * 360.0, 2), round(s * 100.0, 2), round(v * 100.0, 2)],)
            
        elif output_format == "Decimal (Int)":
            decimal_val = (r_int << 16) | (g_int << 8) | b_int
            return (decimal_val,)

        elif output_format == "Brightness (Float)":
            # 直接输出 V (0.0 - 1.0)
            return (float(v),)
            
        else: # Hex (String)
            hex_str = "#{:02X}{:02X}{:02X}".format(r_int, g_int, b_int)
            return (hex_str,)

NODE_CLASS_MAPPINGS = {
    "Pix_ColorPicker": ColorPicker
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_ColorPicker": "Color Picker (PixNodes)"
}