import os
import json
import requests

# 支持的语言列表（名称 + 代码）
LANGUAGES = {
    "zh-CN": "简体中文(zh-CN)",
    "zh-TW": "繁体中文(zh-TW)",
    "en": "英文(en)",
    "ja": "日文(ja)",
    "ko": "韩文(ko)",
    "fr": "法文(fr)",
    "de": "德文(de)",
    "ru": "俄文(ru)",
}

# ChatGLM API 端点
ENDPOINT_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"

class ChatGLM4TranslateTextNode:
    """
    ChatGLM4 翻译文本节点
    使用智谱AI的ChatGLM4模型进行文本翻译（自动保存API密钥）
    """
    
    def __init__(self):
        # 初始化配置
        self.config = self.load_config()
        
    def load_config(self):
        """加载或创建配置文件"""
        config_path = os.path.join(os.path.dirname(__file__), "chatGLM4TranslateText_config.json")
        default_config = {
            "api_key": "",  # 首次必须手动输入
            "default_from": "zh-CN",
            "default_to": "en"
        }
        
        if not os.path.exists(config_path):
            with open(config_path, "w", encoding="utf-8") as f:
                json.dump(default_config, f, indent=4)
            return default_config
        
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    
    def save_api_key(self, api_key):
        """保存API密钥到配置文件"""
        config_path = os.path.join(os.path.dirname(__file__), "chatGLM4TranslateText_config.json")
        self.config["api_key"] = api_key.strip()
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(self.config, f, indent=4)
    
    @classmethod
    def INPUT_TYPES(cls):
        """定义输入参数"""
        # 生成带名称的语言选项列表
        language_list = sorted(LANGUAGES.values())
        default_from = LANGUAGES.get(cls().config.get("default_from", "zh-CN"), "简体中文(zh-CN)")
        default_to = LANGUAGES.get(cls().config.get("default_to", "en"), "英文(en)")
        
        return {
            "required": {
                "api_key": ("STRING", {
                    "default": "",
                    "multiline": False,
                    "placeholder": "输入智谱AI的API密钥（首次必填）",
                    "tooltip": "从智谱AI平台获取的API密钥，成功后会自动保存"
                }),
                "model": ([
                    "glm-4-flash", 
                    "glm-4-flash-250414"
                ], {
                    "default": "glm-4-flash",
                    "tooltip": "选择使用的ChatGLM4模型"
                }),
                "from_language": (language_list, {
                    "default": default_from,
                    "tooltip": "选择被翻译文本的语言"
                }),
                "to_language": (language_list, {
                    "default": default_to,
                    "tooltip": "选择翻译目标语言"
                }),
                "text": ("STRING", {
                    "multiline": True,
                    "placeholder": "输入要翻译的文本（支持长文本）",
                    "tooltip": "待翻译的文本内容"
                }),
            }
        }
    
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("translated_text",)
    FUNCTION = "translate_text"
    CATEGORY = "pixix/翻译"
    DESCRIPTION = "使用ChatGLM4大模型进行文本翻译（支持名称+代码选择语言）"
    
    def translate_text(self, api_key, model, from_language, to_language, text):
        """执行翻译操作"""
        # 验证输入文本
        if not text or not text.strip():
            return ("",)
            
        # 提取语言代码（从"日文(ja)"中提取"ja"）
        def extract_code(lang_str):
            if "(" in lang_str and ")" in lang_str:
                return lang_str.split("(")[-1].rstrip(")")
            return lang_str  # 回退处理
            
        from_code = extract_code(from_language)
        to_code = extract_code(to_language)
        
        # 确定使用的API密钥（优先使用输入框的值）
        final_api_key = api_key.strip()
        saved_api_key = self.config.get("api_key", "")
        
        # 密钥验证逻辑
        if not final_api_key:
            if not saved_api_key:
                raise ValueError("首次使用必须输入有效的API密钥")
            final_api_key = saved_api_key
        elif final_api_key != saved_api_key:
            self.save_api_key(final_api_key)
            print("✅ API密钥已更新并保存")
        
        # 构建专业提示词
        prompt = f"""请严格按照要求执行翻译：
- 源语言: {from_language}
- 目标语言: {to_language}
- 要求: 
  1. 保持专业术语准确
  2. 口语化表达自然
  3. 保留原文格式（如换行符、标点）
- 待翻译文本: 
{text}"""
        
        # 准备请求数据
        payload = {
            "model": model,
            "messages": [{
                "role": "user",
                "content": prompt
            }],
            "temperature": 0.3,  # 低温度值保证准确性
            "top_p": 0.8
        }
        
        headers = {
            "Authorization": f"Bearer {final_api_key}",
            "Content-Type": "application/json"
        }
        
        try:
            # 发送API请求
            response = requests.post(ENDPOINT_URL, headers=headers, json=payload)
            response.raise_for_status()
            
            # 解析响应
            result = response.json()
            translated_text = result.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            
            return (translated_text,)
            
        except requests.exceptions.RequestException as e:
            raise ValueError(f"API请求失败: {str(e)}")
        except Exception as e:
            raise ValueError(f"翻译过程中发生错误: {str(e)}")

NODE_CLASS_MAPPINGS = {
    "ChatGLM4TranslateTextNode": ChatGLM4TranslateTextNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ChatGLM4TranslateTextNode": "ChatGLM4 翻译文本",
}