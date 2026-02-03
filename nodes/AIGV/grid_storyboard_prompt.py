import json

class GridStoryboardPrompt:
    """
    根据分镜设计、主体、场景和风格数据，生成用于 AI 绘图的结构化网格分镜提示词。
    支持 JSON 数组及纯文本输入。
    """
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "style": ("STRING", {"multiline": True, "default": ""}),
                "scene": ("STRING", {"multiline": True, "default": ""}),
                "subject": ("STRING", {"multiline": True, "default": ""}),
                "shots": ("STRING", {"multiline": True, "default": ""}),
                "grid": (["2x2", "3x3", "4x4"], {"default": "2x2"}),
                "ratio": (["21:9", "16:9", "3:2", "4:3", "1:1", "3:4", "2:3", "9:16", "9:21"], {"default": "16:9"}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("prompt",)
    FUNCTION = "generate_prompt"
    CATEGORY = "PixNodes/AIGV"

    def parse_input_data(self, input_str, key_name):
        """
        解析输入数据逻辑：
        1. 尝试解析为 JSON。
        2. 若为非 JSON 字符串，则返回原始文本。
        """
        clean_input = input_str.strip()
        if not clean_input:
            return []
        
        try:
            data = json.loads(clean_input)
            
            if isinstance(data, dict):
                first_key = list(data.keys())[0]
                data = data[first_key]

            if not isinstance(data, list):
                return [str(data)]

            result = []
            for item in data:
                if isinstance(item, dict):
                    val = item.get(key_name, "")
                    if not val and len(item) > 0:
                        val = list(item.values())[0]
                    result.append(str(val))
                else:
                    result.append(str(item))
            return result
            
        except (json.JSONDecodeError, TypeError):
            return [clean_input]

    def get_position_name(self, index, grid_type):
        """根据网格索引返回对应的方位中文名称"""
        if grid_type == "2x2":
            pos_map = ["左上", "右上", "左下", "右下"]
            return pos_map[index] if index < len(pos_map) else f"位置 {index+1}"
        
        row_size = int(grid_type[0])
        row = index // row_size + 1
        col = index % row_size + 1
        return f"第 {row} 行，第 {col} 列"

    def generate_prompt(self, style, scene, subject, shots, grid, ratio):
        # 数据解析
        style_list = self.parse_input_data(style, "content")
        scene_list = self.parse_input_data(scene, "content")
        subject_list = self.parse_input_data(subject, "content")
        shot_list = self.parse_input_data(shots, "prompt")

        # 网格参数
        grid_rows = int(grid.split('x')[0])
        grid_cols = int(grid.split('x')[1])
        total_panels = grid_rows * grid_cols
        
        # 1. 头部统一指令
        header = f"{grid} 网格布局构图（单张图像内包含 {total_panels} 个等大的分镜面板），总宽高比为 {ratio}。"
        header += "每个面板必须描绘同一组创意设计中的不同连续瞬间或视角。请确保所有面板在视觉艺术风格、灯光环境、角色外观特征、背景细节和调色方案上保持高度的一致性，以实现完美的叙事连贯性。"

        sections = [header]

        # 2. 风格板块
        if style_list:
            styles_str = "，".join(style_list)
            sections.append(f"整体美学画风描述（所有面板保持一致）：\n{styles_str}")

        # 3. 分镜板块
        if shot_list:
            panel_lines = ["面板分镜描述（作为一个整体图像阅读）："]
            for i in range(min(len(shot_list), total_panels)):
                pos = self.get_position_name(i, grid)
                panel_lines.append(f"分镜 {i+1} ({pos})：{shot_list[i]}")
            sections.append("\n".join(panel_lines))

        # 4. 主体板块
        if subject_list:
            subject_lines = ["主体/角色细节规范（根据分镜内容使用对应的主体）："]
            for i, sub in enumerate(subject_list):
                subject_lines.append(f"主体 {i+1}：{sub}")
            sections.append("\n".join(subject_lines))

        # 5. 场景板块
        if scene_list:
            scene_lines = ["环境与灯光细节规范（根据分镜内容使用对应的环境）："]
            for i, sc in enumerate(scene_list):
                scene_lines.append(f"环境 {i+1}：{sc}")
            sections.append("\n".join(scene_lines))

        # 段落间距控制
        final_prompt = "\n\n".join(sections)
        
        return (final_prompt,)

NODE_CLASS_MAPPINGS = {
    "Pix_GridStoryboardPrompt": GridStoryboardPrompt
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_GridStoryboardPrompt": "🎞️ Grid Storyboard Prompt"
}