import torch
from nodes import PreviewImage

class ImageComparer(PreviewImage):
    """
    Pix Image Comparer
    一个独立的图像对比节点，移植自 rgthree 但移除了所有外部依赖。
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "foreground_image": ("IMAGE",), # 原 image_a
                "background_image": ("IMAGE",), # 原 image_b
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }

    # 虽然没有输出连接，但定义为输出节点以确保执行
    RETURN_TYPES = ()
    OUTPUT_NODE = True
    CATEGORY = "PixNodes"
    FUNCTION = "compare_images"
    
    # 注册名称
    NODE_NAME = "Pix_ImageComparer"
    DISPLAY_NAME = "Image Comparer (PixNodes)"

    def compare_images(self,
                     foreground_image=None,
                     background_image=None,
                     filename_prefix="pix.compare.",
                     prompt=None,
                     extra_pnginfo=None):

        # 构造返回给前端的数据结构
        # 为了兼容前端逻辑，我们依然使用 a_images 和 b_images 作为键名
        # 但数据来源已经变更为新的参数名
        result = { "ui": { "a_images":[], "b_images": [] } }

        # 保存 foreground_image (FG)
        if foreground_image is not None and len(foreground_image) > 0:
            saved_fg = self.save_images(foreground_image, filename_prefix, prompt, extra_pnginfo)
            result['ui']['a_images'] = saved_fg['ui']['images']

        # 保存 background_image (BG)
        if background_image is not None and len(background_image) > 0:
            saved_bg = self.save_images(background_image, filename_prefix, prompt, extra_pnginfo)
            result['ui']['b_images'] = saved_bg['ui']['images']

        return result

# 节点映射
NODE_CLASS_MAPPINGS = {
    "Pix_ImageComparer": ImageComparer
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_ImageComparer": "Image Comparer (PixNodes)"
}