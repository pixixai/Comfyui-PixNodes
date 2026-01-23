import { app } from "../../scripts/app.js";

/**
 * PixNodes - JSON List Editor Extension (Ordered List)
 * 基于 CreateJsonObject 修改，Key 变为自动索引 (Index)。
 */

// 1. 注入 CSS 样式 (使用 pix-list- 前缀以区分)
const style = document.createElement("style");
style.textContent = `
    .pix-list-container {
        font-family: sans-serif;
        font-size: 12px;
        color: var(--input-text);
        background: var(--comfy-input-bg);
        border-radius: 4px;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        border: 1px solid var(--border-color);
        overflow-y: auto; 
        overflow-x: hidden;
        padding-bottom: 32px; 
        padding-top: 8px; 
        pointer-events: auto; 
        position: relative;
        width: 100%;
        height: 100%;
        outline: none;
    }
    .pix-list-container::-webkit-scrollbar { width: 6px; }
    .pix-list-container::-webkit-scrollbar-track { background: transparent; }
    .pix-list-container::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }
    .pix-list-container::-webkit-scrollbar-thumb:hover { background: #888; }

    .pix-list-row {
        display: flex;
        align-items: flex-start; 
        padding: 6px 8px 6px 8px; 
        margin: 0 8px 6px 8px; 
        position: relative;
        transition: background 0.1s, border-color 0.1s;
        flex-shrink: 0;
        
        background: rgba(0, 0, 0, 0.2); 
        border: 1px solid rgba(255, 255, 255, 0.1); 
        border-left: 4px solid rgba(255, 255, 255, 0.15); 
        border-radius: 6px;
    }
    
    .pix-list-row.dragging { opacity: 0.4; background: var(--comfy-input-bg); }
    
    .pix-list-row.focused,
    .pix-list-row.selected { 
        background: rgba(0, 0, 0, 0.2); 
        /* 修改：选中状态的边框颜色 */
        border-color: #30b0e6 !important; 
        border-left-color: #30b0e6 !important;
    }

    .pix-list-drop-indicator {
        position: absolute; left: 0; right: 0; height: 2px;
        background-color: #2196F3; pointer-events: none; z-index: 100;
        box-shadow: 0 0 4px rgba(33, 150, 243, 0.5); display: none;
    }

    .pix-list-handle {
        position: absolute; left: 0; top: 0; bottom: 0;
        width: 12px; cursor: grab; z-index: 10;
    }
    .pix-list-handle:active { cursor: grabbing; }

    .pix-list-wrapper {
        display: flex; flex-direction: column; width: 100%; padding-right: 0; 
    }

    /* 索引样式 (原 Key 样式，但不可编辑) */
    .pix-idx-display {
        width: 100%; background: transparent; border: none; outline: none;
        resize: none; overflow: hidden; line-height: 1.4;
        font-family: inherit; display: block;
        /* 修改：未选中状态的索引颜色 */
        color: #0a4890; 
        font-weight: bold;
        font-size: 9px; 
        /* border-bottom: 1px solid rgba(255, 255, 255, 0.15);  已移除横线 */
        padding-bottom: 1px; /* 减小下方内边距 */
        margin-bottom: 1px;  /* 减小下方外边距，让 value 向上靠 */
        transition: color 0.1s;
        cursor: default;
        user-select: none; /* 防止索引被选中文本 */
    }
    /* 移除 empty before 逻辑，因为索引永远有值 */

    .pix-val-input {
        width: 100%; background: transparent; border: none; outline: none;
        resize: none; overflow: hidden; line-height: 1.5;
        font-family: inherit; display: block;
        color: #777777;
        font-size: 10px;
        min-height: 18px;
        transition: color 0.1s;
    }
    .pix-val-input:empty::before {
        content: attr(placeholder); color: #555; pointer-events: none;
    }
    .pix-val-input.invalid-value { color: #ff5252 !important; }

    .pix-list-row.selected .pix-idx-display,
    .pix-list-row.focused .pix-idx-display { 
        /* 修改：选中状态的索引颜色 */
        color: #30b0e6; 
        /* border-bottom-color: rgba(255, 255, 255, 0.3); 已移除横线颜色变化 */
    }
    .pix-list-row.selected .pix-val-input, 
    .pix-list-row.focused .pix-val-input { 
        color: #ffffff; 
    }

    .pix-list-type {
        font-size: 9px; 
        padding: 0; 
        background: transparent; 
        color: #666; 
        position: absolute; 
        right: 24px; 
        top: 6px; /* 调整垂直对齐，从 4px 改为 6px */
        line-height: 14px; 
        opacity: 0; 
        pointer-events: none; 
        text-transform: uppercase; 
        font-weight: normal; 
    }
    .pix-list-row.focused .pix-list-type, .pix-list-row.selected .pix-list-type { opacity: 0.6; }

    .pix-list-del {
        position: absolute; right: 4px; 
        top: 6px; /* 调整垂直对齐，从 4px 改为 6px */
        cursor: pointer;
        opacity: 0; font-weight: bold; text-align: center;
        width: 14px; height: 14px; line-height: 13px; font-size: 10px;
        border-radius: 50%; background: rgba(255,255,255,0.1); color: #888;
        transition: opacity 0.1s, background 0.1s; display: none; z-index: 20; 
    }
    .pix-list-del:hover { background: #ff5252; color: #fff; }
    
    .pix-list-row:hover .pix-list-del,
    .pix-list-row.focused .pix-list-del,
    .pix-list-row.selected .pix-list-del { opacity: 1; display: block; }

    .pix-list-add-zone {
        height: 24px; margin: 6px 12px; display: flex;
        align-items: center; justify-content: center;
        cursor: pointer; opacity: 0.5; color: #666; 
        font-size: 18px; font-weight: bold; user-select: none;
        border: 1px dashed #555; border-radius: 12px; transition: all 0.2s;
    }
    .pix-list-add-zone:hover { 
        opacity: 1; background: rgba(255,255,255,0.05); color: #fff; border-color: #888;
    }

    .pix-ctx-menu {
        position: fixed; background: #222; border: 1px solid #555;
        z-index: 9999; padding: 4px 0; border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5); min-width: 120px;
    }
    .pix-ctx-item { padding: 6px 12px; cursor: pointer; color: #ddd; font-size: 12px; }
    .pix-ctx-item:hover { background: #2196F3; color: white; }
`;
document.head.appendChild(style);

app.registerExtension({
    name: "PixNodes.CreateJsonList",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "Pix_CreateJsonList") return;

        const onConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function() {
            const r = onConfigure ? onConfigure.apply(this, arguments) : undefined;
            if (this.populatePixData) this.populatePixData();
            return r;
        };

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;

            const storageWidget = this.widgets.find(w => w.name === "json_data");
            if (storageWidget) {
                storageWidget.type = "hidden";
                storageWidget.computeSize = () => [0, -4];
            }

            const container = document.createElement("div");
            container.className = "pix-list-container";
            container.tabIndex = -1;

            const stopPropagation = (e) => e.stopPropagation();
            
            this.pendingDeselect = null; 

            container.addEventListener("mousedown", (e) => {
                if (e.target === container || e.target === addZone) {
                    this.pixData.selection.clear();
                    updateSelectionUI();
                }
            });

            // 复制逻辑修改：只复制 Value
            const handleCopy = (e) => {
                e.stopPropagation();
                if (this.pixData.selection.size > 0) {
                    const selectedRows = Array.from(this.pixData.selection)
                        .sort((a, b) => this.pixData.rows.indexOf(a) - this.pixData.rows.indexOf(b));
                    
                    if (selectedRows.length === 1) {
                        const sel = window.getSelection();
                        if (sel && !sel.isCollapsed && container.contains(sel.anchorNode)) return;
                    }

                    e.preventDefault();
                    // 列表复制，只取值，逗号分隔
                    const clipData = selectedRows.map(r => {
                        return `${r.valInput.innerText}`;
                    }).join(",\n");
                    
                    if (e.clipboardData) e.clipboardData.setData('text/plain', `[\n${clipData}\n]`);
                }
            };

            container.addEventListener("paste", stopPropagation);
            container.addEventListener("cut", stopPropagation);
            container.addEventListener("copy", handleCopy);
            
            container.addEventListener("keydown", (e) => {
                 if ((e.ctrlKey || e.metaKey) && ["c", "v", "x", "a"].includes(e.key.toLowerCase())) {
                     if (container.contains(document.activeElement)) e.stopPropagation();
                 }
            });

            const dropIndicator = document.createElement("div");
            dropIndicator.className = "pix-list-drop-indicator";
            container.appendChild(dropIndicator);

            this.pixData = {
                rows: [], 
                selection: new Set(), 
                lastFocusedIndex: -1 
            };

            // 核心功能：更新索引
            const updateIndices = () => {
                this.pixData.rows.forEach((row, index) => {
                    row.keyInput.innerText = `[ ${index} ]`; // 修改为带方括号且带空格的格式
                });
            };

            const updateSelectionUI = () => {
                this.pixData.rows.forEach(r => {
                    if (this.pixData.selection.has(r)) r.el.classList.add("selected");
                    else r.el.classList.remove("selected");
                });
            };

            const saveData = () => {
                const data = this.pixData.rows.map(row => {
                    let valStr = row.valInput.innerText.replace(/\u200B/g, "");
                    // 列表模式不需要存储 Key，只存 Value 和 Type
                    let finalVal = valStr;

                    if (row.dataType === 'number') {
                        const num = Number(valStr);
                        finalVal = isNaN(num) ? 0 : num;
                    } else if (row.dataType === 'boolean') {
                        const lower = valStr.toLowerCase();
                        finalVal = (lower === 'true' || lower === '1');
                    } else if (row.dataType === 'json') {
                        try { finalVal = JSON.parse(valStr); } catch(e) {}
                    }
                    
                    return {
                        value: finalVal,
                        type: row.dataType
                    };
                });
                
                storageWidget.value = JSON.stringify(data, null, 2);
                if (storageWidget.callback) storageWidget.callback(storageWidget.value);
            };

            function getCaretPosition(element) {
                let position = 0;
                const sel = window.getSelection();
                if (sel.rangeCount > 0) {
                    const range = sel.getRangeAt(0);
                    const preCaretRange = range.cloneRange();
                    preCaretRange.selectNodeContents(element);
                    preCaretRange.setEnd(range.endContainer, range.endOffset);
                    position = preCaretRange.toString().length;
                }
                return position;
            }

            function setCaretPosition(element, pos) {
                const range = document.createRange();
                const sel = window.getSelection();
                let charCount = 0, found = false;
                
                function traverse(node) {
                    if (found) return;
                    if (node.nodeType === 3) { 
                        const nextCharCount = charCount + node.length;
                        if (pos <= nextCharCount) {
                            range.setStart(node, pos - charCount);
                            range.collapse(true);
                            found = true;
                        }
                        charCount = nextCharCount;
                    } else {
                        for (let i = 0; i < node.childNodes.length; i++) traverse(node.childNodes[i]);
                    }
                }
                traverse(element);
                if (!found) {
                    range.selectNodeContents(element);
                    range.collapse(false);
                }
                sel.removeAllRanges();
                sel.addRange(range);
            }

            const updateRowStatus = (rowObj) => {
                const type = rowObj.dataType;
                const input = rowObj.valInput;
                const val = input.innerText.trim();

                if (type === 'string') input.setAttribute('placeholder', 'Value (Text)...');
                else if (type === 'number') input.setAttribute('placeholder', 'Value (0)...');
                else if (type === 'boolean') input.setAttribute('placeholder', 'Value (true/false)...');
                else if (type === 'json') input.setAttribute('placeholder', 'Value ({ } / [ ])...');
                
                input.classList.remove('invalid-value');
                if (val === '') return;

                if (type === 'boolean') {
                    if (!['true', 'false', '0', '1'].includes(val.toLowerCase())) input.classList.add('invalid-value');
                } else if (type === 'number') {
                    if (isNaN(Number(val))) input.classList.add('invalid-value');
                }
            };

            // 创建行 (Key 参数被移除，改为自动计算)
            // 修改：增加 shouldFocus 参数，默认 true
            const createRow = (valData = "", type = "string", insertBeforeEl = null, shouldFocus = true) => {
                const rowEl = document.createElement("div");
                rowEl.className = "pix-list-row";
                rowEl.draggable = true;

                const handle = document.createElement("div");
                handle.className = "pix-list-handle";
                handle.innerHTML = ``; 
                rowEl.appendChild(handle);

                const wrapper = document.createElement("div");
                wrapper.className = "pix-list-wrapper";
                rowEl.appendChild(wrapper);

                // Index Display (原 Key Input)
                const keyInput = document.createElement("div");
                keyInput.className = "pix-idx-display"; // 使用新类名
                keyInput.contentEditable = false; // 禁用编辑
                keyInput.spellcheck = false;
                keyInput.innerText = "[ 0 ]"; // 初始占位，稍后更新，带空格
                wrapper.appendChild(keyInput);

                const valInput = document.createElement("div");
                valInput.className = "pix-val-input";
                valInput.contentEditable = true;
                valInput.spellcheck = false;
                
                if (typeof valData === 'object') valInput.innerText = JSON.stringify(valData);
                else valInput.innerText = String(valData);
                wrapper.appendChild(valInput);

                const typeTag = document.createElement("div");
                typeTag.className = "pix-list-type";
                typeTag.innerText = type.substr(0, 3);
                rowEl.appendChild(typeTag);

                const delBtn = document.createElement("div");
                delBtn.className = "pix-list-del";
                delBtn.innerText = "×";
                delBtn.title = "Delete";
                rowEl.appendChild(delBtn);

                const rowObj = { el: rowEl, keyInput, valInput, typeTag, dataType: type };
                this.pixData.rows.push(rowObj);
                updateRowStatus(rowObj);

                // --- 输入事件 ---
                valInput.addEventListener("paste", (e) => {
                    e.preventDefault(); e.stopPropagation();
                    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
                    document.execCommand("insertText", false, text);
                });
                valInput.addEventListener("cut", stopPropagation);
                valInput.addEventListener("input", () => {
                    updateRowStatus(rowObj);
                    saveData();
                });

                // Key (Index) 不再需要键盘事件，因为它不可聚焦

                // Value 键盘 - 逻辑优化
                valInput.addEventListener("keydown", (e) => {
                    const idx = this.pixData.rows.indexOf(rowObj);

                    if (e.key === "Enter") {
                        if (!e.shiftKey) {
                            e.preventDefault();
                            const caretPos = getCaretPosition(valInput);
                            const text = valInput.innerText;
                            const textBefore = text.slice(0, caretPos);
                            const textAfter = text.slice(caretPos);
                            
                            valInput.innerText = textBefore; 
                            
                            const nextRowEl = this.pixData.rows[idx + 1] ? this.pixData.rows[idx + 1].el : null;
                            // 插入新行
                            createRow(textAfter, "string", nextRowEl);
                            
                            saveData();
                            updateRowStatus(rowObj);
                            
                            // 聚焦到新行的 Value (跳过 Index)
                            const createdRow = this.pixData.rows[idx + 1];
                            if (createdRow) {
                                setTimeout(() => createdRow.valInput.focus(), 5);
                            }
                        }
                    } 
                    else if (e.key === "Backspace") {
                        if (getCaretPosition(valInput) === 0 && window.getSelection().isCollapsed) {
                            // 如果是空行或者光标在最前，删除当前行，聚焦上一行 Value
                            if (idx > 0) {
                                e.preventDefault();
                                const prevRow = this.pixData.rows[idx - 1];
                                prevRow.valInput.focus();
                                setCaretPosition(prevRow.valInput, prevRow.valInput.innerText.length);
                                
                                // 简单的删除逻辑：如果当前行是空的，直接删。如果不空，可能需要合并（此处简化为不自动合并文本，交由用户处理）
                                // 这里模仿 CreateJsonObject 行为：直接跳转焦点。
                                // 但如果用户想删除行，通常是全选删除。
                                // 只有当行内容为空时，我们才辅助删除行。
                                if (valInput.innerText.trim() === "") {
                                     rowEl.remove();
                                     this.pixData.rows.splice(idx, 1);
                                     updateIndices();
                                     saveData();
                                }
                            }
                        }
                    }
                    else if (e.key === "ArrowUp") {
                        if (valInput.innerText.indexOf('\n') === -1) {
                             e.preventDefault();
                             if (idx > 0) {
                                 this.pixData.rows[idx-1].valInput.focus();
                             }
                        }
                    }
                    else if (e.key === "ArrowDown") {
                        if (idx < this.pixData.rows.length - 1) {
                             if (valInput.innerText.indexOf('\n') === -1) {
                                e.preventDefault();
                                this.pixData.rows[idx+1].valInput.focus();
                             }
                        }
                    }
                });

                // 点击逻辑
                rowEl.addEventListener("mousedown", (e) => {
                    if (e.target === delBtn) return;
                    
                    if (e.ctrlKey || e.metaKey) {
                        e.stopPropagation(); e.preventDefault(); 
                        if (this.pixData.selection.has(rowObj)) {
                            this.pixData.selection.delete(rowObj);
                        } else {
                            this.pixData.selection.add(rowObj);
                            this.pixData.lastFocusedIndex = this.pixData.rows.indexOf(rowObj);
                        }
                        updateSelectionUI();
                        return;
                    }

                    if (e.shiftKey) {
                        e.stopPropagation(); e.preventDefault();
                        if (this.pixData.lastFocusedIndex === -1) {
                             this.pixData.lastFocusedIndex = this.pixData.rows.indexOf(rowObj);
                        }
                        this.pixData.selection.clear(); 
                        const currentIdx = this.pixData.rows.indexOf(rowObj);
                        const start = Math.min(this.pixData.lastFocusedIndex, currentIdx);
                        const end = Math.max(this.pixData.lastFocusedIndex, currentIdx);
                        for(let i=start; i<=end; i++) this.pixData.selection.add(this.pixData.rows[i]);
                        updateSelectionUI();
                        return;
                    }

                    if (e.button === 2) { 
                        if (!this.pixData.selection.has(rowObj)) {
                            this.pixData.selection.clear();
                            this.pixData.selection.add(rowObj);
                            this.pixData.lastFocusedIndex = this.pixData.rows.indexOf(rowObj);
                            updateSelectionUI();
                        }
                        return;
                    }

                    if (e.button === 0) {
                        e.stopPropagation();
                        if (this.pixData.selection.has(rowObj) && this.pixData.selection.size > 1) {
                            this.pendingDeselect = rowObj;
                        } else {
                            if (!this.pixData.selection.has(rowObj)) {
                                this.pixData.selection.clear();
                                this.pixData.selection.add(rowObj);
                                updateSelectionUI();
                            }
                            this.pixData.lastFocusedIndex = this.pixData.rows.indexOf(rowObj);
                        }
                    }
                });

                rowEl.addEventListener("mouseup", (e) => {
                    if (e.button === 0 && this.pendingDeselect === rowObj) {
                        this.pixData.selection.clear();
                        this.pixData.selection.add(rowObj);
                        updateSelectionUI();
                        this.pixData.lastFocusedIndex = this.pixData.rows.indexOf(rowObj);
                        this.pendingDeselect = null;
                    }
                });

                const onFocus = () => {
                    this.pixData.rows.forEach(r => r.el.classList.remove("focused"));
                    rowEl.classList.add("focused");
                    
                    if (!this.pixData.selection.has(rowObj)) {
                        this.pixData.selection.clear();
                        this.pixData.selection.add(rowObj);
                        this.pixData.lastFocusedIndex = this.pixData.rows.indexOf(rowObj);
                        updateSelectionUI();
                    }
                };
                
                valInput.addEventListener("focus", onFocus);
                
                const onBlur = () => rowEl.classList.remove("focused");
                valInput.addEventListener("blur", onBlur);

                delBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (this.pixData.selection.has(rowObj) && this.pixData.selection.size > 1) {
                        Array.from(this.pixData.selection).forEach(r => {
                            r.el.remove();
                            const i = this.pixData.rows.indexOf(r);
                            if (i > -1) this.pixData.rows.splice(i, 1);
                        });
                        this.pixData.selection.clear();
                    } else {
                        rowEl.remove();
                        const i = this.pixData.rows.indexOf(rowObj);
                        if (i > -1) this.pixData.rows.splice(i, 1);
                    }
                    updateIndices(); // 删除后更新索引
                    saveData();
                });

                rowEl.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    const targets = Array.from(this.pixData.selection);
                    showContextMenu(e.clientX, e.clientY, (newType) => {
                        targets.forEach(t => {
                            t.dataType = newType;
                            t.typeTag.innerText = newType.substr(0, 3);
                            updateRowStatus(t);
                        });
                        saveData();
                    });
                });

                rowEl.addEventListener("dragstart", (e) => {
                    this.pendingDeselect = null;
                    if (!this.pixData.selection.has(rowObj)) {
                        this.pixData.selection.clear();
                        this.pixData.selection.add(rowObj);
                        updateSelectionUI();
                    }
                    e.dataTransfer.effectAllowed = "move";
                    this.pixData.selection.forEach(r => r.el.classList.add("dragging"));
                });
                
                rowEl.addEventListener("dragend", () => {
                    this.pixData.selection.forEach(r => r.el.classList.remove("dragging"));
                    dropIndicator.style.display = "none";
                    updateIndices(); // 拖拽结束后更新索引
                    saveData();
                });

                if (insertBeforeEl) container.insertBefore(rowEl, insertBeforeEl);
                else container.insertBefore(rowEl, addZone);

                rebuildRowsArray();
                updateIndices(); // 创建行后更新索引
                
                if (!insertBeforeEl && shouldFocus) setTimeout(() => valInput.focus(), 0);
            };

            const rebuildRowsArray = () => {
                const newRows = [];
                const domRows = container.querySelectorAll('.pix-list-row');
                domRows.forEach(el => {
                    const found = this.pixData.rows.find(r => r.el === el);
                    if (found) newRows.push(found);
                });
                this.pixData.rows = newRows;
            };

            const addZone = document.createElement("div");
            addZone.className = "pix-list-add-zone";
            addZone.innerText = "+"; 
            addZone.title = "Add new item";
            container.appendChild(addZone);

            addZone.onclick = (e) => {
                e.preventDefault();
                createRow();
                saveData();
            };

            container.addEventListener("dragover", (e) => {
                e.preventDefault();
                const after = getDragAfterElement(container, e.clientY);
                dropIndicator.style.display = "block";
                if (after) dropIndicator.style.top = after.offsetTop + "px";
                else dropIndicator.style.top = addZone.offsetTop + "px";
            });

            container.addEventListener("drop", (e) => {
                e.preventDefault();
                const dragging = Array.from(this.pixData.selection);
                if (!dragging.length) return;
                
                const after = getDragAfterElement(container, e.clientY);
                dragging.sort((a,b) => this.pixData.rows.indexOf(a) - this.pixData.rows.indexOf(b));
                
                dragging.forEach(r => {
                    if (!after) container.insertBefore(r.el, addZone);
                    else container.insertBefore(r.el, after);
                });
                rebuildRowsArray();
                updateIndices(); // 放置后更新索引
                saveData();
            });

            function getDragAfterElement(container, y) {
                const els = [...container.querySelectorAll('.pix-list-row:not(.dragging)')];
                return els.reduce((closest, child) => {
                    const box = child.getBoundingClientRect();
                    const offset = y - box.top - box.height / 2;
                    if (offset < 0 && offset > closest.offset) return { offset, element: child };
                    else return closest;
                }, { offset: Number.NEGATIVE_INFINITY }).element;
            }

            const showContextMenu = (x, y, cb) => {
                const old = document.querySelector(".pix-ctx-menu");
                if (old) old.remove();
                
                const menu = document.createElement("div");
                menu.className = "pix-ctx-menu";
                menu.style.left = x + "px"; menu.style.top = y + "px";
                ["string", "number", "boolean", "json"].forEach(t => {
                    const i = document.createElement("div");
                    i.className = "pix-ctx-item";
                    i.innerText = t.charAt(0).toUpperCase() + t.slice(1);
                    i.onclick = () => { cb(t); menu.remove(); };
                    menu.appendChild(i);
                });
                document.body.appendChild(menu);
                const close = () => { menu.remove(); document.removeEventListener('click', close); };
                setTimeout(() => document.addEventListener('click', close), 10);
            };

            this.populatePixData = () => {
                this.pixData.rows.forEach(r => r.el.remove());
                this.pixData.rows = [];
                this.pixData.selection.clear();

                let listData = [];
                try { listData = JSON.parse(storageWidget.value || "[]"); } catch (e) {}
                
                if (Array.isArray(listData)) {
                    listData.forEach(item => {
                        // 兼容：如果存储的是旧的 KV 格式，尝试取 value，否则直接取 value 字段
                        const v = item.value !== undefined ? item.value : "";
                        const t = item.type || "string";
                        // 修改：populateData 时不自动聚焦
                        createRow(v, t, null, false);
                    });
                }
            };

            this.addDOMWidget("json_list_editor", "box", container, {
                getValue: () => storageWidget.value,
                setValue: (v) => {}, 
            });

            this.onResize = function (size) {
                let h = size[1] - 65; 
                if (h < 0) h = 0; 
                container.style.height = h + "px";
            };
            
            requestAnimationFrame(() => {
                if (this.onResize) this.onResize(this.size);
            });
        };
    }
});