# ComfyUI PixNodes

JSON处理、视频列表、图像批次、图像处理、循环、翻译、LLM、文本、逻辑

## 详细说明文档导航

<!-- INCLUDE:web/docs/Pix_ColorPicker.md -->

<!-- INCLUDE:web/docs/Pix_CreateImageBatch.md -->

<!-- INCLUDE:web/docs/Pix_CreateEmptyList.md -->

<!-- INCLUDE:web/docs/Pix_ImageCropEdge.md -->

<!-- INCLUDE:web/docs/Pix_ImageComparer.md -->

<!-- INCLUDE:web/docs/Pix_ImageListToBatch.md -->

<!-- INCLUDE:web/docs/Pix_ImageSplitter.md -->

<!-- INCLUDE:web/docs/Pix_ImageBatchCompose.md -->

### 逻辑

<!-- INCLUDE:web/docs/Pix_Compare.md -->

<!-- INCLUDE:web/docs/Pix_AnyDataIsEmpty.md -->

<!-- INCLUDE:web/docs/Pix_MathInt.md -->

<!-- INCLUDE:web/docs/Pix_IfElseDispatcher.md -->

<!-- INCLUDE:web/docs/Pix_IfElseLogicGate.md -->

### 文本

<!-- INCLUDE:web/docs/Pix_LoadTextFromFolderNode.md -->

<!-- INCLUDE:web/docs/Pix_UniversalUnicodeDecoder.md -->

### AIGV

<!-- INCLUDE:web/docs/Pix_StoryboardPreviewer.md -->

<!-- INCLUDE:web/docs/Pix_GridStoryboardPrompt.md -->

### 视频

<!-- INCLUDE:web/docs/Pix_CreateVideoList.md -->

<!-- INCLUDE:web/docs/Pix_GetVideoFromPathList.md -->

<!-- INCLUDE:web/docs/Pix_GetVideoFromVideoList.md -->

### JSON

<!-- INCLUDE:web/docs/Pix_CreateJsonObject.md -->

<!-- INCLUDE:web/docs/Pix_CreateJsonList.md -->

<!-- INCLUDE:web/docs/Pix_JsonObjectCombine.md -->

<!-- INCLUDE:web/docs/Pix_JsonListJoin.md -->

<!-- INCLUDE:web/docs/Pix_JsonObjectJoin.md -->

<!-- INCLUDE:web/docs/Pix_JsonObjectExtract.md -->

<!-- INCLUDE:web/docs/Pix_JsonUnpacker.md -->

<!-- INCLUDE:web/docs/Pix_JsonListMerger.md -->

<!-- INCLUDE:web/docs/Pix_JsonListPluck.md -->

<!-- INCLUDE:web/docs/Pix_JSONSlicer.md -->

### LLM

<!-- INCLUDE:web/docs/Pix_KimiApiNode.md -->

<!-- INCLUDE:web/docs/Pix_QwenApiNode.md -->

<!-- INCLUDE:web/docs/Pix_DeepSeekApiNode.md -->

<!-- INCLUDE:web/docs/Pix_DoubaoApiNode.md -->

### 循环

<!-- INCLUDE:web/docs/Pix_ForLoopEnd.md -->

<!-- INCLUDE:web/docs/Pix_ForLoopStart.md -->

<!-- INCLUDE:web/docs/Pix_ListFromLoop.md -->

<!-- INCLUDE:web/docs/Pix_WhileLoopEnd.md.md -->

<!-- INCLUDE:web/docs/Pix_WhileLoopStart.md -->

### 翻译

<!-- INCLUDE:web/docs/Pix_BaiduTranslateNode.md -->

<!-- INCLUDE:web/docs/Pix_ChatGLM4Translate.md -->


## 安装方法

### 方法一：通过 ComfyUI Manager 安装

- 管理器内搜索：PixNodes

### 方法二：手动安装
1. 进入 ComfyUI 自定义节点目录
    ```
    cd ComfyUI/custom_nodes/
    ```
2. 克隆本仓库（确保先安装git）
    ```
    git clone https://github.com/pixixai/ComfyUI-AlignLayout.git
    ```
    或下载 ZIP 并解压到 custom_nodes 文件夹

3. 进入插件文件夹，运行：
    ```
    ..\..\..\python_embeded\python.exe -m pip install -r .\requirements.txt
    ```
4. 重启 ComfyUI


## 📝 更新日志

[1.0.8] - 2026-02-04
- 【创建图像批次】增加自动检测、自动清理黑图。
- 【创建视频列表】增加自动检测、自动清理已删除的视频。增加自动列宽；
- 【预览分镜】修改‘视频路径列表’‘分镜数据’输入端口的数据类型。
- workflows：增加创建视频分镜图的工作流
- 修复：【通用 Unicode 解码器】输入端口类型不匹配的问题
- 修改【创建视频列表 (PixNodes)】输出端口类型：
    - video_batch：video
    - video_paths_json：JSON
- 修改【分镜预览 (PixNodes)】输入端口类型：
    - video_path_list ：STRING,JSON
    - 删除原本对video类型的解析代码。
- 去除【创建 JSON 对象】【创建 JSON 列表】【连接到 JSON 列表】【连接到 JSON 对象】【JSON 切片工具】【合并为JSON对象】【JSON 列表同步合并】输出JSON字符串的端口
- 【JSON 列表摘取】输入端口名称修改为json_list；输出端口的类型修改为JSON
- 【JSON 对象提取】输入端口名称修改为json_object；输出端口的类型修改为JSON
- 新增：【JSON编辑器】【JSON键值拆分】节点

[1.0.7] - 2026-02-03
- 新增【分镜预览】节点
- 新增【网格分镜提示词】节点
- 【创建视频批次】节点输出端口"video_paths_json"修改为"video_paths_list"

[1.0.6] - 2026-01-29
- 增加【图像对比】节点
- README.md自动化脚本

## 🏆 参考项目

- https://github.com/rgthree/rgthree-comfy.git
- https://github.com/yolain/ComfyUI-Easy-Use.git
  

## 🤙 联系方式

如有问题请提交 Issue。

- bilibili：[噼哩画啦](https://space.bilibili.com/1370099549)

- 邮箱：pixixai@gmail.com
  
- 邮箱：pixixai@qq.com