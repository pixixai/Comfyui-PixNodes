import torch

# --------------------------------------------------------------------------------
# AlwaysEqualProxy: Allows the node to connect to any type of slot
# --------------------------------------------------------------------------------
class AlwaysEqualProxy(str):
    def __eq__(self, _): return True
    def __ne__(self, _): return False

any_type = AlwaysEqualProxy("*")

class ListFromLoop:
    """
    List From Loop (PixNodes)
    Collects and accumulates data items during a loop iteration.
    Supports automatic batch splitting for images.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "list_in": (any_type, {
                    "forceInput": True, 
                    "tooltip": "The list from the Loop Start node or the previous iteration of this node."
                }),
                "item": (any_type, {
                    "forceInput": True,
                    "tooltip": "The new data item produced in the current iteration."
                }),
                "split_items": ("BOOLEAN", {
                    "default": True, 
                    "label_on": "Split", 
                    "label_off": "Keep",
                    "tooltip": "If True, splits image batches into individual images before appending."
                }),
            },
            "optional": {
                "reset_debug": ("BOOLEAN", {
                    "default": False, 
                    "label_on": "Reset", 
                    "label_off": "Normal",
                    "tooltip": "Manual reset switch for debugging. If True, clears the list."
                }),
            }
        }

    RETURN_TYPES = (any_type, "INT")
    RETURN_NAMES = ("list", "count")
    FUNCTION = "accumulate"
    CATEGORY = "PixNodes/loop"

    def accumulate(self, list_in=None, item=None, split_items=True, reset_debug=False):
        # 1. Initialize or Reset logic
        if reset_debug or list_in is None or not isinstance(list_in, list):
            new_list = []
        else:
            # Shallow copy to ensure data independence
            new_list = list(list_in) 
        
        # 2. Accumulation logic
        if item is not None:
            if split_items:
                if isinstance(item, str):
                    # Keep strings as a whole to avoid character-wise splitting
                    new_list.append(item)
                elif isinstance(item, torch.Tensor):
                    # Handle ComfyUI Image Batches [B, H, W, C]
                    if item.ndim == 4 and item.shape[0] > 1:
                        for i in range(item.shape[0]):
                            new_list.append(item[i:i+1])
                    else:
                        new_list.append(item)
                elif isinstance(item, list):
                    new_list.extend(item)
                else:
                    try:
                        new_list.extend(item)
                    except:
                        new_list.append(item)
            else:
                new_list.append(item)
            
        return (new_list, len(new_list))

# --------------------------------------------------------------------------------
# Node Mappings
# --------------------------------------------------------------------------------
NODE_CLASS_MAPPINGS = {
    "Pix_ListFromLoop": ListFromLoop
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_ListFromLoop": "List from Loop (PixNodes)"
}