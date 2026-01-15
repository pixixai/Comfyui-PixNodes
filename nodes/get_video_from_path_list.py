import json
import os
import shutil
import hashlib
import folder_paths
import re # [新增] 用于强大的字符串分割

# 尝试导入新 API
try:
    from comfy_api.latest import InputImpl
    NEW_API_AVAILABLE = True
except ImportError:
    NEW_API_AVAILABLE = False
    print("PixNodes Warning: 'comfy_api.latest' not found. Video output requires ComfyUI V0.3+.")

# 仅用于获取预览帧率 (Metadata)，不用于解码数据
try:
    import cv2
    OPENCV_AVAILABLE = True
except ImportError:
    OPENCV_AVAILABLE = False

class GetVideoFromPathList:
    """
    解析视频路径列表，支持 ComfyUI 新 API (Video Object) 输出。
    支持格式：
    1. JSON 数组: ["path1", "path2"]
    2. 混合分隔字符串: 支持换行、逗号分隔
    3. Windows 复制路径: 自动去除 "C:\\Path\\To.mp4" 的引号
    """
    
    def __init__(self):
        self.output_dir = folder_paths.get_temp_directory()
        self.type = "temp"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "video_paths_json": ("STRING", {"forceInput": True}),
                "index": ("INT", {"default": 0, "min": 0, "max": 999999, "step": 1, "display": "number"}),
            }
        }

    # 第一个输出类型明确为 "VIDEO"，直接兼容官方新节点
    RETURN_TYPES = ("VIDEO", "STRING", "STRING", "INT", "INT")
    RETURN_NAMES = ("video", "video_path", "name", "index", "total")
    
    FUNCTION = "get_video"
    CATEGORY = "PixNodes/video"
    OUTPUT_NODE = True

    def get_video(self, video_paths_json, index):
        # --- 0. 参数容错处理 (修复空字符串报错) ---
        # 如果 index 是空字符串或其他非数字类型，强制设为 0
        try:
            if index == "" or index is None:
                index = 0
            else:
                index = int(index)
        except ValueError:
            print(f"PixNodes Warning: Invalid index value '{index}', defaulting to 0.")
            index = 0

        # --- 1. 路径解析逻辑 (增强版) ---
        paths = []
        text = video_paths_json.strip()
        
        # A. 尝试 JSON 解析 (最严格)
        try:
            if text.startswith("[") and text.endswith("]"):
                loaded = json.loads(text)
                if isinstance(loaded, list):
                    paths = [str(item) for item in loaded]
        except json.JSONDecodeError:
            pass

        # B. 如果不是 JSON，使用正则处理多种分隔符
        if not paths:
            # 使用正则按 [逗号 或 换行符] 进行分割，过滤掉空项
            # r'[,\n\r]+' 意味着匹配一个或多个连续的逗号、换行或回车
            paths = [x for x in re.split(r'[,\n\r]+', text) if x.strip()]

        # C. 路径清理与去引号 (核心需求)
        clean_paths = []
        for p in paths:
            p = p.strip()
            if not p: continue
            
            # 去除 Windows "复制为路径" 产生的双引号
            if p.startswith('"') and p.endswith('"'):
                p = p[1:-1]
            # 去除可能的单引号
            elif p.startswith("'") and p.endswith("'"):
                p = p[1:-1]
            
            # 再次清理去引号后可能残留的空白
            p = p.strip()
            
            if p:
                clean_paths.append(p)

        if not clean_paths:
            # 错误时返回空
            return {"ui": {"text": ["No paths"]}, "result": (None, "", "", 0, 0)}

        # 计算索引
        total = len(clean_paths)
        valid_index = index % total
        selected_video_path = clean_paths[valid_index]
        video_name = os.path.basename(selected_video_path)

        # --- 2. 前端预览准备 (UI) ---
        # 建立软链接到 temp 目录，供前端 JS 播放器访问
        path_hash = hashlib.md5(selected_video_path.encode('utf-8')).hexdigest()[:8]
        preview_filename = f"pix_preview_{path_hash}_{video_name}"
        preview_path = os.path.join(self.output_dir, preview_filename)

        if not os.path.exists(preview_path):
            try:
                # 优先尝试硬链接，失败则尝试复制
                if hasattr(os, 'link'):
                    try:
                        os.link(selected_video_path, preview_path)
                    except OSError:
                        shutil.copy2(selected_video_path, preview_path)
                else:
                    shutil.copy2(selected_video_path, preview_path)
            except Exception as e:
                pass

        # 获取帧率仅用于 UI 时间码显示
        fps = 30.0
        if OPENCV_AVAILABLE:
            try:
                cap = cv2.VideoCapture(selected_video_path)
                if cap.isOpened():
                    fps = cap.get(cv2.CAP_PROP_FPS)
                cap.release()
            except:
                pass

        ui_data = {
            "video": [{
                "filename": preview_filename,
                "type": self.type,
                "subfolder": "",
                "fps": fps
            }]
        }

        # --- 3. 核心输出逻辑 ---
        # 直接使用官方新 API 创建 VideoFromFile 对象
        video_output = None
        if NEW_API_AVAILABLE:
            video_output = InputImpl.VideoFromFile(selected_video_path)
        else:
            print("PixNodes Error: Cannot create VIDEO object, comfy_api.latest missing.")

        return {
            "ui": ui_data, 
            "result": (video_output, selected_video_path, video_name, valid_index, total)
        }

NODE_CLASS_MAPPINGS = {
    "Pix_GetVideoFromPathList": GetVideoFromPathList
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_GetVideoFromPathList": "Get Video from Path List (PixNodes)"
}