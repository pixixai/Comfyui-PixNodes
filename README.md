# ComfyUI PixNodes

JSON处理、视频列表、图像批次、图像处理、循环、翻译、LLM、文本、逻辑

## 详细说明文档导航

[拾色器节点](web/docs/Pix_ColorPicker.md)

[创建图像批次](web/docs/Pix_CreateImageBatch.md)

[创建空列表](web/docs/Pix_CreateEmptyList.md)

[图像裁边](web/docs/Pix_ImageCropEdge.md)

[图像对比](web/docs/Pix_ImageComparer.md)

[图像列表转批次](web/docs/Pix_ImageListToBatch.md)

[图像切分](web/docs/Pix_ImageSplitter.md)

[组合图像批次](web/docs/Pix_ImageBatchCompose.md)

### 逻辑

[逻辑比较器](web/docs/Pix_Compare.md)

[是否空值](web/docs/Pix_AnyDataIsEmpty.md)

[整数运算器](web/docs/Pix_MathInt.md)

[IfElse 分发器](web/docs/Pix_IfElseDispatcher.md)

[IfElse 逻辑阀](web/docs/Pix_IfElseLogicGate.md)

### 文本

[从文件夹加载文本](web/docs/Pix_LoadTextFromFolderNode.md)

[通用 Unicode 解码器](web/docs/Pix_UniversalUnicodeDecoder.md)


### 视频

[创建视频列表](web/docs/Pix_CreateVideoList.md)

[从路径列表获取视频](web/docs/Pix_GetVideoFromPathList.md)

[从视频列表获取视频](web/docs/Pix_GetVideoFromVideoList.md)

### JSON

[创建 JSON 对象](web/docs/Pix_CreateJsonObject.md)

[创建 JSON 列表](web/docs/Pix_CreateJsonList.md)

[JSON 对象合并](web/docs/Pix_JsonObjectCombine.md)

[连接到 JSON 列表](web/docs/Pix_JsonListJoin.md)

[连接到JSON对象](web/docs/Pix_JsonObjectJoin.md)

[JSON 对象提取](web/docs/Pix_JsonObjectExtract.md)

[JSON 解包](web/docs/Pix_JsonUnpacker.md)

[JSON 列表同步合并](web/docs/Pix_JsonListMerger.md)

[JSON列表摘取](web/docs/Pix_JsonListPluck.md)

[JSON切片工具](web/docs/Pix_JSONSlicer.md)

### LLM

[Kimi 助手](web/docs/Pix_KimiApiNode.md)

[通义千问API](web/docs/Pix_QwenApiNode.md)

[DeepSeek 助手](web/docs/Pix_DeepSeekApiNode.md)

[豆包助手](web/docs/Pix_DoubaoApiNode.md)

### 循环

[for循环结束](web/docs/Pix_ForLoopEnd.md)

[for循环开始](web/docs/Pix_ForLoopStart.md)

[从循环获取列表](web/docs/Pix_ListFromLoop.md)

[web/docs/Pix_WhileLoopEnd.md.md (File Not Found)](web/docs/Pix_WhileLoopEnd.md.md)

[While 循环开始](web/docs/Pix_WhileLoopStart.md)

# 翻译

[百度翻译](web/docs/Pix_BaiduTranslateNode.md)

[ChatGLM4 翻译](web/docs/Pix_ChatGLM4Translate.md)


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
