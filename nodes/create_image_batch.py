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
                # 这是一个关键字段，用于存储前端的图像列表状态
                "image_data": ("STRING", {"default": "[]"}), 
            }
        }

    RETURN_TYPES = ("IMAGE", "IMAGE")
    RETURN_NAMES = ("image_batch", "image_list")
    OUTPUT_IS_LIST = (False, True)
    
    FUNCTION = "create_batch"
    CATEGORY = "PixNodes"
    
    def create_batch(self, batch_width, batch_height, method, bg_color, image_data):
        # 1. 解析前端传递的 JSON 数据
        try:
            image_list_data = json.loads(image_data)
        except Exception:
            print(f"CreateImageBatch: 无法解析图像数据: {image_data}")
            image_list_data = []

        # 2. 如果没有图像，返回空
        if not image_list_data:
            empty_tensor = torch.zeros((1, batch_height, batch_width, 3), dtype=torch.float32)
            # [修改] 返回 [empty_tensor] 而不是 []，防止 PreviewImage 报错
            return (empty_tensor, [empty_tensor])

        # 3. 解析背景颜色
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

        # 4. 遍历处理图像
        for img_info in image_list_data:
            filename = img_info.get("filename")
            subfolder = img_info.get("subfolder", "")
            img_type = img_info.get("type", "input")
            
            # [核心逻辑]：组合子文件夹路径
            # 这里会自动读取 JS 传过来的 "pix-images" 子文件夹
            if subfolder:
                full_path = os.path.join(subfolder, filename)
            else:
                full_path = filename
            
            # 使用 full_path 获取文件路径
            image_path = folder_paths.get_annotated_filepath(full_path)
            
            # 双重保险：如果 get_annotated_filepath 没找到，尝试手动拼接 input 目录
            if image_path is None or not os.path.exists(image_path):
                input_dir = folder_paths.get_input_directory()
                image_path = os.path.join(input_dir, full_path)

            if not os.path.exists(image_path):
                print(f"CreateImageBatch: 警告，找不到文件 {full_path}")
                continue

            # 加载并处理图像
            try:
                i = Image.open(image_path)
                i = ImageOps.exif_transpose(i)
                
                if i.mode != 'RGB':
                    i = i.convert('RGB')

                # --- image_list: 保留原图 ---
                img_np_orig = np.array(i).astype(np.float32) / 255.0
                img_tensor_orig = torch.from_numpy(img_np_orig).unsqueeze(0) 
                original_tensor_list.append(img_tensor_orig)

                # --- image_batch: 根据 method 调整大小 ---
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
                    
                else: # fit
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
            except Exception as e:
                print(f"CreateImageBatch: 处理图片出错 {filename}: {e}")
                continue

        if not output_tensors:
             # 如果所有图片都加载失败，返回全黑图
             empty_tensor = torch.zeros((1, batch_height, batch_width, 3), dtype=torch.float32)
             # [修复] 第二个参数返回 [empty_tensor] 而不是 []，避免下游 PreviewImage 报错
             return (empty_tensor, [empty_tensor])

        batch_tensor = torch.stack(output_tensors, dim=0)
        
        return (batch_tensor, original_tensor_list)

NODE_CLASS_MAPPINGS = {
    "Pix_CreateImageBatch": CreateImageBatch
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_CreateImageBatch": "Create Image Batch (PixNodes)"
}