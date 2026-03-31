class AlwaysEqualProxy(str):
    def __eq__(self, _): return True
    def __ne__(self, _): return False

def ByPassTypeTuple(t): return t

any_type = AlwaysEqualProxy("*")
MAX_FLOW_NUM = 20

# ==============================================================================
# While Loop Start (Pix_WhileLoopStart)
# ==============================================================================
class whileLoopStart:
    @classmethod
    def INPUT_TYPES(cls):
        inputs = {
            "required": {
                "condition": ("BOOLEAN", {"default": True}),
            },
            "optional": {},
        }
        # 【修改点1】Python名称提取从 1 开始到 20 结束，完美匹配前端 UI
        for i in range(1, MAX_FLOW_NUM + 1):
            inputs["optional"]["initial_value_%d" % i] = (any_type,)
        return inputs

    RETURN_TYPES = ByPassTypeTuple(tuple(["FLOW_CONTROL"] + [any_type] * MAX_FLOW_NUM))
    # 【修改点2】返回名称也从 1 开始
    RETURN_NAMES = ByPassTypeTuple(tuple(["flow"] + ["value_%d" % i for i in range(1, MAX_FLOW_NUM + 1)]))
    FUNCTION = "while_loop_open"
    CATEGORY = "PixNodes/loop"

    def while_loop_open(self, condition, **kwargs):
        from comfy_execution.graph import ExecutionBlocker
        values = []
        # 【修改点3】按 1 到 20 的顺序去 kwargs 字典里抓取数据
        for i in range(1, MAX_FLOW_NUM + 1):
            val = kwargs.get("initial_value_%d" % i, None)
            values.append(val if condition else ExecutionBlocker(None))
        return tuple(["stub"] + values)

# ==============================================================================
# While Loop End (Pix_WhileLoopEnd)
# ==============================================================================
class whileLoopEnd:
    @classmethod
    def INPUT_TYPES(cls):
        inputs = {
            "required": {
                "flow": ("FLOW_CONTROL", {"rawLink": True}),
                "condition": ("BOOLEAN", {}),
            },
            "optional": {},
            "hidden": {
                "dynprompt": "DYNPROMPT",
                "unique_id": "UNIQUE_ID",
            }
        }
        for i in range(1, MAX_FLOW_NUM + 1):
            inputs["optional"]["initial_value_%d" % i] = (any_type,)
        return inputs

    RETURN_TYPES = ByPassTypeTuple(tuple([any_type] * MAX_FLOW_NUM))
    RETURN_NAMES = ByPassTypeTuple(tuple(["value_%d" % i for i in range(1, MAX_FLOW_NUM + 1)]))
    FUNCTION = "while_loop_close"
    CATEGORY = "PixNodes/loop"

    def explore_dependencies(self, node_id, dynprompt, upstream, parent_ids):
        from comfy_execution.graph_utils import is_link
        node_info = dynprompt.get_node(node_id)
        if "inputs" not in node_info:
            return

        for k, v in node_info["inputs"].items():
            if is_link(v):
                parent_id = v[0]
                display_id = dynprompt.get_display_node_id(parent_id)
                display_node = dynprompt.get_node(display_id)
                class_type = display_node["class_type"]
                loop_node_types = [
                    'Pix_ForLoopEnd', 'For Loop End',
                    'Pix_WhileLoopEnd', 'While Loop End'
                ]
                if class_type not in loop_node_types:
                    parent_ids.append(display_id)
                if parent_id not in upstream:
                    upstream[parent_id] = []
                    self.explore_dependencies(parent_id, dynprompt, upstream, parent_ids)
                upstream[parent_id].append(node_id)

    def collect_contained(self, node_id, upstream, contained):
        if node_id not in upstream:
            return
        for child_id in upstream[node_id]:
            if child_id not in contained:
                contained[child_id] = True
                self.collect_contained(child_id, upstream, contained)

    def while_loop_close(self, flow, condition, dynprompt=None, unique_id=None, **kwargs):
        if not condition:
            return tuple(kwargs.get("initial_value_%d" % i, None) for i in range(1, MAX_FLOW_NUM + 1))

        from comfy_execution.graph_utils import GraphBuilder, is_link
        
        upstream = {}
        parent_ids = []
        self.explore_dependencies(unique_id, dynprompt, upstream, parent_ids)
        
        graph = GraphBuilder()
        contained = {}
        
        if flow is None or len(flow) == 0:
             return tuple([None] * MAX_FLOW_NUM)

        open_node = flow[0]
        self.collect_contained(open_node, upstream, contained)
        contained[unique_id] = True
        contained[open_node] = True

        for node_id in contained:
            original_node = dynprompt.get_node(node_id)
            node = graph.node(original_node["class_type"], "Recurse" if node_id == unique_id else node_id)
            node.set_override_display_id(node_id)
            
        for node_id in contained:
            original_node = dynprompt.get_node(node_id)
            node = graph.lookup_node("Recurse" if node_id == unique_id else node_id)
            for k, v in original_node["inputs"].items():
                if is_link(v) and v[0] in contained:
                    parent = graph.lookup_node(v[0])
                    node.set_input(k, parent.out(v[1]))
                else:
                    node.set_input(k, v)

        new_open = graph.lookup_node(open_node)
        for i in range(1, MAX_FLOW_NUM + 1):
            key = "initial_value_%d" % i
            new_open.set_input(key, kwargs.get(key, None))
            
        my_clone = graph.lookup_node("Recurse")
        # 注意：此处依然使用 range(MAX_FLOW_NUM) 0~19，因为这里读取的是底层节点输出槽的原始物理索引（固定20个槽）
        result = [my_clone.out(i) for i in range(MAX_FLOW_NUM)]
        
        return {
            "result": tuple(result),
            "expand": graph.finalize(),
        }

NODE_CLASS_MAPPINGS = {
    "Pix_WhileLoopStart": whileLoopStart,
    "Pix_WhileLoopEnd": whileLoopEnd
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_WhileLoopStart": "While Loop Start",
    "Pix_WhileLoopEnd": "While Loop End"
}