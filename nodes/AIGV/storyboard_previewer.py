import torch
import os
import json
import hashlib
import shutil
import numpy as np
from PIL import Image
import folder_paths

class StoryboardPreviewer:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {},
            "optional": {
                "image_batch": ("IMAGE",),
                # 修改：添加 {"forceInput": True}，强制让 STRING 类型显示为连接端口
                "video_paths_list": ("STRING", {"forceInput": True}), 
                # 修改点 3: 进一步放宽类型，增加 LIST 支持，确保能接收来自 List 节点的输入
                "shot_content_json": ("STRING,JSON,DICT,LIST", {"forceInput": True}), 
            },
            "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO"},
        }

    RETURN_TYPES = ()
    OUTPUT_NODE = True
    INPUT_IS_LIST = True
    FUNCTION = "preview_storyboard"
    CATEGORY = "PixNodes/AIGV"

    def prepare_video_preview(self, video_item):
        """
        将视频路径处理为前端可访问的 temp 文件信息
        """
        video_path = None
        
        # 1. 解析路径
        if isinstance(video_item, str):
            video_path = video_item
        elif isinstance(video_item, dict):
            if 'path' in video_item: 
                video_path = video_item['path']
            elif 'video_path' in video_item:
                video_path = video_item['video_path']
            elif 'filename' in video_item:
                fn = video_item['filename']
                sub = video_item.get('subfolder', '')
                video_path = folder_paths.get_annotated_filepath(fn, sub)
                if not video_path:
                    video_path = os.path.join(folder_paths.get_input_directory(), sub, fn)
        elif hasattr(video_item, 'path'): 
            video_path = video_item.path
        else:
            video_path = str(video_item)

        if not video_path:
            return None

        # 清理路径引号
        video_path = video_path.strip().strip('"').strip("'")

        # 检查文件是否存在
        if not os.path.exists(video_path):
            # 尝试查找相对路径
            potential_path = folder_paths.get_annotated_filepath(video_path)
            if potential_path and os.path.exists(potential_path):
                video_path = potential_path
            else:
                return None

        # 2. 准备 Temp 目录的目标路径
        video_name = os.path.basename(video_path)
        path_hash = hashlib.md5(video_path.encode('utf-8')).hexdigest()[:8]
        preview_filename = f"sb_preview_{path_hash}_{video_name}"
        
        output_dir = folder_paths.get_temp_directory()
        preview_path = os.path.join(output_dir, preview_filename)

        # 3. 创建链接或复制
        if not os.path.exists(preview_path):
            try:
                if hasattr(os, 'link'):
                    try:
                        os.link(video_path, preview_path)
                    except OSError:
                        shutil.copy2(video_path, preview_path)
                else:
                    shutil.copy2(video_path, preview_path)
            except Exception as e:
                print(f"[StoryboardPreviewer] Failed to link/copy video: {e}")
                return None

        # 4. 返回前端可用的结构
        return {
            "filename": preview_filename,
            "type": "temp",
            "subfolder": "",
        }

    # 修改：参数名从 video_list 更新为 video_paths_list
    def preview_storyboard(self, image_batch=None, video_paths_list=None, shot_content_json=None, prompt=None, extra_pnginfo=None):
        # 1. 处理图像
        saved_images = []
        if image_batch:
            output_dir = folder_paths.get_temp_directory()
            filename_prefix = "sb_preview"
            img_count = 0
            for batch_tensor in image_batch:
                for i in range(batch_tensor.shape[0]):
                    img_tensor = batch_tensor[i]
                    img_np = img_tensor.cpu().numpy()
                    img = Image.fromarray(np.clip(img_np * 255.0, 0, 255).astype(np.uint8))
                    
                    img_hash = hashlib.md5(img.tobytes()).hexdigest()[:8]
                    file_name = f"{filename_prefix}_{img_count}_{img_hash}.png"
                    full_path = os.path.join(output_dir, file_name)
                    
                    if not os.path.exists(full_path):
                        img.save(full_path, compress_level=4)
                    
                    saved_images.append({
                        "filename": file_name,
                        "subfolder": "",
                        "type": "temp"
                    })
                    img_count += 1

        # 2. 处理视频
        processed_videos = []
        # 修改：使用新的参数名 video_paths_list
        if video_paths_list:
            # 展平列表，处理 JSON 字符串数组
            flat_video_list = []
            for item in video_paths_list:
                if isinstance(item, str):
                    s_item = item.strip()
                    if s_item.startswith("[") and s_item.endswith("]"):
                        try:
                            loaded = json.loads(s_item)
                            if isinstance(loaded, list):
                                flat_video_list.extend(loaded)
                                continue
                        except:
                            pass
                flat_video_list.append(item)

            for item in flat_video_list:
                if item is None or item == "": 
                    processed_videos.append(None)
                    continue
                    
                preview_info = self.prepare_video_preview(item)
                if preview_info:
                    processed_videos.append(preview_info)
                else:
                    processed_videos.append(None)

        # 3. 处理 JSON 内容
        final_json_objects = []
        if shot_content_json:
            # 由于 INPUT_IS_LIST = True，shot_content_json 是一个列表（batch）
            for item in shot_content_json:
                data = None
                
                # 尝试解析字符串
                if isinstance(item, str):
                    try:
                        data = json.loads(item)
                    except:
                        data = item # 如果不是合法 JSON，就按原样字符串处理
                else:
                    data = item
                
                # 修改点 3 (续): 增强对嵌套列表的兼容性
                # 如果解析后得到的是列表（比如来自一个输出 LIST 的节点，或者 JSON 数组字符串），则展开它
                if isinstance(data, list):
                    final_json_objects.extend(data)
                else:
                    final_json_objects.append(data)

        # 4. 确定数量
        target_len = 0
        if len(saved_images) > 0:
            target_len = len(saved_images)
        elif len(processed_videos) > 0:
            target_len = len(processed_videos)
        elif len(final_json_objects) > 0:
            target_len = len(final_json_objects)
        
        ui_results = []
        for i in range(target_len):
            card_data = {}
            
            if i < len(saved_images):
                card_data["image"] = saved_images[i]
            
            if i < len(processed_videos) and processed_videos[i] is not None:
                card_data["video"] = processed_videos[i]
            
            card_data["metadata"] = []
            if i < len(final_json_objects):
                obj = final_json_objects[i]
                
                if isinstance(obj, dict):
                    for k, v in obj.items():
                         card_data["metadata"].append({"label": k, "value": str(v)})
                else:
                    card_data["metadata"].append({"label": None, "value": str(obj)})

            ui_results.append(card_data)

        return {"ui": {"storyboard_data": ui_results}}

NODE_CLASS_MAPPINGS = {
    "Pix_StoryboardPreviewer": StoryboardPreviewer
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_StoryboardPreviewer": "Storyboard Previewer"
}