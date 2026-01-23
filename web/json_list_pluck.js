import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "PixNodes.JsonListPluck",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "Pix_JsonListPluck") {
            
            if (nodeData.output && nodeData.output.length > 1) {
                nodeData.output = nodeData.output.slice(0, 1);
            }
            if (nodeData.output_name && nodeData.output_name.length > 1) {
                nodeData.output_name = nodeData.output_name.slice(0, 1);
            }

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated?.apply(this, arguments);
                
                const keysWidget = this.widgets.find(w => w.name === "filter_keys");
                const mergeWidget = this.widgets.find(w => w.name === "merge_output");
                
                const updateOutputs = () => {
                    const text = keysWidget.value || "";
                    let keys = text.split("\n").map(k => k.trim()).filter(k => k !== "");
                    
                    const isMergeMode = mergeWidget ? mergeWidget.value : false;

                    if (isMergeMode) {
                        keys = ["merged_list"];
                    } else {
                        if (keys.length === 0) {
                            keys = ["plucked_list_1"];
                        }
                    }

                    const targetCount = keys.length;
                    const currentCount = this.outputs ? this.outputs.length : 0;

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

                    for (let i = 0; i < targetCount; i++) {
                        const portName = keys[i];
                        if (this.outputs[i].name !== portName || this.outputs[i].label !== portName) {
                            this.outputs[i].name = portName;
                            this.outputs[i].label = portName;
                        }
                    }

                    if (this.onResize) {
                        this.onResize(this.size);
                    }
                    app.graph.setDirtyCanvas(true, true);
                };

                keysWidget.callback = updateOutputs;
                if (mergeWidget) {
                    mergeWidget.callback = updateOutputs;
                }
                
                requestAnimationFrame(() => {
                    updateOutputs();
                });
            };

            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function() {
                onConfigure?.apply(this, arguments);
                const keysWidget = this.widgets.find(w => w.name === "filter_keys");
                const mergeWidget = this.widgets.find(w => w.name === "merge_output");
                
                if (keysWidget) {
                    const text = keysWidget.value || "";
                    let keys = text.split("\n").map(k => k.trim()).filter(k => k !== "");
                    
                    const isMergeMode = mergeWidget ? mergeWidget.value : false;

                    if (isMergeMode) {
                        keys = ["merged_list"];
                    } else {
                        if (keys.length === 0) keys = ["plucked_list_1"];
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