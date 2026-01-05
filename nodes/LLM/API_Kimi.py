import os
import json
import torch
import base64
import hashlib
import numpy as np
from io import BytesIO
from PIL import Image
from openai import OpenAI, AuthenticationError, RateLimitError
from server import PromptServer
import folder_paths

class KimiLLMBase:
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
        if pil_img.mode == 'RGBA': pil_img = pil_img.convert('RGB')
        buffered = BytesIO()
        pil_img.save(buffered, format="JPEG", quality=90)
        return base64.b64encode(buffered.getvalue()).decode("utf-8")

class KimiApiNode(KimiLLMBase):
    """
    ComfyUI Kimi API Node - PixNodes Series
    Saves API keys to ComfyUI/user/PixNodes/ for persistence.
    """
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "api_key": ("STRING", {"default": "", "placeholder": "Leave empty to use saved key"}),
                "base_url": ("STRING", {"default": "https://api.moonshot.cn/v1"}),
                "model": ([
                    "kimi-k2-0905-preview", "kimi-k2-turbo-preview", "kimi-k2-thinking",
                    "moonshot-v1-8k-vision-preview", "moonshot-v1-32k-vision-preview", "moonshot-v1-128k-vision-preview",
                    "moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"
                ], {"default": "kimi-k2-turbo-preview"}),
                "prompt": ("STRING", {"multiline": True, "default": "", "dynamicPrompts": True}),
                "system_instruction": ("STRING", {"multiline": True, "default": "You are a helpful assistant."}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 2147483647}),
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
    FUNCTION = "call_kimi"
    CATEGORY = "PixNodes/LLM"

    def call_kimi(self, **kwargs):
        api_key = kwargs.get("api_key", "")
        base_url = kwargs.get("base_url", "https://api.moonshot.cn/v1")
        model = kwargs.get("model", "kimi-k2-turbo-preview")
        prompt = kwargs.get("prompt", "")
        system_instruction = kwargs.get("system_instruction", "")
        seed = kwargs.get("seed", 0)
        max_tokens = kwargs.get("max_tokens", "auto")
        temperature = kwargs.get("temperature", "auto")
        top_p = kwargs.get("top_p", "auto")
        history = kwargs.get("history", "")
        input_file_text = kwargs.get("input_file_text", None)
        images = kwargs.get("images", None)

        final_key = self._get_or_save_key("kimi", api_key)
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
        if images is not None:
            base64_img = self.tensor_to_base64(images)
            user_content.insert(0, {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_img}"}})

        messages.append({"role": "user", "content": user_content})

        try:
            client = OpenAI(api_key=final_key, base_url=base_url)
            completion_params = {
                "model": model,
                "messages": messages,
                "stream": False,
                "seed": int(seed)
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
            
            PromptServer.instance.send_sync("kimi_status", {"status": "success", "node": "Pix_KimiApiNode"})
            return (result, new_history)

        except AuthenticationError:
            return ("Error: API Key invalid.", "")
        except RateLimitError:
            return ("Error: Rate limit exceeded or balance low.", "")
        except Exception as e:
            return (f"Error: {str(e)}", "")

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        m = hashlib.sha256()
        for k, v in kwargs.items():
            if k != "images":
                m.update(f"{k}:{v}".encode("utf-8"))
        return m.digest().hex()

# 节点映射
NODE_CLASS_MAPPINGS = {
    "Pix_KimiApiNode": KimiApiNode
}

# 显示名称映射：代码层级使用英文，汉化交给 JSON
NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_KimiApiNode": "Kimi API Assistant (PixNodes)"
}