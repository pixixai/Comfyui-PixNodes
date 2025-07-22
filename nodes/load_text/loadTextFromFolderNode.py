import os
import re

class LoadTextFromFolder:
    """
    A node to load text files from a specific directory and select one using an index.
    Supports natural sorting of filenames with Chinese, English, and numbers.
    Outputs: content, file name (without extension), index, total_files.
    Modified version that doesn't require pypinyin library.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "directory": ("STRING", {
                    "default": "/path/to/txt/files",
                    "multiline": False,
                    "lazy": True
                }),
                "start_index": ("INT", {
                    "default": 0,
                    "min": 0,
                    "max": 10000,
                    "step": 1,
                    "display": "number",
                    "lazy": True
                }),
            }
        }

    RETURN_TYPES = ("STRING", "STRING", "INT", "INT")
    RETURN_NAMES = ("content", "file_name", "index", "total_files")
    FUNCTION = "load_text"
    CATEGORY = "pixix"

    def check_lazy_status(self, directory, start_index):
        return ["directory", "start_index"]

    def load_text(self, directory, start_index):
        if not os.path.isdir(directory):
            raise ValueError(f"The provided path is not a valid directory: {directory}")

        # 获取所有 .txt 文件
        all_files = [f for f in os.listdir(directory) if f.endswith(".txt")]

        # 使用改进的自然排序（不依赖pypinyin）
        txt_files = sorted(all_files, key=self._natural_sort_key)

        if not txt_files:
            raise ValueError(f"No .txt files found in directory: {directory}")

        # 确保索引不越界
        index = min(start_index, len(txt_files) - 1)
        selected_file = txt_files[index]
        file_path = os.path.join(directory, selected_file)

        # 去除 .txt 后缀
        file_name = os.path.splitext(selected_file)[0]

        # 读取文件内容
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            raise RuntimeError(f"Failed to read file '{selected_file}': {str(e)}")

        # 返回新增参数：总文件数
        total_files = len(txt_files)

        return (content, file_name, index, total_files)

    def _natural_sort_key(self, s):
        """
        改进的自然排序键函数，不依赖pypinyin
        处理数字和中文混合文件名（中文按unicode排序）
        """
        def convert(text):
            if text.isdigit():
                return int(text)
            return text.lower()

        return [convert(c) for c in re.split('([0-9]+)', s)]

    def _debug_print_sorted_files(self, files):
        print("Sorted Files:")
        for i, f in enumerate(files):
            print(f"{i}: {f}")

NODE_CLASS_MAPPINGS = {
    "LoadTextFromFolderNode": LoadTextFromFolder,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "LoadTextFromFolderNode": "从文件夹加载文本",
}