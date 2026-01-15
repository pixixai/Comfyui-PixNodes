class GetVideoFromVideoList:
    """
    PixNodes: Get Video From Video List
    从输入的视频列表(VIDEO对象列表)中，根据索引选择一个视频输出。
    这是一个纯逻辑节点，不包含前端预览功能。
    """
    
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                # 接收 VIDEO 类型的列表输入
                "video_list": ("VIDEO",),
                "index": ("INT", {"default": 0, "min": 0, "max": 999999, "step": 1, "display": "number"}),
            }
        }

    # 启用列表输入：这意味着 video_list 接收到的将是一个包含所有上游数据的列表
    INPUT_IS_LIST = True

    # 输出定义
    RETURN_TYPES = ("VIDEO", "INT", "INT")
    RETURN_NAMES = ("video", "index", "total")
    
    FUNCTION = "get_video"
    CATEGORY = "PixNodes/video"
    
    # 既然不需要预览，是否设置为 OUTPUT_NODE 取决于你是否希望它是工作流的终点。
    # 通常作为中间处理节点，设为 False 即可；如果为了方便调试看 index，可以设为 True。
    # 这里设为 True 以便它总是执行。
    OUTPUT_NODE = True

    def get_video(self, video_list, index):
        # 1. 处理 index 参数
        # 当 INPUT_IS_LIST=True 时，所有输入（包括 int）都会变成列表
        # 如果 index 也是通过连线输入的，它本身就是列表；如果是控件输入的，ComfyUI 可能会将其包装为单元素列表
        current_index = 0
        if isinstance(index, list):
            if len(index) > 0:
                current_index = index[0]
        else:
            current_index = index

        # 2. 处理 video_list 并进行扁平化 (Flatten)
        # 上游可能传来单个列表，也可能有多个节点连接导致嵌套列表 [[v1, v2], [v3]]
        valid_videos = []
        
        if video_list is None:
            # 防御性编程
            pass
        elif isinstance(video_list, list):
            for item in video_list:
                if isinstance(item, list):
                    # 展平嵌套列表
                    valid_videos.extend([v for v in item if v is not None])
                elif item is not None:
                    valid_videos.append(item)
        else:
            # 如果不是列表（极少见情况），直接添加
            valid_videos.append(video_list)

        # 3. 检查是否有有效视频
        total = len(valid_videos)
        if total == 0:
            print("PixNodes_GetVideoFromVideoList: Warning - No videos found in input list.")
            # 返回 None 可能会导致下游节点报错，但在没有数据时也没办法
            return (None, 0, 0)

        # 4. 计算索引 (循环取模)
        valid_index = current_index % total
        selected_video = valid_videos[valid_index]

        # 5. 返回结果
        # 注意：这里不再返回 "ui" 字典，因为不需要前端预览
        return (selected_video, valid_index, total)

# 节点注册映射
NODE_CLASS_MAPPINGS = {
    "Pix_GetVideoFromVideoList": GetVideoFromVideoList
}

# 节点显示名称映射
NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_GetVideoFromVideoList": "Get Video From Video List (PixNodes)"
}