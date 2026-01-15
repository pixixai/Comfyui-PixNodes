import torch
import torch.nn.functional as F
import re
import colorsys

class ImageListToBatch:
    """
    Advanced Image List to Batch:
    Normalize a list of images (potentially different sizes) into a single batch tensor.
    Supports resizing (Fit/Fill/Stretch), alignment, and background padding.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image_list": ("IMAGE", {"forceInput": True}), # 强制输入必须连接
                "mode": (["Fit", "Fill", "Stretch"], {"default": "Fill"}),
                "alignment": (["Top Left", "Top", "Top Right", "Left", "Center", "Right", "Bottom Left", "Bottom", "Bottom Right"], {"default": "Center"}),
                "size": ("STRING", {"default": "", "multiline": False, "placeholder": "512x512 or empty for first image size"}),
            },
            "optional": {
                # 更改为可选输入接口，类型为 * (Wildcard)，支持 String/Int/List 等
                # 如果不连接，将在代码中默认处理为白色
                "background_color": ("*",), 
            }
        }

    # 关键设置：接收整个列表作为输入，而不是由 ComfyUI 自动循环
    INPUT_IS_LIST = True
    
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image_batch",)
    FUNCTION = "convert"
    CATEGORY = "PixNodes"

    def parse_color(self, color_input):
        # 默认白色
        default_color = [1.0, 1.0, 1.0]
        
        if color_input is None:
            return default_color

        # 1. 处理列表/元组 (RGB Array vs HSV Array)
        if isinstance(color_input, (list, tuple)):
            # 如果是空列表，返回默认
            if len(color_input) == 0:
                return default_color
            
            # 如果是嵌套列表（比如来自 Batch 输入），取第一个
            if isinstance(color_input[0], (list, tuple)):
                return self.parse_color(color_input[0])
                
            # 处理数值列表
            if len(color_input) >= 3 and all(isinstance(x, (int, float)) for x in color_input[:3]):
                vals = color_input[:3]
                
                # 规则：数组中数字全为整数 -> RGB数组 (0-255)
                #      数组中包含浮点数 -> HSV数组
                is_all_int = all(isinstance(x, int) for x in vals)
                
                if is_all_int:
                    # RGB Int (0-255) -> RGB Float (0-1)
                    return [v / 255.0 for v in vals]
                else:
                    # HSV 模式
                    h, s, v = float(vals[0]), float(vals[1]), float(vals[2])
                    
                    # 自动量程识别：
                    # 如果任意值 > 1.0，则假设用户使用的是 360/100/100 的设计软件标准
                    if h > 1.0 or s > 1.0 or v > 1.0:
                        h = h / 360.0 # H: 0-360 -> 0-1
                        s = s / 100.0 # S: 0-100 -> 0-1
                        v = v / 100.0 # V: 0-100 -> 0-1
                    
                    # 转换并 Clamp 防止溢出
                    rgb = list(colorsys.hsv_to_rgb(h, s, v))
                    return [max(0.0, min(1.0, c)) for c in rgb]
            
            # 可能是由 INPUT_IS_LIST=True 传入的单个值列表 (e.g. ["#FFFFFF"] 或 [16777215])
            if len(color_input) == 1:
                return self.parse_color(color_input[0])

        # 2. 处理 Tensor (转为列表处理)
        if isinstance(color_input, torch.Tensor):
            return self.parse_color(color_input.flatten().tolist())

        # 3. 处理十进制颜色值 (Int)
        if isinstance(color_input, int):
            r = (color_input >> 16) & 0xFF
            g = (color_input >> 8) & 0xFF
            b = color_input & 0xFF
            return [r / 255.0, g / 255.0, b / 255.0]

        # 4. 处理字符串 (Hex / RGB String)
        if isinstance(color_input, str):
            if not color_input.strip():
                return default_color
                
            # Hex 格式 (#RRGGBB)
            hex_match = re.search(r'#?([0-9a-fA-F]{6})', color_input)
            if hex_match:
                hex_val = hex_match.group(1)
                r = int(hex_val[0:2], 16) / 255.0
                g = int(hex_val[2:4], 16) / 255.0
                b = int(hex_val[4:6], 16) / 255.0
                return [r, g, b]
            
            # RGB 字符串格式 (255, 255, 255)
            rgb_match = re.findall(r'\d+', color_input)
            if len(rgb_match) >= 3:
                return [int(c) / 255.0 for c in rgb_match[:3]]

        return default_color

    def parse_size(self, size_str, fallback_size):
        try:
            if not size_str or not isinstance(size_str, str) or size_str.strip() == "":
                return fallback_size
                
            nums = re.findall(r'\d+', size_str)
            if len(nums) == 1:
                val = int(nums[0])
                return val, val 
            elif len(nums) >= 2:
                w = int(nums[0])
                h = int(nums[1])
                # 注意：ComfyUI 通常习惯 宽x高 字符串，但 tensor 是 (B, H, W, C)
                # 这里返回的是 target_h, target_w
                return h, w 
        except Exception:
            pass
        return fallback_size

    def calculate_alignment(self, align_type, diff_w, diff_h):
        # 确保偏移量不为负
        diff_w, diff_h = max(0, diff_w), max(0, diff_h)
        x_offset = diff_w // 2
        y_offset = diff_h // 2

        if "Left" in align_type: x_offset = 0
        elif "Right" in align_type: x_offset = diff_w
        
        if "Top" in align_type: y_offset = 0
        elif "Bottom" in align_type: y_offset = diff_h
            
        return x_offset, y_offset

    def convert(self, image_list, mode, alignment, size, background_color=None):
        # 因为 INPUT_IS_LIST = True，所有非 list 输入也会被包装成 list
        if isinstance(mode, list): mode = mode[0]
        if isinstance(alignment, list): alignment = alignment[0]
        if isinstance(size, list): size = size[0]
        
        # 处理 background_color
        # 这里的 background_color 是一个列表（因为 INPUT_IS_LIST=True），包含了连接的数据
        # 如果未连接，可能是 None 或 []
        bg_input = None
        if background_color and isinstance(background_color, list) and len(background_color) > 0:
            bg_input = background_color[0] # 取第一个作为全局背景色
        elif background_color is not None and not isinstance(background_color, list):
            bg_input = background_color
            
        bg_rgb = self.parse_color(bg_input)
        
        # 基础校验
        if not image_list:
            # 返回一个空的 64x64 黑色图片防止报错
            return (torch.zeros([1, 64, 64, 3]),)

        # 1. 预处理：统一转为 [B, H, W, 3] 格式
        raw_images = []
        for item in image_list:
            if isinstance(item, torch.Tensor):
                # 处理通道
                if item.shape[-1] == 1: # Mask -> RGB
                    item = item.repeat(1, 1, 1, 3) if item.ndim == 4 else item.unsqueeze(-1).repeat(1, 1, 1, 3)
                elif item.shape[-1] == 4: # RGBA -> RGB (丢弃 Alpha)
                    item = item[:, :, :, :3]
                elif item.shape[-1] != 3: # 异常通道处理
                     # 简单防错，假设是 [B, H, W, C]
                     item = item[:, :, :, :3]

                # 统一维度为 [B, H, W, C]
                if item.ndim == 3:
                    raw_images.append(item.unsqueeze(0))
                elif item.ndim == 4:
                    raw_images.append(item)

        if not raw_images:
            return (torch.zeros([1, 64, 64, 3]),)

        # 2. 确定目标尺寸 (H, W)
        # 默认使用第一张图的尺寸作为基准
        first_img_h, first_img_w = raw_images[0].shape[1], raw_images[0].shape[2]
        target_h, target_w = self.parse_size(size, (first_img_h, first_img_w))
        
        processed_images = []
        
        # 3. 处理每一张图片
        for img_batch in raw_images:
            for i in range(img_batch.shape[0]):
                img = img_batch[i:i+1] # [1, H, W, C]
                curr_h, curr_w = img.shape[1], img.shape[2]
                
                # Permute to [1, C, H, W] for interpolate
                img_chw = img.permute(0, 3, 1, 2) 
                
                if mode == "Stretch":
                    # 直接拉伸到目标尺寸
                    img_out = F.interpolate(img_chw, size=(target_h, target_w), mode='bilinear', align_corners=False)
                
                elif mode == "Fit":
                    # 保持比例缩放，短边对齐，长边留白填充背景色
                    scale = min(target_w / curr_w, target_h / curr_h)
                    new_w, new_h = max(1, round(curr_w * scale)), max(1, round(curr_h * scale))
                    resized = F.interpolate(img_chw, size=(new_h, new_w), mode='bilinear', align_corners=False)
                    
                    diff_w, diff_h = target_w - new_w, target_h - new_h
                    x_off, y_off = self.calculate_alignment(alignment, diff_w, diff_h)
                    
                    # 构造背景
                    bg_tensor = torch.tensor(bg_rgb, device=img.device, dtype=img_out.dtype if 'img_out' in locals() else torch.float32).view(1, 3, 1, 1)
                    final_canvas = bg_tensor.expand(1, 3, target_h, target_w).clone()
                    
                    # 放入图片
                    final_canvas[:, :, y_off:y_off+new_h, x_off:x_off+new_w] = resized
                    img_out = final_canvas
                
                elif mode == "Fill":
                    # 保持比例缩放，长边对齐，超出部分裁剪
                    scale = max(target_w / curr_w, target_h / curr_h)
                    new_w, new_h = max(target_w, round(curr_w * scale)), max(target_h, round(curr_h * scale))
                    resized = F.interpolate(img_chw, size=(new_h, new_w), mode='bilinear', align_corners=False)
                    
                    # 计算裁剪区域
                    diff_w, diff_h = new_w - target_w, new_h - target_h
                    x_off, y_off = self.calculate_alignment(alignment, diff_w, diff_h)
                    
                    # 裁剪
                    img_out = resized[:, :, y_off:y_off+target_h, x_off:x_off+target_w]

                # 转回 [1, H, W, C]
                processed_images.append(img_out.permute(0, 2, 3, 1))
        
        # 4. 拼接
        if not processed_images:
             return (torch.zeros([1, target_h, target_w, 3]),)
             
        final_batch = torch.cat(processed_images, dim=0)
        return (final_batch,)

# 导出节点映射
NODE_CLASS_MAPPINGS = {
    "Pix_ImageListToBatch": ImageListToBatch
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_ImageListToBatch": "Image List to Batch (PixNodes)"
}