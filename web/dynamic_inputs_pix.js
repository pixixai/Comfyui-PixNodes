import { app } from "../../../scripts/app.js";

/**
 * PixNodes 动态插槽管理器 (紧凑模式 Compact Edition + Auto Resize)
 * 特性：
 * 1. 自动前移：中间端口断开后会自动消失，后方端口自动补位
 * 2. 自动重命名：保持端口序号连续 (1, 2, 3...)
 * 3. 自动末尾维护：始终保留一个空闲端口在末尾待命
 * 4. 自动高度适配：增删端口后自动调整节点高度
 * 5. 分组限制：仅对 "PixNodes" 分组下的节点生效
 */

app.registerExtension({
    name: "PixNodes.DynamicInputs",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // 1. [新增] 检查节点分类，仅处理 PixNodes 分组下的节点
        // 注意：ComfyUI 的分类通常以字符串形式存在，如 "PixNodes/Image"
        // 使用 optional chaining (?.) 防止 category 为 undefined 导致报错
        if (!nodeData.category?.startsWith("PixNodes")) {
            return;
        }
        
        if (nodeType.__dynamicInputsPatched) return;

        // 寻找动态输入模式（例如 image_1）
        let dynamicInput = null;
        const allInputs = { ...(nodeData.input?.required || {}), ...(nodeData.input?.optional || {}) };
        
        for (const name in allInputs) {
            if (name.endsWith("_1")) {
                dynamicInput = {
                    name: name,
                    prefix: name.slice(0, -1), // e.g., "image_"
                    type: allInputs[name][0]
                };
                break;
            }
        }

        if (dynamicInput) {
            nodeType.__dynamicInputsPatched = true;
            const { prefix, type: dataType } = dynamicInput;

            console.log(`%c[PixNodes] Dynamic Inputs Active: ${nodeData.name}`, "color:green; font-weight:bold;");

            // --- 核心逻辑：端口紧凑化与尺寸维护 ---
            nodeType.prototype.ensureDynamicInputs = function() {
                if (!this.inputs) return;

                // 1. 获取所有属于该组的动态输入
                const dynamicInputs = this.inputs.filter(i => i.name.startsWith(prefix));
                
                // 2.【消除间隙】检测并移除中间的空闲插槽
                const inputsToRemove = [];
                for (let i = 0; i < dynamicInputs.length; i++) {
                    const currentInput = dynamicInputs[i];
                    if (!currentInput.link) {
                        // 检查它后面是否还有任何已连接的端口
                        const hasSubsequentLink = dynamicInputs.slice(i + 1).some(sub => sub.link);
                        if (hasSubsequentLink) {
                            inputsToRemove.push(currentInput);
                        }
                    }
                }

                // 执行移除
                for (const input of inputsToRemove) {
                    const realIndex = this.inputs.indexOf(input);
                    if (realIndex !== -1) {
                        this.removeInput(realIndex);
                    }
                }

                // 3.【重命名】重新获取列表并修正序号，确保连续
                const compactInputs = this.inputs.filter(i => i.name.startsWith(prefix));
                compactInputs.forEach((input, index) => {
                    input.name = `${prefix}${index + 1}`;
                    input.label = `${prefix}${index + 1}`; // 同步更新标签
                });

                // 4.【末尾维护】确保最后只有一个空闲端口
                const lastInput = compactInputs[compactInputs.length - 1];
                
                if (lastInput) {
                    // 情况 A: 最后一个端口被连上了 -> 增加一个新的
                    if (lastInput.link) {
                        const nextIndex = compactInputs.length + 1;
                        this.addInput(`${prefix}${nextIndex}`, dataType);
                    } 
                    // 情况 B: 倒数第一个和倒数第二个都空着 -> 删掉多余的
                    else if (compactInputs.length > 1) {
                        const prevInput = compactInputs[compactInputs.length - 2];
                        if (!prevInput.link) {
                            const realIndex = this.inputs.indexOf(lastInput);
                            if (realIndex !== -1) {
                                this.removeInput(realIndex);
                            }
                        }
                    }
                }

                // 5.【自动高度适配】
                const minSize = this.computeSize();
                this.size[0] = Math.max(this.size[0], minSize[0]);
                this.size[1] = minSize[1];
                
                // 触发重绘
                this.setDirtyCanvas(true, true);
            };

            // --- Hook 1: 连接改变时触发 ---
            const onConnectionsChange = nodeType.prototype.onConnectionsChange;
            nodeType.prototype.onConnectionsChange = function (type, index, connected, link_info) {
                if (onConnectionsChange) onConnectionsChange.apply(this, arguments);
                
                if (type === 1) { // 仅处理输入
                    setTimeout(() => {
                        if (this.ensureDynamicInputs) {
                            this.ensureDynamicInputs();
                            app.canvas.setDirty(true);
                        }
                    }, 20);
                }
            };

            // --- Hook 2: 加载/刷新时触发 ---
            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function() {
                if (onConfigure) onConfigure.apply(this, arguments);
                
                setTimeout(() => {
                    if (this.ensureDynamicInputs) {
                        this.ensureDynamicInputs();
                        app.canvas.setDirty(true);
                    }
                }, 100);
            };

            // --- Hook 3: 新建节点时触发 ---
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                if (onNodeCreated) onNodeCreated.apply(this, arguments);
                
                setTimeout(() => {
                    if (this.ensureDynamicInputs) {
                        this.ensureDynamicInputs();
                    }
                }, 20);
            }
        }
    },
});