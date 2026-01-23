import torch
import torch.nn.functional as F
import re
import colorsys
import ast

class ImageBatchCompose:
    """
    PixNodes: Image Batch Compose
    Combines dynamic image inputs into a single batch with resizing and alignment.
    Merges functionality of ToImageBatch and ImageListToBatch.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "mode": (["Fit", "Fill", "Stretch"], {"default": "Fill"}),
                "alignment": (["Top Left", "Top", "Top Right", "Left", "Center", "Right", "Bottom Left", "Bottom", "Bottom Right"], {"default": "Center"}),
                # 仅保留参数输入，与【图像列表转批次】一致
                "background_color": ("STRING", {"default": "#FFFFFF", "multiline": False, "dynamicPrompts": False}),
                "size": ("STRING", {"default": "", "multiline": False, "placeholder": "Width x Height (e.g. 512x512) or empty"}),
            },
            "optional": {
                # 动态输入起点
                "image_1": ("IMAGE",),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image_batch",)
    FUNCTION = "compose"
    CATEGORY = "PixNodes"

    # ---------------- 核心颜色解析函数 (与 ImageListToBatch 完全一致) ----------------

    def parse_color(self, color_input):
        """
        颜色解析逻辑 - 严格遵循用户定义优先级：
        1. 列表/元组: 整数->RGB, 浮点->HSV
        2. 字符串解析:
           - AST列表: "[255,0,0]" -> 转列表处理
           - RGB字符串: "rgb(255, 0, 0)" 或 "255, 128, 0" -> RGB (增强兼容性)
           - 带前缀 Hex: 
             - 支持 #, 0x, 全角＃, 双井号##
             - 支持 6位 (RRGGBB) 和 8位 (RRGGBBAA, 丢弃AA)
           - 不带前缀:
             - 6位 (纯数字或含字母) -> Hex (e.g. "888888"->灰色)
             - 8位 (含字母) -> Hex (截取前6位)
             - 8位 (纯数字) -> 十进制整数 (e.g. "16777215"->白色)
             - 其他长度数字 -> 十进制整数
        3. 整数直接输入: -> RGB
        """
        # 默认白色
        default_color = [1.0, 1.0, 1.0]
        
        if color_input is None:
            return default_color

        # ---------------------------------------------------------
        # 1. 预处理：AST 解析 (支持用户输入 "[255, 0, 0]" 这种字符串列表)
        # ---------------------------------------------------------
        if isinstance(color_input, str):
            color_input = color_input.strip()
            if not color_input:
                return default_color
                
            if color_input.startswith('[') and color_input.endswith(']'):
                try:
                    parsed_list = ast.literal_eval(color_input)
                    if isinstance(parsed_list, (list, tuple)):
                        color_input = parsed_list
                except (ValueError, SyntaxError):
                    pass # 解析失败则继续作为普通字符串处理

        # ---------------------------------------------------------
        # 2. 列表/元组处理 (支持 RGB 和 HSV)
        # ---------------------------------------------------------
        if isinstance(color_input, (list, tuple)):
            if len(color_input) == 0: return default_color
            
            # 处理嵌套列表 (Batch 输入可能导致嵌套)
            if isinstance(color_input[0], (list, tuple)):
                return self.parse_color(color_input[0])
                
            # 确保前三个是数字
            if len(color_input) >= 3 and all(isinstance(x, (int, float)) for x in color_input[:3]):
                vals = color_input[:3]
                
                # 规则：全整数 -> RGB (0-255)
                #      含浮点 -> HSV (自动量程)
                is_all_int = all(isinstance(x, int) for x in vals)
                
                if is_all_int:
                    return [v / 255.0 for v in vals]
                else:
                    # HSV 模式
                    h, s, v = float(vals[0]), float(vals[1]), float(vals[2])
                    # 自动量程识别 (360/100/100 -> 1.0/1.0/1.0)
                    if h > 1.0 or s > 1.0 or v > 1.0:
                        h, s, v = h / 360.0, s / 100.0, v / 100.0
                    
                    rgb = list(colorsys.hsv_to_rgb(h, s, v))
                    return [max(0.0, min(1.0, c)) for c in rgb]
            
            # 单个值的列表 (e.g. ["#FFFFFF"])
            if len(color_input) == 1:
                return self.parse_color(color_input[0])

        # ---------------------------------------------------------
        # 3. 字符串核心解析逻辑
        # ---------------------------------------------------------
        if isinstance(color_input, str):
            # 3.1 RGB 逗号分隔 (增强版)
            # 只要包含逗号，就尝试作为数组解析
            if ',' in color_input:
                try:
                    # 移除所有非数字、非逗号、非小数点的字符
                    # 这将支持 "rgb(255, 0, 0)", "(255, 0, 0)", "Color: 255, 0, 0"
                    clean_rgb_str = re.sub(r'[^\d,.]', '', color_input)
                    parts = clean_rgb_str.split(',')
                    # 过滤空字符串
                    parts = [p for p in parts if p]
                    
                    if len(parts) >= 3:
                        vals = [float(p.strip()) for p in parts[:3]]
                        return [max(0.0, min(1.0, v / 255.0)) for v in vals]
                except ValueError:
                    pass

            # 3.2 清理空格，统一处理 Hex 和 Int
            # 用户要求：
            # 1. 中间有空格自动忽略 (e.g. "# FF 00 00")
            # 2. 全角井号转半角
            clean_str = color_input.replace(" ", "").lower().replace("＃", "#")

            # 3.3 带前缀的 Hex (#, ##, 0x)
            # 正则匹配：以 # (一个或多个) 或 0x 开头
            prefix_match = re.match(r'^(?:#+|0x)(.*)$', clean_str)
            if prefix_match:
                hex_body = prefix_match.group(1)
                
                # 处理 8 位 Hex (RRGGBBAA) -> 截取前 6 位，丢弃 Alpha
                if len(hex_body) == 8:
                    hex_body = hex_body[:6]
                
                # 仅支持 6 位 Hex
                if len(hex_body) == 6:
                    try:
                        r = int(hex_body[0:2], 16) / 255.0
                        g = int(hex_body[2:4], 16) / 255.0
                        b = int(hex_body[4:6], 16) / 255.0
                        return [r, g, b]
                    except ValueError: pass

            # 3.4 不带前缀的情况
            else:
                is_hex = False
                temp_hex_str = clean_str
                
                # 规则 A: 6 位字符 (无论纯数字还是含字母) -> 优先视为 Hex
                if len(temp_hex_str) == 6 and bool(re.fullmatch(r'[0-9a-f]{6}', temp_hex_str)):
                    is_hex = True
                
                # 规则 B: 8 位字符
                # 如果包含字母 -> 视为 Hex (RRGGBBAA)，截取前6位
                # 如果是全数字 (e.g. "16777215") -> 视为 十进制 (保留给下面的 isdigit 处理)
                elif len(temp_hex_str) == 8 and bool(re.search(r'[a-f]', temp_hex_str)) and bool(re.fullmatch(r'[0-9a-f]{8}', temp_hex_str)):
                     temp_hex_str = temp_hex_str[:6] # 截取
                     is_hex = True

                if is_hex:
                    try:
                        r = int(temp_hex_str[0:2], 16) / 255.0
                        g = int(temp_hex_str[2:4], 16) / 255.0
                        b = int(temp_hex_str[4:6], 16) / 255.0
                        return [r, g, b]
                    except ValueError: pass
                
                # 规则 C: 其他长度的全数字 (e.g. "16711680") -> 识别为十进制整数
                # 注意：8位全数字也会掉落到这里，被正确识别为十进制
                if clean_str.isdigit():
                    try:
                        val = int(clean_str)
                        # 十进制整数转 RGB (位运算)
                        r = (val >> 16) & 0xFF
                        g = (val >> 8) & 0xFF
                        b = val & 0xFF
                        return [r / 255.0, g / 255.0, b / 255.0]
                    except ValueError: pass

        # ---------------------------------------------------------
        # 4. 整数直接输入 (e.g. 从其他节点传入的 INT)
        # ---------------------------------------------------------
        if isinstance(color_input, int):
            r = (color_input >> 16) & 0xFF
            g = (color_input >> 8) & 0xFF
            b = color_input & 0xFF
            return [r / 255.0, g / 255.0, b / 255.0]
            
        # ---------------------------------------------------------
        # 5. Tensor 输入处理
        # ---------------------------------------------------------
        if isinstance(color_input, torch.Tensor):
            return self.parse_color(color_input.flatten().tolist())

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
                w, h = int(nums[0]), int(nums[1])
                return h, w # 返回 target_h, target_w
        except Exception:
            pass
        return fallback_size

    def calculate_alignment(self, align_type, diff_w, diff_h):
        diff_w, diff_h = max(0, diff_w), max(0, diff_h)
        x_offset, y_offset = diff_w // 2, diff_h // 2
        
        if "Left" in align_type: x_offset = 0
        elif "Right" in align_type: x_offset = diff_w
        
        if "Top" in align_type: y_offset = 0
        elif "Bottom" in align_type: y_offset = diff_h
            
        return x_offset, y_offset

    # ---------------- 主执行逻辑 ----------------

    def compose(self, mode, alignment, background_color, size, **kwargs):
        # 1. 动态收集图像输入
        images = []
        image_keys = [k for k in kwargs.keys() if k.startswith("image_")]
        sorted_keys = sorted(image_keys, key=lambda x: int(x.split('_')[1]))
        
        for key in sorted_keys:
            img = kwargs[key]
            if img is not None:
                images.append(img)
        
        # 没有任何输入时的防御
        if not images:
            return (torch.zeros([1, 64, 64, 3]),)

        # 2. 解析背景色 (仅使用参数 background_color)
        bg_rgb = self.parse_color(background_color)

        # 3. 预处理：确保所有输入都是 [B, H, W, 3] 格式
        processed_input_list = []
        for item in images:
            # 处理通道
            if item.shape[-1] == 1: item = item.repeat(1, 1, 1, 3)
            elif item.shape[-1] == 4: item = item[:, :, :, :3]
            
            # 确保维度 [B, H, W, C]
            if item.ndim == 3: item = item.unsqueeze(0)
            
            processed_input_list.append(item)

        # 4. 确定目标尺寸
        first_img_h, first_img_w = processed_input_list[0].shape[1], processed_input_list[0].shape[2]
        target_h, target_w = self.parse_size(size, (first_img_h, first_img_w))

        final_frames = []

        # 5. 循环处理每一张图 (Resize & Align)
        for img_batch in processed_input_list:
            for i in range(img_batch.shape[0]):
                img = img_batch[i:i+1] # [1, H, W, C]
                curr_h, curr_w = img.shape[1], img.shape[2]
                
                img_chw = img.permute(0, 3, 1, 2)
                
                if mode == "Stretch":
                    img_out = F.interpolate(img_chw, size=(target_h, target_w), mode='bilinear', align_corners=False)
                
                elif mode == "Fit":
                    scale = min(target_w / curr_w, target_h / curr_h)
                    new_w, new_h = max(1, round(curr_w * scale)), max(1, round(curr_h * scale))
                    resized = F.interpolate(img_chw, size=(new_h, new_w), mode='bilinear', align_corners=False)
                    
                    diff_w, diff_h = target_w - new_w, target_h - new_h
                    x_off, y_off = self.calculate_alignment(alignment, diff_w, diff_h)
                    
                    bg_tensor = torch.tensor(bg_rgb, device=img.device, dtype=torch.float32).view(1, 3, 1, 1)
                    final_canvas = bg_tensor.expand(1, 3, target_h, target_w).clone()
                    final_canvas[:, :, y_off:y_off+new_h, x_off:x_off+new_w] = resized
                    img_out = final_canvas
                
                elif mode == "Fill":
                    scale = max(target_w / curr_w, target_h / curr_h)
                    new_w, new_h = max(target_w, round(curr_w * scale)), max(target_h, round(curr_h * scale))
                    resized = F.interpolate(img_chw, size=(new_h, new_w), mode='bilinear', align_corners=False)
                    
                    diff_w, diff_h = new_w - target_w, new_h - target_h
                    x_off, y_off = self.calculate_alignment(alignment, diff_w, diff_h)
                    
                    img_out = resized[:, :, y_off:y_off+target_h, x_off:x_off+target_w]

                final_frames.append(img_out.permute(0, 2, 3, 1))

        # 6. 拼接输出
        if not final_frames:
            return (torch.zeros([1, target_h, target_w, 3]),)
            
        final_batch = torch.cat(final_frames, dim=0)
        return (final_batch,)

NODE_CLASS_MAPPINGS = {
    "Pix_ImageBatchCompose": ImageBatchCompose
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_ImageBatchCompose": "Image Batch Compose (PixNodes)"
}