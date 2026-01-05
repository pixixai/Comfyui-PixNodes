import os
import json
import torch
import base64
import hashlib
import numpy as np
from io import BytesIO
from PIL import Image
from openai import OpenAI, AuthenticationError
from server import PromptServer
import folder_paths

class DoubaoLLMBase:
    def __init__(self):
        # 确定用户数据存储路径 (ComfyUI/user/PixNodes)
        self.user_dir = os.path.join(folder_paths.base_path, "user", "PixNodes")
        if not os.path.exists(self.user_dir):
            os.makedirs(self.user_dir, exist_ok=True)
        self.key_file_path = os.path.join(self.user_dir, "api_key.json")

    def _get_or_save_key(self, service_name, input_key):
        config = {}
        if os.path.exists(self.key_file_path):
            try:
                with open(self.key_file_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
            except Exception: pass
        if input_key and input_key.strip():
            config[service_name] = input_key.strip()
            with open(self.key_file_path, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=4)
            return input_key.strip()
        return config.get(service_name, "")

    def tensor_to_base64(self, tensor):
        img_np = (255. * tensor[0].cpu().numpy()).astype(np.uint8)
        pil_img = Image.fromarray(img_np)
        buffered = BytesIO()
        pil_img.save(buffered, format="PNG")
        return base64.b64encode(buffered.getvalue()).decode("utf-8")

class DoubaoApiNode(DoubaoLLMBase):
    """
    ComfyUI Doubao API Node - PixNodes Series
    Saves API keys to ComfyUI/user/PixNodes/ for persistence.
    Supports Vision models.
    """
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "api_key": ("STRING", {"default": "", "placeholder": "Leave empty to use saved key"}),
                "base_url": ("STRING", {"default": "https://ark.cn-beijing.volces.com/api/v3"}),
                "model": ([
                    "doubao-seed-1-6-flash-250828",
                    "doubao-seed-1-8-251215",
                    "doubao-seed-code-preview-251028",
                    "doubao-seed-1-6-vision-250815"
                ], {"default": "doubao-seed-1-6-flash-250828"}),
                "prompt": ("STRING", {"multiline": True, "default": "", "dynamicPrompts": True}),
                "system_instruction": ("STRING", {"multiline": True, "default": "You are a helpful assistant."}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "max_tokens": ("STRING", {"default": "auto", "placeholder": "e.g. 4096 or auto"}),
                "temperature": ("STRING", {"default": "auto", "placeholder": "0.0 - 2.0 or auto"}),
            },
            "optional": {
                "top_p": ("STRING", {"default": "auto"}),
                "history": ("STRING", {"forceInput": True, "default": ""}),
                "input_file_text": ("STRING", {"forceInput": True}),
                "images": ("IMAGE",),
            }
        }

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("text_response", "history")
    FUNCTION = "call_doubao"
    CATEGORY = "PixNodes/LLM"

    def call_doubao(self, **kwargs):
        api_key = kwargs.get("api_key", "")
        base_url = kwargs.get("base_url", "https://ark.cn-beijing.volces.com/api/v3")
        model = kwargs.get("model", "doubao-seed-1-6-flash-250828")
        prompt = kwargs.get("prompt", "")
        system_instruction = kwargs.get("system_instruction", "")
        seed = kwargs.get("seed", 0)
        max_tokens = kwargs.get("max_tokens", "auto")
        temperature = kwargs.get("temperature", "auto")
        top_p = kwargs.get("top_p", "auto")
        history = kwargs.get("history", "")
        input_file_text = kwargs.get("input_file_text", None)
        images = kwargs.get("images", None)

        final_key = self._get_or_save_key("doubao", api_key)
        if not final_key:
            return ("Error: API Key not found.", "")

        messages = []
        if system_instruction.strip():
            messages.append({"role": "system", "content": system_instruction})
        
        if history.strip():
            try:
                past_messages = json.loads(history)
                if isinstance(past_messages, list):
                    messages.extend(past_messages)
            except Exception: pass

        final_user_prompt = prompt
        if input_file_text:
            final_user_prompt = f"{prompt}\n\n[File Context]:\n{input_file_text}"

        user_content = [{"type": "text", "text": final_user_prompt}]
        
        # 视觉模型支持：如果是图像输入且模型包含 vision 字样
        if images is not None:
            base64_img = self.tensor_to_base64(images)
            user_content.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{base64_img}"}})

        messages.append({"role": "user", "content": user_content})

        try:
            client = OpenAI(api_key=final_key, base_url=base_url)
            completion_params = {
                "model": model,
                "messages": messages,
                "stream": False,
                "seed": seed
            }

            if str(max_tokens).strip().lower() != "auto":
                try: completion_params["max_tokens"] = int(max_tokens)
                except: pass
            if str(temperature).strip().lower() != "auto":
                try: completion_params["temperature"] = float(temperature)
                except: pass
            if str(top_p).strip().lower() != "auto":
                try: completion_params["top_p"] = float(top_p)
                except: pass

            response = client.chat.completions.create(**completion_params)
            result = response.choices[0].message.content
            
            messages.append({"role": "assistant", "content": result})
            new_history = json.dumps(messages, ensure_ascii=False)
            
            PromptServer.instance.send_sync("doubao_status", {"status": "success", "node": "Pix_DoubaoApiNode"})
            return (result, new_history)

        except AuthenticationError:
            return ("Error: API Key invalid.", "")
        except Exception as e:
            return (f"Error: {str(e)}", "")

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        m = hashlib.sha256()
        for k, v in kwargs.items():
            if k != "images":
                m.update(f"{k}:{v}".encode("utf-8"))
        return m.digest().hex()

# 注册映射：统一 Pix_ 前缀
NODE_CLASS_MAPPINGS = {
    "Pix_DoubaoApiNode": DoubaoApiNode
}

# 显示名称映射：代码层级使用英文标识
NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_DoubaoApiNode": "Doubao API Assistant (PixNodes)"
}