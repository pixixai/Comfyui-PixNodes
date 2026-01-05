# Pix_DeepSeekApiNode (DeepSeek 助手) 节点说明

## 1. 节点功能概览

`Pix_DeepSeekApiNode` 是一个高性能的 LLM 接口节点，属于 `PixNodes/LLM` 分类。它集成了 DeepSeek 官方 API，支持最新的 `deepseek-chat` (V3) 和 `deepseek-reasoner` (R1) 模型。该节点具备 API 密钥自动持久化、对话历史追踪以及外部文件上下文集成等高级功能。

API自动化：输入api-key并运行一次后，改key自动同步到 ComfyUI/user/PixNodes/api_key.json。文件内的api_key失效后，会自动清空。

## 2. 输入参数解释

| 参数名称 | 类型 | 建议值 | 描述 |
| --- | --- | --- | --- |
| **api_key** | STRING | (你的 API Key) | DeepSeek 密钥。填入一次后将保存至 `ComfyUI/user/PixNodes/`，后续可留空。 |
| **model** | 菜单 | chat / reasoner | `chat` 适合常规对话和 Prompt 优化；`reasoner` 具备深度思考能力。 |
| **prompt** | STRING | (多行文本) | 用户发送给 AI 的核心指令或问题。 |
| **system_instruction** | STRING | "You are..." | 定义 AI 的角色设定（System Prompt）。 |
| **max_tokens** | STRING | `auto` 或 `4096` | 限制输出长度。建议设为 `auto` 由模型自动控制。 |
| **temperature** | STRING | `1.0` | 控制生成的随机性。注意：`reasoner` 模型通常不支持手动调整此参数。 |
| **input_file_text** | STRING (输入) | (可选连接) | 外部输入的长文本。连接后会自动作为上下文附加在 Prompt 之后。 |

## 3. 输出结果描述

| 索引 | 名称 | 类型 | 描述 |
| --- | --- | --- | --- |
| **0** | text_response | STRING | AI 生成的纯文本回答内容。 |
| **1** | history | STRING | 完整的对话历史（JSON 格式），可连回 `history` 输入端实现连续对话。 |

## 4. 典型工作流场景

- **自动化 Prompt 增强**: 将简单的图像描述发送给 DeepSeek，让其生成详细的 Stable Diffusion 提示词。
- **长文档分析**: 配合文本加载节点，将文档内容输入 `input_file_text`，让 DeepSeek 进行总结或问答。
- **带逻辑的 AI 流程**: 利用 `reasoner` 模型对复杂逻辑进行拆解，输出结果再分发给其他 PixNodes 逻辑节点。