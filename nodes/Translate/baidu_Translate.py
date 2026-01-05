import os
import json
import requests
import random
import hashlib
import folder_paths

# 语言代码映射
BAIDU_LANGUAGES = {
    "auto": "自动检测(auto)", "zh": "简体中文(zh)", "cht": "繁体中文(cht)",
    "en": "英文(en)", "jp": "日文(jp)", "kor": "韩文(kor)",
    "fra": "法文(fra)", "de": "德文(de)", "ru": "俄文(ru)"
}

class BaiduTranslate:
    """
    Baidu Translate Node - PixNodes Series
    Features: 
    1. Shared storage in user/PixNodes/api_key.json.
    2. Auto-save when AppID or AppKey is provided in UI.
    3. Auto-clear on auth errors (52003/54001).
    """
    
    def __init__(self):
        self.user_dir = os.path.join(folder_paths.base_path, "user", "PixNodes")
        if not os.path.exists(self.user_dir):
            os.makedirs(self.user_dir, exist_ok=True)
        self.key_file_path = os.path.join(self.user_dir, "api_key.json")
        
    def _get_or_save_config(self, appid, appkey):
        """处理 AppID 和 AppKey 的读取与保存"""
        config = {}
        if os.path.exists(self.key_file_path):
            try:
                with open(self.key_file_path, "r", encoding="utf-8") as f:
                    config = json.load(f)
            except Exception: pass
            
        saved_baidu = config.get("baidu_translate", {})
        
        # 只要用户输入了其中任何一个，就视为更新
        if (appid and appid.strip()) or (appkey and appkey.strip()):
            new_appid = appid.strip() if appid.strip() else saved_baidu.get("appid", "")
            new_appkey = appkey.strip() if appkey.strip() else saved_baidu.get("appkey", "")
            
            config["baidu_translate"] = {"appid": new_appid, "appkey": new_appkey}
            try:
                with open(self.key_file_path, "w", encoding="utf-8") as f:
                    json.dump(config, f, indent=4)
                return config["baidu_translate"]
            except Exception as e:
                print(f"⚠️ Save Baidu config failed: {str(e)}")
                
        return saved_baidu

    def _clear_invalid_key(self):
        """清除本地失效的凭据"""
        if os.path.exists(self.key_file_path):
            try:
                with open(self.key_file_path, "r", encoding="utf-8") as f:
                    config = json.load(f)
                if "baidu_translate" in config:
                    del config["baidu_translate"]
                    with open(self.key_file_path, "w", encoding="utf-8") as f:
                        json.dump(config, f, indent=4)
                    print("⚠️ Baidu API Key cleared due to auth failure.")
            except Exception: pass
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "appid": ("STRING", {"default": "", "placeholder": "Baidu AppID (Leave empty to use saved)"}),
                "appkey": ("STRING", {"default": "", "placeholder": "Baidu AppKey (Leave empty to use saved)"}),
                "from_language": (list(BAIDU_LANGUAGES.values()), {"default": "自动检测(auto)"}),
                "to_language": (list(BAIDU_LANGUAGES.values()), {"default": "简体中文(zh)"}),
                "text": ("STRING", {"multiline": True, "placeholder": "Text to translate..."}),
            }
        }
    
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("translated_text",)
    FUNCTION = "do_translate"
    CATEGORY = "PixNodes/Translate"
    
    def do_translate(self, appid, appkey, from_language, to_language, text):
        if not text or not text.strip():
            return ("",)
            
        # 获取配置
        current_conf = self._get_or_save_config(appid, appkey)
        final_appid = current_conf.get("appid", "")
        final_appkey = current_conf.get("appkey", "")
        
        if not final_appid or not final_appkey:
            return ("Error: Baidu AppID or AppKey is missing.",)
            
        def extract_code(lang_str):
            return lang_str.split("(")[-1].split(")")[0] if "(" in lang_str else lang_str
            
        from_code = extract_code(from_language)
        to_code = extract_code(to_language)
        
        salt = random.randint(32768, 65536)
        sign = hashlib.md5((final_appid + text + str(salt) + final_appkey).encode('utf-8')).hexdigest()
        
        url = "http://api.fanyi.baidu.com/api/trans/vip/translate"
        payload = {'q': text, 'from': from_code, 'to': to_code, 'appid': final_appid, 'salt': salt, 'sign': sign}
        
        try:
            response = requests.post(url, params=payload, timeout=15)
            result = response.json()
            
            # 52003: AppID不存在或错误, 54001: 签名错误
            if result.get('error_code') in ['52003', '54001']:
                self._clear_invalid_key()
                return (f"Error: Authentication failed ({result.get('error_code')}). Credentials cleared.",)
            elif 'error_code' in result:
                return (f"Baidu API Error {result['error_code']}: {result.get('error_msg')}",)
                
            translated_text = "\n".join([item['dst'] for item in result.get('trans_result', [])])
            return (translated_text,)
        except Exception as e:
            return (f"Request Error: {str(e)}",)

# 注册映射
NODE_CLASS_MAPPINGS = {
    "Pix_BaiduTranslateNode": BaiduTranslate
}

# 显示名称映射
NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_BaiduTranslateNode": "Baidu Translate (PixNodes)"
}