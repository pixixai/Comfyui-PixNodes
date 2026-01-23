import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "PixNodes.JsonObjectExtract",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "Pix_JsonObjectExtract") {
            
            // --- UI 防闪烁处理 ---
            if (nodeData.output && nodeData.output.length > 1) {
                nodeData.output = nodeData.output.slice(0, 1);
            }
            if (nodeData.output_name && nodeData.output_name.length > 1) {
                nodeData.output_name = nodeData.output_name.slice(0, 1);
            }

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated?.apply(this, arguments);
                
                const keysWidget = this.widgets.find(w => w.name === "match_keys");
                const mergeWidget = this.widgets.find(w => w.name === "merge_output");
                
                const updateOutputs = () => {
                    const text = keysWidget.value || "";
                    let keys = text.split("\n").map(k => k.trim()).filter(k => k !== "");
                    
                    const isMergeMode = mergeWidget ? mergeWidget.value : false;

                    // 模式判断：合并 vs 独立
                    if (isMergeMode) {
                        // 合并模式：强制 1 个输出
                        keys = ["merged_output"];
                    } else {
                        // 独立模式：至少保留 1 个输出
                        if (keys.length === 0) {
                            keys = ["object_1"];
                        }
                    }

                    const targetCount = keys.length;
                    const currentCount = this.outputs ? this.outputs.length : 0;

                    // 1. 动态增删端口
                    if (targetCount > currentCount) {
                        for (let i = currentCount; i < targetCount; i++) {
                            this.addOutput(keys[i], "STRING");
                        }
                    } 
                    else if (targetCount < currentCount) {
                        for (let i = currentCount; i > targetCount; i--) {
                            this.removeOutput(i - 1);
                        }
                    }

                    // 2. 更新端口名称
                    for (let i = 0; i < targetCount; i++) {
                        const portName = keys[i];
                        if (this.outputs[i].name !== portName || this.outputs[i].label !== portName) {
                            this.outputs[i].name = portName;
                            this.outputs[i].label = portName;
                        }
                    }

                    // 3. 刷新界面
                    if (this.onResize) {
                        this.onResize(this.size);
                    }
                    app.graph.setDirtyCanvas(true, true);
                };

                // 绑定回调到两个控件
                keysWidget.callback = updateOutputs;
                if (mergeWidget) {
                    mergeWidget.callback = updateOutputs;
                }
                
                // 初始化执行
                requestAnimationFrame(() => {
                    updateOutputs();
                });
            };

            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function() {
                onConfigure?.apply(this, arguments);
                const keysWidget = this.widgets.find(w => w.name === "match_keys");
                const mergeWidget = this.widgets.find(w => w.name === "merge_output");

                if (keysWidget) {
                    const text = keysWidget.value || "";
                    let keys = text.split("\n").map(k => k.trim()).filter(k => k !== "");
                    
                    // 读取保存的合并状态
                    const isMergeMode = mergeWidget ? mergeWidget.value : false;

                    if (isMergeMode) {
                        keys = ["merged_output"];
                    } else {
                        if (keys.length === 0) keys = ["object_1"];
                    }

                    const targetCount = keys.length;
                    while (this.outputs.length < targetCount) {
                        this.addOutput(keys[this.outputs.length], "STRING");
                    }
                    while (this.outputs.length > targetCount) {
                        this.removeOutput(this.outputs.length - 1);
                    }
                    for (let i = 0; i < targetCount; i++) {
                        this.outputs[i].name = keys[i];
                        this.outputs[i].label = keys[i];
                    }
                }
            }
        }
    }
});