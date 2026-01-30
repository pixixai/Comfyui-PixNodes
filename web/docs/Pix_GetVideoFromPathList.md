# 从路径列表获取视频

此节点用于从给定的视频文件路径列表中选择视频。它实现了 ComfyUI 最新的 **VIDEO** 接口标准，生成的视频对象是“零拷贝”的（仅传递引用），因此极其高效，内存占用极低。

## 基本信息

- **分类**：`PixNodes/video`
- **节点名**：`Pix_GetVideoFromPathList`

## 功能特性

- **新一代 API 支持**：直接输出官方 `VIDEO` 类型对象，完美兼容 `Get Video Components`, `Save Video` 等官方新节点。
- **灵活的路径解析**：支持 JSON 数组、换行分隔、逗号分隔等多种路径格式。
- **循环索引**：内置循环逻辑 (`index % total`)，方便批量处理。
- **内置预览**：节点下方自带视频播放器，支持鼠标悬停播放、滑动预览和精确时间码显示。

## 输入参数 (Inputs)

| 参数名 | 类型 | 描述 |
| --- | --- | --- |
| **video_paths_json** | `STRING` (强制输入) | 包含视频绝对路径的字符串。 |
| **index** | `INT` | 要获取的视频索引。支持自动循环。 |

## 输出 (Outputs)

| 索引 | 名称 | 类型 | 描述 |
| --- | --- | --- | --- |
| **0** | **video** | `VIDEO` | **官方新版视频对象**。包含视频文件的引用信息，不占用显存。如果需要图像帧 (`IMAGE`)，请连接到官方的 `Get Video Components` 节点进行提取。 |
| **1** | **video_path** | `STRING` | 视频文件的绝对路径。 |
| **2** | **name** | `STRING` | 视频文件名。 |
| **3** | **index** | `INT` | 当前索引。 |
| **4** | **total** | `INT` | 视频总数。 |

## 使用示例

1. **连接官方新节点**：
    - `Pix_GetVideoFromPathList` -> **video** -> `Get Video Components` (提取帧/音频)
    - `Pix_GetVideoFromPathList` -> **video** -> `Save Video` (直接转存)
2. **连接传统节点**：
    - `Pix_GetVideoFromPathList` -> **video_path** -> `VHS_LoadVideoPath` (使用 VHS 加载)

**注意**：此节点依赖 ComfyUI 新版 API (`comfy_api.latest`)。请确保你的 ComfyUI 是较新的版本。