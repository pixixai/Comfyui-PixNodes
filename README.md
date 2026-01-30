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

# 翻译

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