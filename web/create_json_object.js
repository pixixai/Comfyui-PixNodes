import { app } from "../../scripts/app.js";

/**
 * PixNodes - JSON Object Editor Extension (Key-Value Pair)
 * 继承自 CreateJsonList 的设计理念，改为 KV 键值对编辑模式。
 */

// 1. 注入 CSS 样式
const style = document.createElement("style");
style.textContent = `
    .pix-obj-container {
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
    .pix-obj-container::-webkit-scrollbar { width: 6px; }
    .pix-obj-container::-webkit-scrollbar-track { background: transparent; }
    .pix-obj-container::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }
    .pix-obj-container::-webkit-scrollbar-thumb:hover { background: #888; }

    .pix-obj-row {
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
    
    .pix-obj-row.dragging { opacity: 0.4; background: var(--comfy-input-bg); }
    
    .pix-obj-row.focused,
    .pix-obj-row.selected { 
        background: rgba(0, 0, 0, 0.2); 
        border-color: #36bf66 !important; 
        border-left-color: #36bf66 !important;
    }

    .pix-obj-drop-indicator {
        position: absolute; left: 0; right: 0; height: 2px;
        background-color: #2196F3; pointer-events: none; z-index: 100;
        box-shadow: 0 0 4px rgba(33, 150, 243, 0.5); display: none;
    }

    .pix-obj-handle {
        position: absolute; left: 0; top: 0; bottom: 0;
        width: 12px; cursor: grab; z-index: 10;
    }
    .pix-obj-handle:active { cursor: grabbing; }

    .pix-kv-wrapper {
        display: flex; flex-direction: column; width: 100%; padding-right: 0; 
    }

    /* --- 修改重点 1：Key 输入框样式调整 --- */
    .pix-key-input {
        width: 100%; background: transparent; border: none; outline: none;
        resize: none; overflow: hidden; line-height: 1.4;
        font-family: inherit; display: block;
        color: #2b6334; 
        font-weight: bold;
        font-size: 9px; 
        
        /* 修改：移除下划线 */
        border-bottom: none; 
        /* 修改：减小底部间距，让下方的 Value 文本向上移动 */
        padding-bottom: 0px;
        margin-bottom: 2px;
        
        transition: color 0.1s;
    }
    .pix-key-input:empty::before {
        content: "Key"; color: #555; pointer-events: none; font-style: italic; font-weight: normal;
    }

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

    .pix-obj-row.selected .pix-key-input,
    .pix-obj-row.focused .pix-key-input { 
        color: #36bf66; 
        /* 选中时也不显示下划线 */
        border-bottom-color: transparent; 
    }
    .pix-obj-row.selected .pix-val-input, 
    .pix-obj-row.focused .pix-val-input { 
        color: #ffffff; 
    }

    /* --- 修改重点 2：优化数据类型标签位置，与 Key 对齐 --- */
    .pix-obj-type {
        font-size: 9px; 
        padding: 0; 
        background: transparent; 
        color: #666; 
        position: absolute; 
        right: 24px; 
        
        /* 垂直对齐优化：微调 top 值以对齐 Key 文本中心 */
        top: 5px; 
        line-height: 14px; 
        
        opacity: 0; 
        pointer-events: none; 
        text-transform: uppercase; 
        font-weight: normal;
    }
    .pix-obj-row.focused .pix-obj-type, .pix-obj-row.selected .pix-obj-type { opacity: 0.6; }

    /* --- 修改重点 3：删除按钮位置，与 Key 对齐 --- */
    .pix-obj-del {
        position: absolute; right: 4px; 
        /* 垂直对齐优化 */
        top: 5px; 
        
        cursor: pointer;
        opacity: 0; font-weight: bold; text-align: center;
        width: 14px; height: 14px; line-height: 13px; font-size: 10px;
        border-radius: 50%; background: rgba(255,255,255,0.1); color: #888;
        transition: opacity 0.1s, background 0.1s; display: none; z-index: 20; 
    }
    .pix-obj-del:hover { background: #ff5252; color: #fff; }
    
    .pix-obj-row:hover .pix-obj-del,
    .pix-obj-row.focused .pix-obj-del,
    .pix-obj-row.selected .pix-obj-del { opacity: 1; display: block; }

    .pix-obj-add-zone {
        height: 24px; margin: 6px 12px; display: flex;
        align-items: center; justify-content: center;
        cursor: pointer; opacity: 0.5; color: #666; 
        font-size: 18px; font-weight: bold; user-select: none;
        border: 1px dashed #555; border-radius: 12px; transition: all 0.2s;
    }
    .pix-obj-add-zone:hover { 
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
    name: "PixNodes.CreateJsonObject",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "Pix_CreateJsonObject") return;

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
            container.className = "pix-obj-container";
            container.tabIndex = -1;

            const stopPropagation = (e) => e.stopPropagation();
            
            // 全局属性：用于处理多选后的点击逻辑
            this.pendingDeselect = null; 

            container.addEventListener("mousedown", (e) => {
                if (e.target === container || e.target === addZone) {
                    this.pixData.selection.clear();
                    updateSelectionUI();
                }
            });

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
                    const clipData = selectedRows.map(r => {
                        return `"${r.keyInput.innerText}": ${r.valInput.innerText}`;
                    }).join(",\n");
                    
                    if (e.clipboardData) e.clipboardData.setData('text/plain', `{\n${clipData}\n}`);
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
            dropIndicator.className = "pix-obj-drop-indicator";
            container.appendChild(dropIndicator);

            this.pixData = {
                rows: [], 
                selection: new Set(), 
                lastFocusedIndex: -1 
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
                    let keyStr = row.keyInput.innerText.replace(/\u200B/g, "").trim();
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
                        key: keyStr,
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

            // 修改：增加 shouldFocus 参数，默认为 true
            const createRow = (keyData = "", valData = "", type = "string", insertBeforeEl = null, shouldFocus = true) => {
                const rowEl = document.createElement("div");
                rowEl.className = "pix-obj-row";
                rowEl.draggable = true;

                const handle = document.createElement("div");
                handle.className = "pix-obj-handle";
                handle.innerHTML = ``; 
                rowEl.appendChild(handle);

                const wrapper = document.createElement("div");
                wrapper.className = "pix-kv-wrapper";
                rowEl.appendChild(wrapper);

                const keyInput = document.createElement("div");
                keyInput.className = "pix-key-input";
                keyInput.contentEditable = true;
                keyInput.spellcheck = false;
                keyInput.innerText = keyData;
                wrapper.appendChild(keyInput);

                const valInput = document.createElement("div");
                valInput.className = "pix-val-input";
                valInput.contentEditable = true;
                valInput.spellcheck = false;
                
                if (typeof valData === 'object') valInput.innerText = JSON.stringify(valData);
                else valInput.innerText = String(valData);
                wrapper.appendChild(valInput);

                const typeTag = document.createElement("div");
                typeTag.className = "pix-obj-type";
                typeTag.innerText = type.substr(0, 3);
                rowEl.appendChild(typeTag);

                const delBtn = document.createElement("div");
                delBtn.className = "pix-obj-del";
                delBtn.innerText = "×";
                delBtn.title = "Delete";
                rowEl.appendChild(delBtn);

                const rowObj = { el: rowEl, keyInput, valInput, typeTag, dataType: type };
                this.pixData.rows.push(rowObj);
                updateRowStatus(rowObj);

                // --- 输入事件 ---
                [keyInput, valInput].forEach(inp => {
                    inp.addEventListener("paste", (e) => {
                        e.preventDefault(); e.stopPropagation();
                        const text = (e.clipboardData || window.clipboardData).getData('text/plain');
                        document.execCommand("insertText", false, text);
                    });
                    inp.addEventListener("cut", stopPropagation);
                    inp.addEventListener("input", () => {
                        updateRowStatus(rowObj);
                        saveData();
                    });
                });

                // Key 键盘
                keyInput.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        valInput.focus();
                    } 
                    else if (e.key === "Backspace") {
                         if (getCaretPosition(keyInput) === 0 && window.getSelection().isCollapsed) {
                             const idx = this.pixData.rows.indexOf(rowObj);
                             if (idx > 0) {
                                 e.preventDefault();
                                 const prevRow = this.pixData.rows[idx - 1];
                                 prevRow.valInput.focus();
                                 setCaretPosition(prevRow.valInput, prevRow.valInput.innerText.length);
                             }
                         }
                    }
                    else if (e.key === "ArrowDown") {
                         e.preventDefault();
                         valInput.focus();
                    }
                    else if (e.key === "ArrowUp") {
                        const idx = this.pixData.rows.indexOf(rowObj);
                        if (idx > 0) {
                            e.preventDefault();
                            this.pixData.rows[idx-1].valInput.focus();
                        }
                    }
                });

                // Value 键盘
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
                            createRow("", textAfter, "string", nextRowEl);
                            
                            saveData();
                            updateRowStatus(rowObj);
                            
                            const createdRow = this.pixData.rows[idx + 1];
                            if (createdRow) {
                                setTimeout(() => createdRow.keyInput.focus(), 5);
                            }
                        }
                    } 
                    else if (e.key === "Backspace") {
                        if (getCaretPosition(valInput) === 0 && window.getSelection().isCollapsed) {
                            e.preventDefault();
                            keyInput.focus();
                            setCaretPosition(keyInput, keyInput.innerText.length);
                        }
                    }
                    else if (e.key === "ArrowUp") {
                        if (valInput.innerText.indexOf('\n') === -1) {
                             e.preventDefault();
                             keyInput.focus();
                        }
                    }
                    else if (e.key === "ArrowDown") {
                        if (idx < this.pixData.rows.length - 1) {
                             if (valInput.innerText.indexOf('\n') === -1) {
                                e.preventDefault();
                                this.pixData.rows[idx+1].keyInput.focus();
                             }
                        }
                    }
                });

                // --- 修改后的点击逻辑：支持多选后延迟取消 ---
                rowEl.addEventListener("mousedown", (e) => {
                    if (e.target === delBtn) return;
                    
                    // 1. Ctrl (加选)
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

                    // 2. Shift (连选)
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

                    // 3. 右键
                    if (e.button === 2) { 
                        if (!this.pixData.selection.has(rowObj)) {
                            this.pixData.selection.clear();
                            this.pixData.selection.add(rowObj);
                            this.pixData.lastFocusedIndex = this.pixData.rows.indexOf(rowObj);
                            updateSelectionUI();
                        }
                        return;
                    }

                    // 4. 左键单选
                    if (e.button === 0) {
                        e.stopPropagation();
                        // 关键修改：如果已经在选中集合中，不立即清除，等待 mouseup
                        if (this.pixData.selection.has(rowObj) && this.pixData.selection.size > 1) {
                            this.pendingDeselect = rowObj;
                        } else {
                            // 否则正常单选
                            if (!this.pixData.selection.has(rowObj)) {
                                this.pixData.selection.clear();
                                this.pixData.selection.add(rowObj);
                                updateSelectionUI();
                            }
                            this.pixData.lastFocusedIndex = this.pixData.rows.indexOf(rowObj);
                        }
                    }
                });

                // 修改1：Mouse Up 处理延迟取消选中
                rowEl.addEventListener("mouseup", (e) => {
                    if (e.button === 0 && this.pendingDeselect === rowObj) {
                        // 如果鼠标抬起时，还是等待取消状态（说明期间没发生 dragstart），则执行取消其他
                        this.pixData.selection.clear();
                        this.pixData.selection.add(rowObj);
                        updateSelectionUI();
                        this.pixData.lastFocusedIndex = this.pixData.rows.indexOf(rowObj);
                        this.pendingDeselect = null;
                    }
                });

                // 聚焦/失焦样式同步
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
                
                keyInput.addEventListener("focus", onFocus);
                valInput.addEventListener("focus", onFocus);
                
                const onBlur = () => rowEl.classList.remove("focused");
                keyInput.addEventListener("blur", onBlur);
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
                    // 修改1：拖动开始时，取消 pendingDeselect，因为用户意图是拖动这些选中的块
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
                    saveData();
                });

                if (insertBeforeEl) container.insertBefore(rowEl, insertBeforeEl);
                else container.insertBefore(rowEl, addZone);

                rebuildRowsArray();
                
                // 修改：仅当 shouldFocus 为真且没有指定插入位置（添加到末尾）时才自动聚焦
                if (shouldFocus && !insertBeforeEl) setTimeout(() => keyInput.focus(), 0);
            };

            const rebuildRowsArray = () => {
                const newRows = [];
                const domRows = container.querySelectorAll('.pix-obj-row');
                domRows.forEach(el => {
                    const found = this.pixData.rows.find(r => r.el === el);
                    if (found) newRows.push(found);
                });
                this.pixData.rows = newRows;
            };

            const addZone = document.createElement("div");
            addZone.className = "pix-obj-add-zone";
            addZone.innerText = "+"; 
            addZone.title = "Add new key-value pair";
            container.appendChild(addZone);

            addZone.onclick = (e) => {
                e.preventDefault();
                createRow(); // 点击添加时，使用默认值 (shouldFocus=true)，因此会自动聚焦
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
                saveData();
            });

            function getDragAfterElement(container, y) {
                const els = [...container.querySelectorAll('.pix-obj-row:not(.dragging)')];
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
                        const k = item.key || "";
                        const v = item.value !== undefined ? item.value : "";
                        const t = item.type || "string";
                        // 修改：初始化数据时传入 false，禁止自动聚焦
                        createRow(k, v, t, null, false);
                    });
                }
            };

            this.addDOMWidget("json_obj_editor", "box", container, {
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