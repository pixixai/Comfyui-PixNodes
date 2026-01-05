import torch

class Pix_ImageSplitter:
    """
    图像切分节点：将输入的图像按指定的行列平均切分，并输出为图像批次。
    """
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "image": ("IMAGE",),
                "horizontal": ("INT", {"default": 3, "min": 1, "max": 64, "step": 1}),
                "vertical": ("INT", {"default": 3, "min": 1, "max": 64, "step": 1}),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("IMAGE_BATCH",)
    FUNCTION = "split_image"
    CATEGORY = "PixNodes"

    def split_image(self, image, horizontal, vertical):
        # image 形状为 [B, H, W, C]
        # B: 批量大小, H: 高度, W: 宽度, C: 通道数
        batch_size, height, width, channels = image.shape
        
        # 计算每个切片的尺寸（整除可能导致边缘极小部分被舍弃，这是常规做法）
        tile_h = height // vertical
        tile_w = width // horizontal
        
        output_images = []

        # 遍历每一张输入图片（支持输入本身就是批次的情况）
        for b in range(batch_size):
            img = image[b] # 提取单张图片 [H, W, C]
            
            # 按行（垂直）和列（水平）进行切分
            for y in range(vertical):
                for x in range(horizontal):
                    # 计算切片区域
                    y_start = y * tile_h
                    y_end = y_start + tile_h
                    x_start = x * tile_w
                    x_end = x_start + tile_w
                    
                    # 进行切片操作并保持维度
                    tile = img[y_start:y_end, x_start:x_end, :]
                    
                    # 增加批量维度以符合 IMAGE 格式要求 [1, H, W, C]
                    output_images.append(tile.unsqueeze(0))

        # 将所有切片在第 0 维（B 维）拼接成新的大批次
        if len(output_images) > 0:
            result = torch.cat(output_images, dim=0)
        else:
            # 防御性编程：如果未切分出图片，返回空批次（通常不会发生）
            result = image

        return (result,)

# 注册节点类映射，使用 Pix_ 前缀规范 ID
NODE_CLASS_MAPPINGS = {
    "Pix_ImageSplitter": Pix_ImageSplitter
}

# 注册显示名称映射，使用英文名称以支持后期国际化
NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_ImageSplitter": "Image Splitter (Pix)"
}