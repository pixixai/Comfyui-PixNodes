import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "PixNodes.JsonListZip",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // 匹配 Python 中的节点注册名称
        if (nodeData.name === "Pix_JsonListZip") {
            
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated?.apply(this, arguments);

                // 找到参数控件：merge_keys
                const keysWidget = this.widgets.find(w => w.name === "merge_keys");
                
                const updateInputs = () => {
                    const text = keysWidget.value || "";
                    // 获取当前文本框定义的所有 Key
                    const targetKeys = text.split("\n").map(k => k.trim()).filter(k => k !== "");
                    
                    // 获取当前已存在的非 Widget 输入端口 (ComfyUI 中 inputs 数组存储连接点)
                    // 注意：我们需要小心不要删除特殊的输入（如果有的话），但这个节点全是动态输入
                    if (!this.inputs) {
                        this.inputs = [];
                    }

                    // 1. 标记所有现有的输入端口名称
                    const existingInputNames = this.inputs.map(i => i.name);

                    // 2. 找出需要添加的 Key
                    for (const key of targetKeys) {
                        if (!existingInputNames.includes(key)) {
                            // 添加新输入端口
                            // 修改：使用 "*" 表示支持任意类型输入 (原为 "STRING")
                            this.addInput(key, "*");
                        }
                    }

                    // 3. 找出需要删除的输入端口
                    // (如果现在的端口名 不在 新的Key列表中，且它不是隐藏属性等，则删除)
                    // 从后往前遍历删除，防止索引错位
                    for (let i = this.inputs.length - 1; i >= 0; i--) {
                        const inputName = this.inputs[i].name;
                        if (!targetKeys.includes(inputName)) {
                            this.removeInput(i);
                        }
                    }

                    // 4. (可选) 重新排序端口以匹配文本框顺序
                    // 这一步比较复杂，因为重排可能会断开连线，通常简单的增删已经足够。
                    // 为了用户体验，我们只做简单的标签更新，假设用户通常是追加或删除。
                    
                    // 更新尺寸
                    if (this.onResize) {
                        this.onResize(this.size);
                    }
                    app.graph.setDirtyCanvas(true, true);
                };

                // 绑定回调
                keysWidget.callback = updateInputs;
                
                // 初始化执行 (延迟一点以确保节点已完全初始化)
                setTimeout(() => {
                    updateInputs();
                }, 50);
            };

            // 处理重载/加载工作流时的状态恢复
            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function() {
                onConfigure?.apply(this, arguments);
                const keysWidget = this.widgets.find(w => w.name === "merge_keys");
                if (keysWidget) {
                    // 触发一次回调以同步端口状态
                    keysWidget.callback(keysWidget.value);
                }
            }
        }
    }
});