import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "PixNodes.JsonObjectCombine",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // 匹配 Python 中的注册名称
        if (nodeData.name === "Pix_JsonObjectCombine") {
            
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated?.apply(this, arguments);

                // 找到多行文本框控件
                const keysWidget = this.widgets.find(w => w.name === "merge_keys");
                
                const updateInputs = () => {
                    const text = keysWidget.value || "";
                    // 解析 Key，去除空白行
                    const targetKeys = text.split("\n").map(k => k.trim()).filter(k => k !== "");
                    
                    if (!this.inputs) {
                        this.inputs = [];
                    }

                    // 1. 获取现有端口名称
                    const existingInputNames = this.inputs.map(i => i.name);

                    // 2. 添加新端口
                    for (const key of targetKeys) {
                        if (!existingInputNames.includes(key)) {
                            // 关键：使用 "*" 作为类型，表示通配符
                            // 配合 Python 端的 AnyType 逻辑（虽然这里主要是 JS 层的允许连接）
                            this.addInput(key, "*");
                        }
                    }

                    // 3. 删除多余端口
                    // 从后往前遍历，避免索引问题
                    for (let i = this.inputs.length - 1; i >= 0; i--) {
                        const inputName = this.inputs[i].name;
                        // 如果当前端口名不在新的 Key 列表中，则移除
                        // 注意：这里假设所有非 widget 输入都是动态生成的。
                        // 如果有静态定义的 required 输入，需要在这里排除它们不被删除。
                        if (!targetKeys.includes(inputName)) {
                            this.removeInput(i);
                        }
                    }
                    
                    // 触发布局更新和重绘
                    if (this.onResize) {
                        this.onResize(this.size);
                    }
                    app.graph.setDirtyCanvas(true, true);
                };

                // 将更新函数绑定到 Widget 的回调上
                keysWidget.callback = updateInputs;
                
                // 节点初始化时触发一次，恢复状态
                setTimeout(() => {
                    updateInputs();
                }, 50);
            };

            // 处理配置加载（例如从保存的工作流加载时）
            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function() {
                onConfigure?.apply(this, arguments);
                const keysWidget = this.widgets.find(w => w.name === "merge_keys");
                if (keysWidget) {
                    keysWidget.callback(keysWidget.value);
                }
            }
        }
    }
});