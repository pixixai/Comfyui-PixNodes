import torch
import numpy as np
from PIL import Image, ImageOps, ImageColor
import folder_paths
import os
import json

class CreateImageBatch:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "batch_width": ("INT", {"default": 1080, "min": 64, "max": 4096, "step": 8}),
                "batch_height": ("INT", {"default": 1080, "min": 64, "max": 4096, "step": 8}),
                "method": (["fill", "fit", "stretch"], ), 
                "bg_color": ("STRING", {"default": "#000000", "multiline": False}),
            },
            "hidden": {
                "image_data": ("STRING", {"default": "[]"}), # 接收前端传递的 JSON 字符串
            }
        }

    # 输出定义
    RETURN_TYPES = ("IMAGE", "IMAGE")
    RETURN_NAMES = ("image_batch", "image_list")
    
    # 定义输出是否为列表：False代表Batch(单个Tensor)，True代表List(Tensor列表)
    OUTPUT_IS_LIST = (False, True)
    
    FUNCTION = "create_batch"
    CATEGORY = "PixNodes"
    
    def create_batch(self, batch_width, batch_height, method, bg_color, image_data):
        try:
            image_list_data = json.loads(image_data)
        except Exception:
            image_list_data = []

        if not image_list_data:
            empty_tensor = torch.zeros((1, batch_height, batch_width, 3), dtype=torch.float32)
            # 如果是列表输出，空的时候也应该返回空列表
            return (empty_tensor, [])

        # 解析背景颜色
        try:
            if bg_color.startswith("#"):
                color = ImageColor.getrgb(bg_color)
            else:
                color = tuple(map(int, bg_color.replace(" ", "").split(",")))
        except:
            print(f"CreateImageBatch: 颜色解析失败 '{bg_color}'，使用黑色。")
            color = (0, 0, 0)

        output_tensors = []
        original_tensor_list = [] 

        for img_info in image_list_data:
            filename = img_info.get("filename")
            subfolder = img_info.get("subfolder", "")
            img_type = img_info.get("type", "input")
            
            image_path = folder_paths.get_annotated_filepath(filename)
            
            if not os.path.exists(image_path):
                print(f"CreateImageBatch: 警告，找不到文件 {image_path}")
                continue

            # 加载图像
            i = Image.open(image_path)
            i = ImageOps.exif_transpose(i)
            
            # 统一转换为 RGB
            if i.mode != 'RGB':
                i = i.convert('RGB')

            # --- image_list: 保留原图 (转 Tensor) ---
            # 转为 [1, H, W, C] 的 Tensor
            img_np_orig = np.array(i).astype(np.float32) / 255.0
            img_tensor_orig = torch.from_numpy(img_np_orig).unsqueeze(0) 
            original_tensor_list.append(img_tensor_orig)

            # --- image_batch: 根据 method 处理 ---
            w, h = i.size

            if method == "stretch":
                final_img = i.resize((batch_width, batch_height), Image.LANCZOS)
                
            elif method == "fill":
                ratio = max(batch_width / w, batch_height / h)
                new_w = int(w * ratio)
                new_h = int(h * ratio)
                resized_img = i.resize((new_w, new_h), Image.LANCZOS)
                
                left = (new_w - batch_width) // 2
                top = (new_h - batch_height) // 2
                final_img = resized_img.crop((left, top, left + batch_width, top + batch_height))
                
            else: 
                # fit
                ratio = min(batch_width / w, batch_height / h)
                new_w = int(w * ratio)
                new_h = int(h * ratio)
                resized_img = i.resize((new_w, new_h), Image.LANCZOS)
                
                final_img = Image.new("RGB", (batch_width, batch_height), color)
                paste_x = (batch_width - new_w) // 2
                paste_y = (batch_height - new_h) // 2
                final_img.paste(resized_img, (paste_x, paste_y))
            
            image_np = np.array(final_img).astype(np.float32) / 255.0
            image_tensor = torch.from_numpy(image_np)
            output_tensors.append(image_tensor)

        if not output_tensors:
             empty_tensor = torch.zeros((1, batch_height, batch_width, 3), dtype=torch.float32)
             return (empty_tensor, [])

        batch_tensor = torch.stack(output_tensors, dim=0)
        
        return (batch_tensor, original_tensor_list)

# 节点注册映射
NODE_CLASS_MAPPINGS = {
    "Pix_CreateImageBatch": CreateImageBatch
}

# 节点显示名称映射
NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_CreateImageBatch": "Create Image Batch (PixNodes)"
}