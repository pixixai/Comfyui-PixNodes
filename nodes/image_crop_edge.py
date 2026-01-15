import torch

class Pix_ImageCropEdge:
    """
    Pix_ImageCropEdge: 解析 crop_size 字符串并裁剪图像边缘。
    支持单值 (10) 或多值 (10,20,10,5 -> 上,下,左,右)。
    """
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "image": ("IMAGE",),
                "crop_size": ("STRING", {"default": "0", "multiline": False, "placeholder": "Top,Bottom,Left,Right (e.g.: 10,20,30,40)"}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "crop_edges"
    CATEGORY = "PixNodes"

    def crop_edges(self, image, crop_size):
        # image 形状为 [B, H, W, C]
        batch_size, height, width, channels = image.shape

        # 解析 crop_size 字符串
        try:
            # 拆分、去除空格、转为整数，忽略非数字项
            parts = [int(p.strip()) for p in crop_size.split(',') if p.strip().lstrip('-').isdigit()]
        except ValueError:
            parts = [0]

        # 初始化 4 个方向的裁剪值 [上, 下, 左, 右]
        c_top, c_bottom, c_left, c_right = 0, 0, 0, 0

        if len(parts) == 1:
            # 单值情况：四边统一
            val = max(0, parts[0])
            c_top = c_bottom = c_left = c_right = val
        elif len(parts) > 0:
            # 多值情况：按顺序 [上, 下, 左, 右] 分配
            c_top = max(0, parts[0])
            if len(parts) > 1: c_bottom = max(0, parts[1])
            if len(parts) > 2: c_left = max(0, parts[2])
            if len(parts) > 3: c_right = max(0, parts[3])
        
        # 计算裁剪索引（安全边界检查）
        y_start = min(c_top, height)
        y_end = max(height - c_bottom, y_start)
        
        x_start = min(c_left, width)
        x_end = max(width - c_right, x_start)

        # 执行张量切片
        cropped_image = image[:, y_start:y_end, x_start:x_end, :]

        # 极端情况处理
        if cropped_image.shape[1] == 0 or cropped_image.shape[2] == 0:
            return (torch.zeros((batch_size, 1, 1, channels)),)

        return (cropped_image,)

# 注册节点名称映射
NODE_CLASS_MAPPINGS = {
    "Pix_ImageCropEdge": Pix_ImageCropEdge
}

# 注册 UI 显示名称
NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_ImageCropEdge": "Image Crop Edge (PixNodes)"
}