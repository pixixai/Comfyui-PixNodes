import torch
import torch.nn.functional as F

class AlwaysEqualProxy(str):
    def __eq__(self, _): return True
    def __ne__(self, _): return False

any_type = AlwaysEqualProxy("*")

class ListToImageBatch:
    """
    列表转图像批次：将收集到的图像列表合并为标准 Tensor 批次。
    支持自动缩放以匹配首张图像尺寸。
    """
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image_list": (any_type, {}),
            }
        }

    # 修改输出标识符为英文
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image_batch",)
    FUNCTION = "convert"
    CATEGORY = "PixNodes"

    def convert(self, image_list):
        if image_list is None:
            return (torch.zeros([1, 64, 64, 3]),)
            
        if not isinstance(image_list, list):
            if isinstance(image_list, torch.Tensor):
                return (image_list if image_list.ndim == 4 else image_list.unsqueeze(0),)
            return (torch.zeros([1, 64, 64, 3]),)
        
        raw_images = []
        for item in image_list:
            if isinstance(item, torch.Tensor):
                if item.ndim == 4:
                    raw_images.append(item)
                elif item.ndim == 3:
                    raw_images.append(item.unsqueeze(0))

        if not raw_images:
            return (torch.zeros([1, 64, 64, 3]),)

        first_img = raw_images[0]
        _, H, W, C = first_img.shape
        
        processed_images = []
        for img in raw_images:
            for i in range(img.shape[0]):
                single_img = img[i:i+1]
                # 如果尺寸不匹配，进行双线性插值缩放
                if single_img.shape[1] != H or single_img.shape[2] != W:
                    tmp = single_img.permute(0, 3, 1, 2)
                    tmp = F.interpolate(tmp, size=(H, W), mode='bilinear', align_corners=False)
                    single_img = tmp.permute(0, 2, 3, 1)
                processed_images.append(single_img)
            
        return (torch.cat(processed_images, dim=0),)

NODE_CLASS_MAPPINGS = {
    "Pix_ListToImageBatch": ListToImageBatch
}

# 修改显示名称为英文，汉化由 JSON 负责
NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_ListToImageBatch": "List to Image Batch (PixNodes)"
}