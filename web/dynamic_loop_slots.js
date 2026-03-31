import { app } from "../../../scripts/app.js";

/**
 * Loop 节点全自动接口同步扩展 (智能紧凑折叠版)
 * 核心逻辑：
 * 1. 扫描所有输入，自动为已连接的输入创建对应的输出。
 * 2. 移除所有未连接的输入（及其对应的输出），LiteGraph 会自动将后续端口上移并保持连线。
 * 3. 重新按 1, 2, 3... 的顺序对所有剩余的插槽进行重命名。
 * 4. 在末尾追加唯一一个未连接的输入插槽，等待下一次连接。
 */

app.registerExtension({
    name: "Comfy.LoopDynamicInterface",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        const validNodes = [
            "For Loop Start", "For Loop End", 
            "While Loop Start", "While Loop End",
            "Pix_ForLoopStart", "Pix_ForLoopEnd",
            "Pix_WhileLoopStart", "Pix_WhileLoopEnd"
        ];
        
        if (!validNodes.includes(nodeData.name)) return;

        const inPrefix = "initial_value_";
        const outPrefix = "value_";

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            if (onNodeCreated) onNodeCreated.apply(this, arguments);
            
            // 延迟执行以覆盖 ComfyUI 原生加载的 20 个默认 Optional 插槽
            setTimeout(() => {
                this._processingInterfaces = true;
                try {
                    this.cleanupLoopInterfaces(inPrefix, outPrefix);
                    this.setSize(this.computeSize());
                } finally {
                    this._processingInterfaces = false;
                    app.canvas.setDirty(true);
                }
            }, 10);
        };

        const onConnectionsChange = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function (type, index, connected, link_info) {
            if (onConnectionsChange) onConnectionsChange.apply(this, arguments);

            if (this._processingInterfaces) return;
            this._processingInterfaces = true;

            setTimeout(() => {
                try {
                    this.cleanupLoopInterfaces(inPrefix, outPrefix);
                    this.setSize(this.computeSize());
                } finally {
                    this._processingInterfaces = false;
                    app.canvas.setDirty(true);
                }
            }, 0);
        };

        nodeType.prototype.cleanupLoopInterfaces = function (inPre, outPre) {
            // 第一步：确保所有【已连接】的输入插槽，都有对应的输出插槽
            for (let i = 0; i < this.inputs.length; i++) {
                const input = this.inputs[i];
                if (input.name.startsWith(inPre) && input.link) {
                    const num = parseInt(input.name.split("_").pop());
                    const outName = `${outPre}${num}`;
                    if (!this.outputs || !this.outputs.find(o => o.name === outName)) {
                        this.addOutput(outName, "*");
                    }
                }
            }

            // 第二步：倒序遍历，删除所有【未连接】的输入插槽，以及它对应的输出插槽
            // (倒序删除是为了防止索引坍塌。LiteGraph 会自动将保留插槽的连线完好无损地上移)
            for (let i = this.inputs.length - 1; i >= 0; i--) {
                const input = this.inputs[i];
                if (input.name.startsWith(inPre) && !input.link) {
                    const num = parseInt(input.name.split("_").pop());
                    
                    this.removeInput(i);
                    
                    if (this.outputs) {
                        const outIdx = this.outputs.findIndex(o => o.name === `${outPre}${num}`);
                        if (outIdx !== -1) {
                            this.removeOutput(outIdx);
                        }
                    }
                }
            }

            // 第三步：按顺序重新命名所有遗留的插槽 (消除空隙，如 1, 3 变成 1, 2)
            let currentIdx = 1;
            
            // 重命名输入
            for (let i = 0; i < this.inputs.length; i++) {
                const input = this.inputs[i];
                if (input.name.startsWith(inPre)) {
                    input.name = `${inPre}${currentIdx}`;
                    currentIdx++;
                }
            }
            
            // 重命名输出
            let outIdx = 1;
            if (this.outputs) {
                for (let i = 0; i < this.outputs.length; i++) {
                    const output = this.outputs[i];
                    if (output.name.startsWith(outPre)) {
                        output.name = `${outPre}${outIdx}`;
                        outIdx++;
                    }
                }
            }

            // 第四步：在末尾追加唯一一个未连接的输入插槽，等待下一次用户拉线
            // 此时 currentIdx 刚好就是下一个序号
            this.addInput(`${inPre}${currentIdx}`, "*");
        };
    },
});