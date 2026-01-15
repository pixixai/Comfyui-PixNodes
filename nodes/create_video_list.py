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
                "video_data": ("STRING", {"default": "[]"}),
            },
        }

    # 输出 VIDEO 类型 (如果支持)
    RETURN_TYPES = (("VIDEO", "STRING") if HAS_COMFY_API else ("STRING", "STRING"))
    
    # [修改] 输出名称更改为 video_list
    RETURN_NAMES = ("video_list", "video_paths_json")
    
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
            
            video_path = folder_paths.get_annotated_filepath(filename, subfolder)
            
            if video_path and os.path.exists(video_path):
                path_list.append(video_path)
            else:
                print(f"[PixNodes] Warning: Video file not found: {filename}")

        print(f"--- [PixNodes Debug] ---")
        print(f"Processing {len(path_list)} videos.")

        # 生成 JSON 路径列表字符串
        json_output = json.dumps(path_list)

        if not path_list:
            return ([], json_output)

        if HAS_COMFY_API:
            # 封装为官方 Video 对象
            video_objects = [InputImpl.VideoFromFile(p) for p in path_list]
            return (video_objects, json_output)
        else:
            # 回退模式
            return (path_list, json_output)

NODE_CLASS_MAPPINGS = {
    "Pix_CreateVideoList": VideoList
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_CreateVideoList": "Create Video List (PixNodes)"
}