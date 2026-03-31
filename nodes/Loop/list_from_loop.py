import torch

# --------------------------------------------------------------------------------
# AlwaysEqualProxy: 允许节点连接任意类型的插槽
# --------------------------------------------------------------------------------
class AlwaysEqualProxy(str):
    def __eq__(self, _): return True
    def __ne__(self, _): return False

any_type = AlwaysEqualProxy("*")

class ListFromLoop:
    """
    List From Loop (PixNodes)
    在循环迭代期间收集和累加数据项。
    升级版：支持智能批处理 (Smart Batching)，自动将图像和Latent合并为合法的 ComfyUI Batch。
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "list_in": (any_type, {
                    "forceInput": True, 
                    "tooltip": "来自循环开始节点或上一轮迭代的列表/Batch"
                }),
                "item": (any_type, {
                    "forceInput": True,
                    "tooltip": "当前迭代产生的新数据项"
                }),
                "split_items": ("BOOLEAN", {
                    "default": True, 
                    "label_on": "Split", 
                    "label_off": "Keep",
                    "tooltip": "如果为True，在追加之前展开列表数据"
                }),
            }
        }
        
    RETURN_TYPES = (any_type, "INT")
    RETURN_NAMES = ("collection", "length")
    FUNCTION = "accumulate"
    CATEGORY = "PixNodes/loop"

    def accumulate(self, list_in, item, split_items=True):
        # 1. 初始化收集器
        if list_in is None:
            collection = []
        elif isinstance(list_in, list):
            collection = list(list_in)
        elif isinstance(list_in, torch.Tensor):
            collection = [list_in]  # 将上一轮合并好的 Batch 转化为列表第一项
        elif isinstance(list_in, dict) and "samples" in list_in:
            collection = [list_in]  # 将上一轮的 Latent Batch 转化为第一项
        elif isinstance(list_in, str):
            collection = [list_in]  # 字符串不进行拆分
        else:
            collection = [list_in]
        
        # 2. 追加新项目
        if item is not None:
            if split_items and isinstance(item, list):
                collection.extend(item)
            else:
                collection.append(item)

        if len(collection) == 0:
            return (collection, 0)

        # ---------------------------------------------------------
        # 3. 智能批处理 (Smart Batching) - 图像/张量 Tensor
        # ---------------------------------------------------------
        if all(isinstance(x, torch.Tensor) for x in collection):
            # 检查除 Batch 维度外的形状是否一致 (如 H, W, C 必须相同才能拼合)
            first_shape = collection[0].shape[1:]
            if all(x.shape[1:] == first_shape for x in collection):
                # 使用 torch.cat 沿着第 0 维 (Batch维) 将它们合并为一个标准张量
                batch = torch.cat(collection, dim=0)
                return (batch, batch.shape[0])

        # ---------------------------------------------------------
        # 4. 智能批处理 (Smart Batching) - 潜空间数据 Latent
        # ---------------------------------------------------------
        if all(isinstance(x, dict) and "samples" in x for x in collection):
            first_shape = collection[0]["samples"].shape[1:]
            if all(x["samples"].shape[1:] == first_shape for x in collection):
                # 提取并合并所有的 samples 张量
                batch_samples = torch.cat([x["samples"] for x in collection], dim=0)
                new_latent = collection[0].copy()
                new_latent["samples"] = batch_samples
                
                # 尝试合并遮罩 noise_mask (如果存在的话)
                if "noise_mask" in collection[0]:
                    try:
                        masks = [x["noise_mask"] for x in collection if "noise_mask" in x]
                        if len(masks) == len(collection):
                            new_latent["noise_mask"] = torch.cat(masks, dim=0)
                    except Exception as e:
                        pass # 如果遮罩形状不匹配则忽略合并
                        
                return (new_latent, batch_samples.shape[0])

        # ---------------------------------------------------------
        # 5. 回退方案：对于字符串(String)、数字等，原样返回 Python 列表
        # ---------------------------------------------------------
        return (collection, len(collection))

# --------------------------------------------------------------------------------
# Node Mappings
# --------------------------------------------------------------------------------
NODE_CLASS_MAPPINGS = {
    "Pix_ListFromLoop": ListFromLoop
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_ListFromLoop": "List from Loop (PixNodes)"
}