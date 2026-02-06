import json
import folder_paths
import os

# 尝试导入 ComfyUI 新版 API
try:
    from comfy_api.latest import InputImpl
    HAS_COMFY_API = True
except ImportError:
    HAS_COMFY_API = False
    print("\033[93m[PixNodes] Warning: comfy_api not found. Node will output STRING paths instead of VIDEO objects.\033[0m")

class VideoList:
    """
    一个用于管理视频文件列表的节点。
    它接收前端的视频数据，将其封装为 ComfyUI 官方的 'VIDEO' 对象列表并输出。
    """
    
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                # 原有的 video_data 已移动到 hidden，保持 required 为空或添加其他必要参数
            },
            "hidden": {
                # [修改] 移动到 hidden，专门用于接收前端 JSON
                "video_data": ("STRING", {"default": "[]"}),
            },
        }

    # 输出 VIDEO 类型 (如果支持)
    # [修改] 强制 video_list 为 VIDEO 类型，video_paths_list 为 JSON 类型
    RETURN_TYPES = ("VIDEO", "JSON")
    
    # 输出名称 [修改]: video_paths_json -> video_paths_list
    RETURN_NAMES = ("video_list", "video_paths_list")
    
    # 开启批处理，自动拆分列表
    # (True, False) 表示第一个输出(video_list)会被拆分，第二个输出(json)不会被拆分
    OUTPUT_IS_LIST = (True, False)
    
    FUNCTION = "get_video_paths"
    CATEGORY = "PixNodes/video"

    def get_video_paths(self, video_data):
        try:
            video_list_info = json.loads(video_data)
        except Exception as e:
            print(f"[PixNodes] JSON Parse Error: {e}")
            video_list_info = []

        path_list = []
        for vid_info in video_list_info:
            filename = vid_info.get("filename")
            subfolder = vid_info.get("subfolder", "")
            if subfolder == "": subfolder = None
            
            # [核心修复]：组合子文件夹路径
            # 这里会自动读取 JS 传过来的 "pix-videos" 子文件夹
            if subfolder:
                full_path_check = os.path.join(subfolder, filename)
            else:
                full_path_check = filename
                
            # 优先使用 ComfyUI 的标准路径解析
            video_path = folder_paths.get_annotated_filepath(full_path_check)
            
            # 兜底：如果 get_annotated_filepath 没找到，尝试手动检查
            # 这可以防止 ComfyUI 核心路径逻辑无法解析特定子文件夹层级的情况
            if video_path is None or not os.path.exists(video_path):
                input_dir = folder_paths.get_input_directory()
                manual_path = os.path.join(input_dir, full_path_check)
                if os.path.exists(manual_path):
                    video_path = manual_path

            if video_path and os.path.exists(video_path):
                path_list.append(video_path)
            else:
                print(f"[PixNodes] Warning: Video file not found: {filename} (Subfolder: {subfolder})")

        print(f"--- [PixNodes Debug] ---")
        print(f"Processing {len(path_list)} videos.")

        # 生成 JSON 路径列表字符串
        # [注意] 虽然这里生成了字符串，但根据 JSON 类型的通常用法，我们返回原始列表对象 path_list
        # 如果需要调试打印，可以使用 json_output
        json_output = json.dumps(path_list)

        if not path_list:
            # [修改] 第二个返回值改为 path_list (空列表对象) 以匹配 JSON 类型
            return ([], path_list)

        if HAS_COMFY_API:
            # 封装为官方 Video 对象
            video_objects = [InputImpl.VideoFromFile(p) for p in path_list]
            # [修改] 第二个返回值改为 path_list (列表对象) 以匹配 JSON 类型
            return (video_objects, path_list)
        else:
            # 回退模式
            # [修改] 即使没有 API，也按照 RETURN_TYPES 返回 path_list 对象给 JSON 端口
            return (path_list, path_list)

NODE_CLASS_MAPPINGS = {
    "Pix_CreateVideoList": VideoList
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_CreateVideoList": "Create Video List (PixNodes)"
}