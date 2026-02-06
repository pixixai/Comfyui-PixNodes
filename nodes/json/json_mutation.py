import json
import copy
from typing import Any, Dict, List, Tuple, Union

class JsonMutation:
    """
    PixNodes JSON Mutation 工具
    支持通过点号路径 (Dot Notation) 批量修改 JSON 的键 (Key) 或 值 (Value)。
    
    功能特性：
    1. 路径通配符 '*': 使用 '*' 可以匹配列表中的所有项或字典中的所有值。
    2. 广播模式 '@': new_values 以单数个 '@' 开头 (如 @value) 可开启广播模式。
    3. 强制删除 '-': 在 target_paths 中，如果路径以 '-' 开头 (如 -items.0)，则强制删除该元素。
    4. 智能对齐: 在配对模式下，'-' 开头的删除路径不占用 new_values 的配额；且 new_values 会自动过滤空行。
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "json_data": ("*",),
                "target": (["Value", "Key"], {"default": "Value"}),
                "mode": (["Replace", "Prepend", "Append"], {"default": "Replace"}),
                "target_paths": ("STRING", {"multiline": True, "default": ""}),
                "new_values": ("STRING", {"multiline": True, "default": ""}),
            }
        }

    RETURN_TYPES = ("JSON",)
    RETURN_NAMES = ("json_data",)
    FUNCTION = "execute_mutation"
    CATEGORY = "PixNodes/JSON"

    @classmethod
    def VALIDATE_INPUTS(cls, input_types):
        return True

    def execute_mutation(self, json_data: Any, target: str, mode: str, 
                         target_paths: str, new_values: str) -> Tuple[Any]:
        
        data = self._parse_input(json_data)
        work_data = copy.deepcopy(data)
        
        # 1. 预处理：过滤空行
        path_lines = [p.strip() for p in target_paths.split('\n') if p.strip()]
        # 过滤 new_values 中的空行，确保数据紧凑对齐
        raw_val_lines = [v.strip() for v in new_values.split('\n') if v.strip()]
        
        # 2. 检查是否为广播模式 (@开头)
        # 逻辑：检查 new_values 的第一个有效行是否以 @ 开头
        # 注意：这里我们只看第一行来决定是否全局广播
        first_val = raw_val_lines[0] if raw_val_lines else ""
        
        leading_at_count = 0
        for char in first_val:
            if char == '@': leading_at_count += 1
            else: break
        
        is_global_mode = (leading_at_count % 2 == 1)

        def get_effective_op(raw_path):
            # 处理 '-' 前缀删除语法
            if raw_path.startswith('-') and len(raw_path) > 1:
                return raw_path[1:], "Delete"
            return raw_path, None

        if is_global_mode:
            # --- 广播模式 ---
            # 取第一行作为广播值
            payload = first_val[1:]
            val_str = self._unescape_leading_ats(payload)
            val_to_use = self._parse_val(val_str)
            
            if not path_lines:
                # Root 操作
                if mode == "Replace":
                    work_data = val_to_use
                else:
                    self._apply_root_append(work_data, mode, val_to_use)
            else:
                for path in path_lines:
                    eff_path, force_mode = get_effective_op(path)
                    # 如果是删除路径，则执行删除；否则执行全局修改
                    final_mode = force_mode if force_mode == "Delete" else mode
                    # 删除操作不需要值
                    final_val = None if final_mode == "Delete" else val_to_use
                    
                    self._recursive_mutate_wrapper(work_data, eff_path, target, final_mode, final_val)
        else:
            # --- 配对模式 (智能对齐) ---
            val_idx = 0
            for path in path_lines:
                eff_path, force_mode = get_effective_op(path)
                
                if force_mode == "Delete":
                    # 情况 A: 这是一个删除操作
                    # 策略: 直接执行删除，不消耗 val_lines 中的值
                    self._recursive_mutate_wrapper(work_data, eff_path, target, "Delete", None)
                else:
                    # 情况 B: 这是一个编辑操作
                    # 策略: 从 val_lines 中取下一个可用值
                    raw_val = raw_val_lines[val_idx] if val_idx < len(raw_val_lines) else ""
                    val_idx += 1
                    
                    val_str = self._unescape_leading_ats(raw_val)
                    final_val = self._parse_val(val_str)
                    
                    self._recursive_mutate_wrapper(work_data, eff_path, target, mode, final_val)

        return (work_data,)

    def _apply_root_append(self, data, mode, val):
        if isinstance(data, list):
            if mode == "Append": data.append(val)
            elif mode == "Prepend": data.insert(0, val)

    def _recursive_mutate_wrapper(self, root: Any, path: str, target: str, mode: str, value: Any):
        if not path: return
        parts = path.split('.')
        self._recursive_mutate(root, parts, 0, target, mode, value)

    def _recursive_mutate(self, current_obj: Any, parts: List[str], idx: int, target: str, mode: str, value: Any):
        if idx >= len(parts): return

        part = parts[idx]
        is_last = (idx == len(parts) - 1)

        # === 处理通配符 '*' ===
        if part == '*':
            if isinstance(current_obj, list):
                # 倒序遍历以支持安全的批量删除
                for i in range(len(current_obj) - 1, -1, -1):
                    if is_last and target == "Value":
                        self._do_edit_value(current_obj, i, mode, value)
                    else:
                        self._recursive_mutate(current_obj[i], parts, idx + 1, target, mode, value)
            elif isinstance(current_obj, dict):
                # Dict 遍历时复制 keys 以允许修改
                for k in list(current_obj.keys()):
                    if is_last:
                        if target == "Value":
                            self._do_edit_value(current_obj, k, mode, value)
                        elif target == "Key":
                            self._do_edit_key(current_obj, k, mode, str(value) if value is not None else "")
                    else:
                        self._recursive_mutate(current_obj[k], parts, idx + 1, target, mode, value)
            return

        # === 常规路径处理 ===
        if is_last:
            try:
                if target == "Value":
                    self._do_edit_value(current_obj, part, mode, value)
                elif target == "Key":
                    self._do_edit_key(current_obj, part, mode, str(value) if value is not None else "")
            except Exception as e:
                # 忽略路径不存在的错误
                pass
            return

        # 导航深入
        if isinstance(current_obj, list):
            if part.isdigit():
                idx_val = int(part)
                if 0 <= idx_val < len(current_obj):
                    self._recursive_mutate(current_obj[idx_val], parts, idx + 1, target, mode, value)
        
        elif isinstance(current_obj, dict):
            if part not in current_obj:
                if mode == "Delete": return
                current_obj[part] = {}
            self._recursive_mutate(current_obj[part], parts, idx + 1, target, mode, value)

    def _unescape_leading_ats(self, s: str) -> str:
        count = 0
        for char in s:
            if char == '@': count += 1
            else: break
        prefix = "@" * (count // 2 + count % 2)
        return prefix + s[count:]

    def _parse_input(self, inp: Any) -> Any:
        if isinstance(inp, str):
            try: return json.loads(inp)
            except: return inp
        return inp

    def _parse_val(self, val: str) -> Any:
        if val is None: return "" 
        v = str(val).strip()
        if not v: return ""
        try: return json.loads(v)
        except: return v

    def _do_edit_value(self, parent: Any, key_str: str, mode: str, value: Any):
        key = int(key_str) if isinstance(key_str, str) and key_str.isdigit() and isinstance(parent, list) else key_str
        
        if isinstance(key, int) and isinstance(parent, list) and not (0 <= key < len(parent)): return
        if isinstance(key, str) and isinstance(parent, dict) and key not in parent: return

        if mode == "Delete":
            if isinstance(parent, list):
                parent.pop(key)
            elif isinstance(parent, dict):
                parent.pop(key, None)
            return

        final_value = value
        actual_mode = mode
        
        if isinstance(value, str):
            final_value = self._parse_val(value)

        if actual_mode == "Replace":
            parent[key] = final_value
        elif actual_mode == "Append":
            if isinstance(parent[key], str): parent[key] += str(final_value)
            elif isinstance(parent[key], list): parent[key].append(final_value)
        elif actual_mode == "Prepend":
            if isinstance(parent[key], str): parent[key] = str(final_value) + parent[key]
            elif isinstance(parent[key], list): parent[key].insert(0, final_value)

    def _do_edit_key(self, parent: Any, key: str, mode: str, new_key_content: str):
        if not isinstance(parent, dict) or key not in parent: return
        
        if mode == "Delete":
            parent.pop(key, None)
            return

        new_key = key
        if mode == "Replace": new_key = new_key_content
        elif mode == "Append": new_key = key + new_key_content
        elif mode == "Prepend": new_key = new_key_content + key
        
        if new_key == key: return

        items = list(parent.items())
        parent.clear()
        for k, v in items:
            if k == key: parent[new_key] = v
            else: parent[k] = v

NODE_CLASS_MAPPINGS = { "Pix_JsonMutation": JsonMutation }
NODE_DISPLAY_NAME_MAPPINGS = { "Pix_JsonMutation": "JSON Mutation (PixNodes)" }