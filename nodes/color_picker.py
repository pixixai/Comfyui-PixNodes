import colorsys

class ColorPicker:
    """
    颜色选择与转换节点 - PixNodes 系列
    支持RGB、HSV和HEX三种颜色模式的输入，并输出多种颜色格式
    """
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        """
        定义输入参数
        """
        return {
            "required": {
                "color_mode": (["RGB", "HSV", "HEX"], {
                    "default": "RGB"  # 默认颜色模式为RGB
                }),
                "value": ("STRING", {
                    "multiline": False,  # 单行输入框
                    "default": "111,222,333",  # 默认RGB值
                    "dynamicPrompts": False  # 禁用动态提示
                }),
            },
        }

    # 定义输出类型（5种输出）
    RETURN_TYPES = ("STRING", "INT", "STRING", "STRING", "STRING")
    # 定义输出名称
    RETURN_NAMES = ("RGB", "RGB_INT", "HSV", "HEX", "HEX_NO_HASH")
    
    # 入口函数名
    FUNCTION = "convert_color"
    # 节点分类
    CATEGORY = "PixNodes"

    def convert_color(self, color_mode, value):
        """
        颜色转换主函数
        """
        # 初始化默认颜色值(RGB)
        r, g, b = 111, 222, 333
        
        try:
            if color_mode == "RGB":
                # 解析RGB输入(格式:"R,G,B")
                rgb_values = [int(x.strip()) for x in value.split(",")]
                if len(rgb_values) == 3:
                    r, g, b = rgb_values
                else:
                    raise ValueError("RGB输入应为逗号分隔的3个数值")
                    
            elif color_mode == "HSV":
                # 解析HSV输入(格式:"H,S,V")
                hsv_values = [float(x.strip()) for x in value.split(",")]
                if len(hsv_values) == 3:
                    h, s, v = hsv_values
                    # 将HSV转换为RGB(范围:0-1)
                    r, g, b = [int(x * 255) for x in colorsys.hsv_to_rgb(h/360.0, s/100.0, v/100.0)]
                else:
                    raise ValueError("HSV输入应为逗号分隔的3个数值")
                    
            elif color_mode == "HEX":
                # 解析HEX输入(格式:"#RRGGBB"或"RRGGBB")
                hex_value = value.strip().lstrip('#')
                if len(hex_value) == 6:
                    # 将16进制转换为10进制
                    r = int(hex_value[0:2], 16)
                    g = int(hex_value[2:4], 16)
                    b = int(hex_value[4:6], 16)
                else:
                    raise ValueError("HEX输入应为6个字符")
        
        except Exception as e:
            print(f"颜色值解析错误: {e}")
            r, g, b = 111, 222, 333  # 使用默认值
        
        # 确保RGB值在0-255范围内
        r = max(0, min(255, r))
        g = max(0, min(255, g))
        b = max(0, min(255, b))
        
        # 准备输出结果
        rgb_str = f"{r},{g},{b}"
        rgb_int = (r << 16) | (g << 8) | b
        h, s, v = colorsys.rgb_to_hsv(r/255.0, g/255.0, b/255.0)
        hsv_str = f"{round(h*360,1)},{round(s*100,1)},{round(v*100,1)}"
        hex_str = f"#{r:02x}{g:02x}{b:02x}".upper()
        hex_no_hash = f"{r:02x}{g:02x}{b:02x}".upper()
        
        return (rgb_str, rgb_int, hsv_str, hex_str, hex_no_hash)

# 节点类映射
NODE_CLASS_MAPPINGS = {
    "Pix_ColorPicker": ColorPicker
}

# 节点显示名称映射
NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_ColorPicker": "Color Picker (PixNodes)"
}