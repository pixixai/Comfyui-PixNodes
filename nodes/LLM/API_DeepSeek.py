import os
import json
import hashlib
from openai import OpenAI, AuthenticationError
from server import PromptServer
import folder_paths

class DeepSeekApiNode:
    """
    ComfyUI DeepSeek API Node - PixNodes Series
    Saves API keys to ComfyUI/user/PixNodes/ for persistence.
    """
    def __init__(self):
        # 确定用户数据存储路径 (ComfyUI/user/PixNodes)
        self.user_dir = os.path.join(folder_paths.base_path, "user", "PixNodes")
        if not os.path.exists(self.user_dir):
            os.makedirs(self.user_dir, exist_ok=True)
        self.key_file_path = os.path.join(self.user_dir, "api_key.json")

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "api_key": ("STRING", {"default": "", "placeholder": "Leave empty to use saved key"}),
                "base_url": ("STRING", {"default": "https://api.deepseek.com"}),
                "model": (["deepseek-chat", "deepseek-reasoner"], {"default": "deepseek-chat"}),
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
            }
        }

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("text_response", "history")
    FUNCTION = "call_deepseek"
    CATEGORY = "PixNodes/LLM"

    def _get_or_save_key(self, input_key):
        config = {}
        if os.path.exists(self.key_file_path):
            try:
                with open(self.key_file_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
            except Exception: pass

        if input_key and input_key.strip():
            config["deepseek"] = input_key.strip()
            with open(self.key_file_path, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=4)
            return input_key.strip()
        
        return config.get("deepseek", "")

    def call_deepseek(self, **kwargs):
        api_key = kwargs.get("api_key", "")
        base_url = kwargs.get("base_url", "https://api.deepseek.com")
        model = kwargs.get("model", "deepseek-chat")
        prompt = kwargs.get("prompt", "")
        system_instruction = kwargs.get("system_instruction", "")
        seed = kwargs.get("seed", 0)
        max_tokens = kwargs.get("max_tokens", "auto")
        temperature = kwargs.get("temperature", "auto")
        top_p = kwargs.get("top_p", "auto")
        history = kwargs.get("history", "")
        input_file_text = kwargs.get("input_file_text", None)
        
        final_key = self._get_or_save_key(api_key)
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
        
        messages.append({"role": "user", "content": final_user_prompt})

        try:
            client = OpenAI(api_key=final_key, base_url=base_url)
            completion_params = {
                "model": model,
                "messages": messages,
                "stream": False,
                "seed": seed
            }

            is_reasoner = "reasoner" in model
            if str(max_tokens).strip().lower() != "auto":
                try: completion_params["max_tokens"] = int(max_tokens)
                except: pass
            if not is_reasoner and str(temperature).strip().lower() != "auto":
                try: completion_params["temperature"] = float(temperature)
                except: pass
            if not is_reasoner and str(top_p).strip().lower() != "auto":
                try: completion_params["top_p"] = float(top_p)
                except: pass

            response = client.chat.completions.create(**completion_params)
            result = response.choices[0].message.content
            
            messages.append({"role": "assistant", "content": result})
            new_history = json.dumps(messages, ensure_ascii=False)
            
            PromptServer.instance.send_sync("deepseek_status", {"status": "success", "node": "Pix_DeepSeekApiNode"})
            return (result, new_history)

        except AuthenticationError:
            return ("Error: API Key invalid.", "")
        except Exception as e:
            return (f"Error: {str(e)}", "")

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        m = hashlib.sha256()
        for k, v in kwargs.items():
            m.update(f"{k}:{v}".encode("utf-8"))
        return m.digest().hex()

# 注册映射：统一 Pix_ 前缀
NODE_CLASS_MAPPINGS = {
    "Pix_DeepSeekApiNode": DeepSeekApiNode
}

# 显示名称映射：使用英文名称，通过 JSON 汉化
NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_DeepSeekApiNode": "DeepSeek API Assistant (PixNodes)"
}