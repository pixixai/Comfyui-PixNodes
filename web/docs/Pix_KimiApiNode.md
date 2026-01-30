# Kimi 助手

## 1. 节点功能概览

`Pix_KimiApiNode` 是 PixNodes 系列中的国产 LLM 接口节点。它集成了 Moonshot AI (月之暗面) 的 Kimi API，除了具备极强的超长文本（Long Context）处理能力外，还支持 Kimi K2 系列的**深度思考（Thinking）**模型和**视觉（Vision）**模型。

API 密钥自动化：在 `api_key` 处填入一次后，密钥会持久化保存至 `ComfyUI/user/PixNodes/api_key.json`。后续运行该节点可留空。

## 2. 输入参数解释

| 参数名称 | 类型 | 建议值 | 描述 |
| --- | --- | --- | --- |
| **api_key** | STRING | (Moonshot API Key) | 月之暗面平台的 API 密钥。 |
| **model** | 菜单 | K2-Turbo / Thinking / Vision | 选择具体模型。`Thinking` 支持长链推理；`Vision` 支持图像分析。 |
| **prompt** | STRING | (多行文本) | 用户发送给 AI 的指令。支持动态提示词。 |
| **system_instruction** | STRING | "你是一个精通..." | 设置 AI 的系统指令或角色背景。 |
| **images** | IMAGE (输入) | (可选连接) | **视觉功能**：连接图像 Tensor 开启视觉分析（需配合 Vision 系列模型使用）。 |
| **input_file_text** | STRING (输入) | (可选连接) | 用于输入超长文本上下文（如论文、剧本），发挥 Kimi 的长文本优势。 |

## 3. 输出结果描述

| 索引 | 名称 | 类型 | 描述 |
| --- | --- | --- | --- |
| **0** | text_response | STRING | AI 生成的最终回答文本。 |
| **1** | history | STRING | 对话历史的 JSON 序列，用于构建多轮连续对话流。 |

## 4. 典型工作流场景

- **深度长文分析**: 将长篇 TXT 文档通过 `Pix_LoadTextFromFolder` 读取并连接到 `input_file_text`，让 Kimi 进行总结或特定信息提取。
- **图像细节理解**: 连接 `Load Image` 节点，使用 `moonshot-v1-8k-vision-preview` 模型，让 AI 深入描述图中物体的关系或文字内容。
- **高质量 Prompt 转换**: 利用 Kimi 对中文语境的深度理解，将复杂的中文描述转换为更适合 SDXL 等模型的英文 Prompt。