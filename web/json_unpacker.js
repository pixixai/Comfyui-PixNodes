import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "PixNodes.JsonUnpacker",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // 锁定目标节点
        if (nodeData.name === "Pix_JsonUnpacker") {
            
            // 保存原有的 onNodeCreated 方法（如果有的话）
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            
            // 重写 onNodeCreated 方法
            nodeType.prototype.onNodeCreated = function () {
                // 先执行原有的逻辑
                onNodeCreated?.apply(this, arguments);

                // === 核心逻辑：设置默认尺寸 ===
                // 参数格式: [宽度, 高度]
                // 注意：ComfyUI 会自动限制最小尺寸，防止内容显示不全。
                // 设置一个较小的值（如 [300, 100]）会让 ComfyUI 自动压缩多行文本框的高度到最小可用值。
                this.setSize([300, 150]); 
            };
        }
    }
});