import os
import json
import requests
import random
import hashlib
from io import BytesIO

# 精简后的语言代码映射
BAIDU_LANGUAGES = {
    "auto": "自动检测(auto)",
    "zh": "简体中文(zh)",
    "cht": "繁体中文(cht)",  # 百度API繁体中文代码为cht
    "en": "英文(en)",
    "jp": "日文(jp)",
    "kor": "韩文(kor)",
    "fra": "法文(fra)",
    "de": "德文(de)",
    "ru": "俄文(ru)"
}

class BaiduTranslateNode:
    """
    百度翻译节点
    使用百度翻译API进行文本翻译（精简语言版）
    """
    
    def __init__(self):
        self.config = self.load_config()
        
    def load_config(self):
        """加载或创建配置文件"""
        config_path = os.path.join(os.path.dirname(__file__), "baiduTranslate_config.json")
        default_config = {
            "appid": "",
            "appkey": "",
            "default_from": "auto",
            "default_to": "zh"
        }
        
        if not os.path.exists(config_path):
            with open(config_path, "w", encoding="utf-8") as f:
                json.dump(default_config, f, indent=4)
            return default_config
        
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    
    def save_config(self, appid, appkey):
        """保存配置到文件"""
        config_path = os.path.join(os.path.dirname(__file__), "baiduTranslate_config.json")
        self.config.update({
            "appid": appid.strip(),
            "appkey": appkey.strip()
        })
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(self.config, f, indent=4)
    
    @classmethod
    def INPUT_TYPES(cls):
        """定义输入参数"""
        # 获取默认语言设置
        default_from = BAIDU_LANGUAGES.get(cls().config.get("default_from", "auto"), "自动检测(auto)")
        default_to = BAIDU_LANGUAGES.get(cls().config.get("default_to", "zh"), "简体中文(zh)")
        
        return {
            "required": {
                "appid": ("STRING", {
                    "default": "",
                    "multiline": False,
                    "placeholder": "输入百度翻译APP ID",
                    "tooltip": "从百度翻译开放平台获取的APP ID"
                }),
                "appkey": ("STRING", {
                    "default": "",
                    "multiline": False,
                    "placeholder": "输入百度翻译秘钥",
                    "tooltip": "从百度翻译开放平台获取的秘钥"
                }),
                "from_language": (list(BAIDU_LANGUAGES.values()), {
                    "default": default_from,
                    "tooltip": "选择源语言（自动检测可识别多种语言）"
                }),
                "to_language": (list(BAIDU_LANGUAGES.values()), {
                    "default": default_to,
                    "tooltip": "选择目标语言"
                }),
                "text": ("STRING", {
                    "multiline": True,
                    "placeholder": "输入要翻译的文本（支持多段落）",
                    "tooltip": "待翻译的文本内容，支持换行符"
                }),
            }
        }
    
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("translated_text",)
    FUNCTION = "do_translate"
    CATEGORY = "pixix/翻译"
    DESCRIPTION = "使用百度翻译API进行多语言翻译（精简语言版）"
    
    def do_translate(self, appid, appkey, from_language, to_language, text):
        """执行翻译操作"""
        # 验证输入文本
        if not text.strip():
            return ("",)
            
        # 提取语言代码（从"简体中文(zh)"中提取"zh"）
        def extract_code(lang_str):
            if "(" in lang_str and ")" in lang_str:
                return lang_str.split("(")[-1].split(")")[0]
            return lang_str
            
        from_code = extract_code(from_language)
        to_code = extract_code(to_language)
        
        # 确定使用的凭证（优先使用输入框的值）
        final_appid = appid.strip() or self.config.get("appid", "")
        final_appkey = appkey.strip() or self.config.get("appkey", "")
        
        # 凭证验证
        if not final_appid or not final_appkey:
            raise ValueError("必须提供有效的APP ID和秘钥")
            
        # 如果输入了新凭证，则保存
        if (appid.strip() and appid != self.config.get("appid", "")) or \
           (appkey.strip() and appkey != self.config.get("appkey", "")):
            self.save_config(appid, appkey)
            print("✅ 百度翻译凭证已更新")
        
        # 生成签名
        def make_md5(s):
            return hashlib.md5(s.encode('utf-8')).hexdigest()
        
        salt = random.randint(32768, 65536)
        sign = make_md5(final_appid + text + str(salt) + final_appkey)
        
        # 构建请求
        url = "http://api.fanyi.baidu.com/api/trans/vip/translate"
        payload = {
            'q': text,
            'from': from_code,
            'to': to_code,
            'appid': final_appid,
            'salt': salt,
            'sign': sign
        }
        
        try:
            # 发送请求
            response = requests.post(url, params=payload)
            response.raise_for_status()
            
            # 解析结果
            result = response.json()
            if 'error_code' in result:
                raise ValueError(f"百度翻译错误 {result['error_code']}: {result['error_msg']}")
                
            translated_text = "\n".join([item['dst'] for item in result.get('trans_result', [])])
            return (translated_text,)
            
        except requests.exceptions.RequestException as e:
            raise ValueError(f"API请求失败: {str(e)}")
        except Exception as e:
            raise ValueError(f"翻译过程中发生错误: {str(e)}")

# 节点注册
NODE_CLASS_MAPPINGS = {
    "BaiduTranslateNode": BaiduTranslateNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "BaiduTranslateNode": "百度翻译"
}