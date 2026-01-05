import os
import json
import requests
import hashlib
import folder_paths

# 支持的语言列表（名称 + 代码）
LANGUAGES = {
    "zh-CN": "简体中文(zh-CN)", "zh-TW": "繁体中文(zh-TW)", "en": "英文(en)",
    "ja": "日文(ja)", "ko": "韩文(ko)", "fr": "法文(fr)", "de": "德文(de)", "ru": "俄文(ru)",
}

# ChatGLM API 端点
ENDPOINT_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"

class ChatGLM4Translate:
    """
    ChatGLM4 Translate Node - PixNodes Series
    Features: 
    1. Priority lookup in api_key.json.
    2. Auto-save new keys from input.
    3. Auto-clear key on auth failure (401/403).
    """
    
    def __init__(self):
        # 确定用户数据存储路径 (ComfyUI/user/PixNodes)
        self.user_dir = os.path.join(folder_paths.base_path, "user", "PixNodes")
        if not os.path.exists(self.user_dir):
            os.makedirs(self.user_dir, exist_ok=True)
        self.key_file_path = os.path.join(self.user_dir, "api_key.json")
        
    def _get_or_save_key(self, input_key):
        """核心密钥处理逻辑：读取 -> (可选)更新 -> 返回"""
        config = {}
        if os.path.exists(self.key_file_path):
            try:
                with open(self.key_file_path, "r", encoding="utf-8") as f:
                    config = json.load(f)
            except Exception: pass
            
        # 如果用户在界面输入了新 Key，则更新文件
        if input_key and input_key.strip():
            config["chatglm"] = input_key.strip()
            try:
                with open(self.key_file_path, "w", encoding="utf-8") as f:
                    json.dump(config, f, indent=4)
                return input_key.strip()
            except Exception as e:
                print(f"⚠️ Save ChatGLM key failed: {str(e)}")
                
        return config.get("chatglm", "")

    def _clear_invalid_key(self):
        """验证失败时清除本地存储"""
        if os.path.exists(self.key_file_path):
            try:
                with open(self.key_file_path, "r", encoding="utf-8") as f:
                    config = json.load(f)
                if "chatglm" in config:
                    del config["chatglm"]
                    with open(self.key_file_path, "w", encoding="utf-8") as f:
                        json.dump(config, f, indent=4)
                    print("⚠️ ChatGLM API Key cleared due to auth failure.")
            except Exception: pass
    
    @classmethod
    def INPUT_TYPES(cls):
        language_list = sorted(LANGUAGES.values())
        return {
            "required": {
                "api_key": ("STRING", {
                    "default": "", 
                    "placeholder": "Leave empty to use saved key from api_key.json"
                }),
                "model": ([
                    "glm-4-flash", 
                    "glm-4-flash-250414"
                ], {
                    "default": "glm-4-flash"
                }),
                "from_language": (language_list, {
                    "default": "简体中文(zh-CN)"
                }),
                "to_language": (language_list, {
                    "default": "英文(en)"
                }),
                "text": ("STRING", {
                    "multiline": True,
                    "placeholder": "Text to translate..."
                }),
            }
        }
    
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("translated_text",)
    FUNCTION = "translate_text"
    CATEGORY = "PixNodes/Translate"
    
    def translate_text(self, api_key, model, from_language, to_language, text):
        if not text or not text.strip():
            return ("",)
            
        # 提取最终使用的密钥
        final_api_key = self._get_or_save_key(api_key)
        
        if not final_api_key:
            return ("Error: ChatGLM API Key missing.",)
            
        def extract_code(lang_str):
            return lang_str.split("(")[-1].rstrip(")") if "(" in lang_str else lang_str
            
        from_code = extract_code(from_language)
        to_code = extract_code(to_language)
        
        prompt = f"请严格翻译以下文本：从 {from_language} 到 {to_language}。保留原格式，仅输出翻译结果。\n文本内容：\n{text}"
        headers = {"Authorization": f"Bearer {final_api_key}", "Content-Type": "application/json"}
        payload = {"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.3}
        
        try:
            response = requests.post(ENDPOINT_URL, headers=headers, json=payload, timeout=30)
            
            # 处理验证失败
            if response.status_code in [401, 403]:
                self._clear_invalid_key()
                return ("Error: API Key invalid. Local key cleared.",)
            
            response.raise_for_status()
            result = response.json()
            translated_text = result.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            return (translated_text,)
        except Exception as e:
            return (f"ChatGLM API Error: {str(e)}",)

# 注册映射
NODE_CLASS_MAPPINGS = {
    "Pix_ChatGLM4Translate": ChatGLM4Translate
}

# 显示名称映射
NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_ChatGLM4Translate": "ChatGLM4 Translate (PixNodes)"
}