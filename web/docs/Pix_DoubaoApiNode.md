# 豆包助手

## 1. 节点功能概览

`Pix_DoubaoApiNode` 是 PixNodes 系列中的多模态 LLM 接口节点。它集成了字节跳动火山市（火山方舟）的豆包 API，除了提供常规的文本生成能力外，还特别支持**视觉理解（Vision）**功能。该节点通过统一的 API 密钥管理机制，确保了密钥的持久化存储与安全性。

API 自动化：输入 API Key 并运行一次后，该 Key 会自动同步到 `ComfyUI/user/PixNodes/api_key.json`。后续运行可留空，系统将自动读取已保存的密钥。

## 2. 输入参数解释

| 参数名称 | 类型 | 建议值 | 描述 |
| --- | --- | --- | --- |
| **api_key** | STRING | (火山方舟 API Key) | 字节跳动火山方舟平台的 API 密钥。 |
| **base_url** | STRING | (火山方舟 Endpoint) | 默认为火山方舟标准地址，如使用自定义接入点请修改。 |
| **model** | 菜单 | flash / 1.8 / vision | `flash` 速度极快；`1.8` 能力最强；`vision` 版本支持图像输入。 |
| **prompt** | STRING | (多行文本) | 用户输入的指令。支持动态提示词（Dynamic Prompts）。 |
| **images** | IMAGE (输入) | (可选连接) | **核心功能**：连接图像 Tensor 后，AI 即可对图像内容进行识别与分析（需选择 vision 模型）。 |
| **input_file_text** | STRING (输入) | (可选连接) | 外部读入的长文本上下文，自动附加在 Prompt 末尾。 |

## 3. 输出结果描述

| 索引 | 名称 | 类型 | 描述 |
| --- | --- | --- | --- |
| **0** | text_response | STRING | AI 的文本回答，包含图像分析结果或文本回复。 |
| **1** | history | STRING | 对话上下文的 JSON 序列，用于构建多轮对话流。 |

## 4. 典型工作流场景

- **视觉问答 (VQA)**: 连接 `Load Image` 节点到 `images` 输入端，使用 `doubao-seed-1-6-vision` 模型，让 AI 描述图片细节、识别文字或分析构图。
- **图像 Prompt 反推**: 输入一张参考图，让豆包助手生成符合该图特征的 Stable Diffusion 风格提示词。
- **代码/文档处理**: 使用 `code-preview` 模型进行代码审查，或配合文本加载节点处理超长技术文档。