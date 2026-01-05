from nodes import NODE_CLASS_MAPPINGS as ALL_NODE_CLASS_MAPPINGS
import torch

class AlwaysEqualProxy(str):
    def __eq__(self, _): return True
    def __ne__(self, _): return False

def ByPassTypeTuple(t): return t

any_type = AlwaysEqualProxy("*")
MAX_FLOW_NUM = 20

# ==============================================================================
# For Loop Start (Pix_ForLoopStart)
# ==============================================================================
class forLoopStart:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "total": ("INT", {"default": 1, "min": 1, "max": 100000}),
            },
            "optional": {
                "initial_value_%d" % i: (any_type,) for i in range(1, MAX_FLOW_NUM)
            },
            "hidden": {
                "initial_value_0": (any_type,), # 内部保留给 Index
                "unique_id": "UNIQUE_ID"
            }
        }

    RETURN_TYPES = ByPassTypeTuple(tuple(["FLOW_CONTROL", "INT"] + [any_type] * (MAX_FLOW_NUM - 1)))
    RETURN_NAMES = ByPassTypeTuple(tuple(["flow", "index"] + ["value_%d" % i for i in range(1, MAX_FLOW_NUM)]))
    FUNCTION = "loop_start"
    CATEGORY = "PixNodes/loop"

    def loop_start(self, total, **kwargs):
        from comfy_execution.graph_utils import GraphBuilder
        graph = GraphBuilder()
        
        # 1. 获取初始 Index
        i = kwargs.get("initial_value_0", 0)

        # 2. 准备参数
        initial_vals = {}
        for n in range(1, MAX_FLOW_NUM):
            val = kwargs.get(f"initial_value_{n}")
            initial_vals[f"initial_value_{n}"] = val
        
        # 3. [Update] 调用重命名后的 While Loop Start (Pix_WhileLoopStart)
        while_open = graph.node("Pix_WhileLoopStart", 
                                condition=total > 0, 
                                initial_value_0=i, 
                                **initial_vals)
        
        # 4. 返回动态图引用
        results = []
        results.append(while_open.out(0)) 
        results.append(while_open.out(1)) 
        
        for n in range(1, MAX_FLOW_NUM):
            results.append(while_open.out(n + 1))

        return {
            "result": tuple(results),
            "expand": graph.finalize(),
        }

# ==============================================================================
# For Loop End (Pix_ForLoopEnd)
# ==============================================================================
class forLoopEnd:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "flow": ("FLOW_CONTROL", {"rawLink": True}),
            },
            "optional": {
                "initial_value_%d" % i: (any_type, {"rawLink": True}) for i in range(1, MAX_FLOW_NUM)
            },
            "hidden": {
                "dynprompt": "DYNPROMPT",
                "unique_id": "UNIQUE_ID"
            },
        }

    RETURN_TYPES = ByPassTypeTuple(tuple([any_type] * (MAX_FLOW_NUM - 1)))
    RETURN_NAMES = ByPassTypeTuple(tuple(["value_%d" % i for i in range(1, MAX_FLOW_NUM)]))
    FUNCTION = "loop_end"
    CATEGORY = "PixNodes/loop"

    def loop_end(self, flow, dynprompt=None, unique_id=None, **kwargs):
        from comfy_execution.graph_utils import GraphBuilder, is_link
        graph = GraphBuilder()
        
        if flow is None or not isinstance(flow, (list, tuple)) or len(flow) == 0:
            return tuple(kwargs.get(f"initial_value_{i}") for i in range(1, MAX_FLOW_NUM))
            
        while_open_id = flow[0]
        start_node = dynprompt.get_node(while_open_id)
        
        if start_node is None:
             return tuple(kwargs.get(f"initial_value_{i}") for i in range(1, MAX_FLOW_NUM))

        total_input = start_node.get('inputs', {}).get('total', 0)
        
        if is_link(total_input):
            total = total_input
        else:
            try:
                if isinstance(total_input, torch.Tensor):
                    total = int(total_input.item()) if total_input.numel() == 1 else 0
                else:
                    total = int(total_input)
            except (ValueError, TypeError):
                total = 0

        # [Update] 使用 Pix_MathInt 和 Pix_Compare
        sub = graph.node("Pix_MathInt", operation="add", a=[while_open_id, 1], b=1)
        # 注意: 你的描述是 Pix_Compare, 但之前代码是 Compare. 请确认节点注册名.
        # 如果注册名是 Pix_Compar (少个e), 请使用 Pix_Compar
        cond = graph.node("Pix_Compare", a=sub.out(0), b=total, comparison='a < b')
        
        input_values = {}
        for i in range(1, MAX_FLOW_NUM):
            input_values[f"initial_value_{i}"] = kwargs.get(f"initial_value_{i}")
        
        # [Update] 使用 Pix_WhileLoopEnd
        while_close = graph.node("Pix_WhileLoopEnd", 
                                 flow=flow, 
                                 condition=cond.out(0), 
                                 initial_value_0=sub.out(0), 
                                 **input_values)
        
        return {
            "result": tuple(while_close.out(i) for i in range(1, MAX_FLOW_NUM)),
            "expand": graph.finalize(),
        }

NODE_CLASS_MAPPINGS = {
    "Pix_ForLoopStart": forLoopStart,
    "Pix_ForLoopEnd": forLoopEnd
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_ForLoopStart": "For Loop Start",
    "Pix_ForLoopEnd": "For Loop End"
}