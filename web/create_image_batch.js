import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// [新增] 注入自定义 CSS 以实现滑块的白色/灰色配色 (参考 create_video_list.js)
const style = document.createElement('style');
style.textContent = `
    .pix-video-slider {
        -webkit-appearance: none;
        appearance: none;
        background: transparent;
        cursor: pointer;
        width: 60px; /* 控制滑块宽度 */
        margin: 0 4px;
    }
    .pix-video-slider::-webkit-slider-runnable-track {
        background: #444;
        height: 4px;
        border-radius: 2px;
    }
    .pix-video-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        margin-top: -4px; /* 居中 */
        background-color: #888;
        height: 12px;
        width: 12px;
        border-radius: 50%;
        border: 1px solid #555;
        transition: background-color 0.2s;
    }
    .pix-video-slider:hover::-webkit-slider-thumb {
        background-color: #ccc;
        border-color: #fff;
    }
    .pix-video-slider:active::-webkit-slider-thumb {
        background-color: #fff;
    }
`;
document.head.appendChild(style);

app.registerExtension({
    name: "Pix.BatchImages",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "Pix_CreateImageBatch") {
            
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                
                // [修改] 设置默认大小为 520
                this.size = [520, 400]; 

                const hideNativeWidget = (name) => {
                    const w = this.widgets.find(w => w.name === name);
                    if (w) {
                        w.computeSize = () => [0, -4];
                        w.origDraw = w.draw;
                        w.draw = () => {}; 
                    }
                    return w;
                };

                const w_width = hideNativeWidget("batch_width");
                const w_height = hideNativeWidget("batch_height");
                const w_color = hideNativeWidget("bg_color");
                const w_method = hideNativeWidget("method"); 
                
                this.images = [];
                this.viewMode = "grid"; 
                this.fillMode = w_method ? w_method.value : "fill"; 
                this.isUploading = false;
                
                // 状态变量
                this.maxPreviewRes = 2000; // 前端预采样最大分辨率
                this.gridBaseSize = 80;    // 网格预览大小
                
                this.selectedIndices = new Set();
                this.lastSelectedIndex = null; 

                this.undoStack = [];
                this.redoStack = [];
                this.tempSnapshot = null;
                
                this.thumbnailCache = new Map();

                const getCssSize = (mode) => {
                    if (mode === "fill") return "cover";
                    if (mode === "stretch") return "100% 100%";
                    return "contain";
                };
                
                const dataWidget = {
                    type: "custom_image_data",
                    name: "image_data",
                    value: "[]",
                    draw: function(ctx, node, widget_width, y, widget_height) {},
                    computeSize: function(width) { return [width, 0]; }
                };
                this.addCustomWidget(dataWidget);

                // --- DOM 容器 ---
                const container = document.createElement("div");
                container.className = "pix-batch-container";
                
                container.style.setProperty("--tile-ratio", "1");
                container.style.setProperty("--tile-min-width", "80px");
                const initialColor = w_color ? w_color.value : "#000000";
                container.style.setProperty("--grid-bg", initialColor);

                Object.assign(container.style, {
                    width: "100%",
                    backgroundColor: "#111",
                    borderRadius: "0px 0px 8px 8px",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    boxSizing: "border-box",
                    fontFamily: "sans-serif",
                });

                container.onclick = (e) => {
                    if (e.target === container || e.target === mainView || e.target === contentArea) {
                        this.selectedIndices.clear();
                        this.lastSelectedIndex = null;
                        updateSelectionVisuals();
                    }
                };

                // --- UI States ---
                const emptyState = document.createElement("div");
                Object.assign(emptyState.style, {
                    width: "100%", height: "100%", display: "flex",
                    alignItems: "center", justifyContent: "center", background: "#222",
                    flex: "1"
                });
                
                const btnBigAdd = document.createElement("button");
                btnBigAdd.innerText = "+ Add Image";
                Object.assign(btnBigAdd.style, {
                    background: "transparent", border: "2px dashed #666", color: "#888",
                    fontSize: "16px", padding: "20px 40px", borderRadius: "8px", cursor: "pointer", pointerEvents: "auto"
                });
                btnBigAdd.onmouseover = () => { if(!this.isUploading) { btnBigAdd.style.borderColor = "#fff"; btnBigAdd.style.color = "#fff"; } };
                btnBigAdd.onmouseout = () => { if(!this.isUploading) { btnBigAdd.style.borderColor = "#666"; btnBigAdd.style.color = "#888"; } };
                
                emptyState.appendChild(btnBigAdd);
                container.appendChild(emptyState);

                const mainView = document.createElement("div");
                Object.assign(mainView.style, {
                    width: "100%", height: "100%", display: "none", flexDirection: "column",
                    flex: "1"
                });

                // Toolbar
                const toolbar = document.createElement("div");
                Object.assign(toolbar.style, {
                    height: "32px", minHeight: "32px", display: "flex",
                    alignItems: "center", justifyContent: "space-between",
                    padding: "0 6px", background: "#333", borderBottom: "1px solid #111"
                });
                toolbar.onmousedown = (e) => e.stopPropagation();
                toolbar.onclick = (e) => e.stopPropagation(); 

                const createIconBtn = (iconChar, title) => {
                    const btn = document.createElement("div");
                    btn.innerText = iconChar; btn.title = title;
                    Object.assign(btn.style, {
                        width: "24px", height: "22px", lineHeight: "22px", textAlign: "center",
                        background: "#444", color: "#eee", borderRadius: "3px",
                        cursor: "pointer", fontSize: "14px", userSelect: "none"
                    });
                    btn.onmouseover = () => { if(!this.isUploading && btn.style.pointerEvents !== "none") btn.style.background = "#555"; };
                    btn.onmouseout = () => { if(!this.isUploading && btn.style.pointerEvents !== "none") btn.style.background = "#444"; };
                    return btn;
                };

                const leftGroup = document.createElement("div");
                leftGroup.style.display = "flex"; leftGroup.style.alignItems = "center"; leftGroup.style.gap = "4px";

                const btnUndo = createIconBtn("↩", "Undo");
                const btnRedo = createIconBtn("↪", "Redo");
                
                btnUndo.style.opacity = "0.3"; btnUndo.style.pointerEvents = "none";
                btnRedo.style.opacity = "0.3"; btnRedo.style.pointerEvents = "none";

                // --- 参数序列化 ---
                const serializeState = () => {
                    return JSON.stringify({
                        images: this.images,
                        w: parseInt(inputW.value),
                        h: parseInt(inputH.value),
                        fill: this.fillMode,
                        color: w_color ? w_color.value : "#000000",
                        maxRes: this.maxPreviewRes,
                        gridSize: this.gridBaseSize
                    });
                };

                const createNumInput = (ph, initialVal, onChange, width = "50px", title="") => {
                    const inp = document.createElement("input");
                    inp.type = "number"; inp.placeholder = ph; inp.value = initialVal;
                    if(title) inp.title = title;
                    Object.assign(inp.style, {
                        width: width, background: "#111", border: "1px solid #555",
                        color: "#ddd", fontSize: "11px", borderRadius: "4px",
                        padding: "2px 4px", textAlign: "center"
                    });
                    
                    inp.onfocus = () => {
                        this.tempSnapshot = serializeState();
                    };

                    const handleChange = (e) => {
                        if (this.tempSnapshot) {
                            pushToUndo(this.tempSnapshot);
                            this.tempSnapshot = null; 
                        }
                        onChange(e.target.value);
                        updateGridLook(); 
                    };
                    inp.onchange = handleChange;
                    inp.onmousedown = (e) => e.stopPropagation();
                    inp.onwheel = (e) => e.stopPropagation();
                    return inp;
                };

                const inputW = createNumInput("W", w_width ? w_width.value : 1080, (v) => { if(w_width) w_width.value = Number(v); });
                const inputH = createNumInput("H", w_height ? w_height.value : 1080, (v) => { if(w_height) w_height.value = Number(v); });
                
                if(w_width) w_width.value = Number(inputW.value);
                if(w_height) w_height.value = Number(inputH.value);

                // [修改] Max Preview Res 输入框: 宽度改为 50px
                // 并且在回调中添加清理缓存和重新渲染的逻辑
                const inputMaxRes = createNumInput("Res", this.maxPreviewRes, (v) => {
                    this.maxPreviewRes = parseInt(v) || 2000;
                    
                    // 清理旧缓存，强制使用新分辨率重新生成
                    if (this.thumbnailCache) {
                        this.thumbnailCache.forEach(url => {
                            if (url && url.startsWith("blob:")) {
                                URL.revokeObjectURL(url);
                            }
                        });
                        this.thumbnailCache.clear();
                    }
                    // 重新渲染视图
                    renderContent();
                }, "50px", "Max Preview Resolution (Long Edge)");
                
                // [新增] 降低颜色亮度，使其看起来像辅助参数 (#777 比默认 #ddd 暗)
                inputMaxRes.style.color = "#777";
                
                // Grid Size 滑块
                const sliderGrid = document.createElement("input");
                sliderGrid.type = "range";
                sliderGrid.min = "50";
                sliderGrid.max = "300";
                sliderGrid.value = this.gridBaseSize;
                sliderGrid.title = "Preview Grid Size";
                sliderGrid.className = "pix-video-slider"; 
                sliderGrid.onmousedown = (e) => { 
                    e.stopPropagation();
                    this.tempSnapshot = serializeState(); 
                };
                sliderGrid.oninput = (e) => {
                    this.gridBaseSize = parseInt(e.target.value);
                    updateGridLook();
                };
                sliderGrid.onchange = (e) => {
                    if (this.tempSnapshot) {
                        pushToUndo(this.tempSnapshot);
                        this.tempSnapshot = null;
                    }
                };

                // [修改] 移除了竖线分割符 (sep)

                const xLabel = document.createElement("span");
                xLabel.innerText = "x"; xLabel.style.color = "#666"; xLabel.style.fontSize = "10px";

                const colorBox = document.createElement("div");
                Object.assign(colorBox.style, {
                    width: "14px", height: "14px", background: w_color ? w_color.value : "#000",
                    border: "1px solid #666", cursor: "pointer", marginLeft: "2px", marginRight: "4px",
                    position: "relative" 
                });
                
                const colorInputHidden = document.createElement("input");
                colorInputHidden.type = "color"; 
                Object.assign(colorInputHidden.style, {
                    position: "absolute", left: "0", top: "0", width: "100%", height: "100%",
                    opacity: "0", cursor: "pointer", display: "block", zIndex: 10
                });
                
                colorInputHidden.onclick = () => {
                    this.tempSnapshot = serializeState();
                };

                colorInputHidden.onchange = (e) => {
                    if (this.tempSnapshot) {
                        pushToUndo(this.tempSnapshot);
                        this.tempSnapshot = null;
                    }
                    const hex = e.target.value;
                    colorBox.style.background = hex;
                    if(w_color) w_color.value = hex;
                    container.style.setProperty("--grid-bg", hex);
                };

                const fillSelect = document.createElement("select");
                Object.assign(fillSelect.style, {
                    background: "#111", color: "#ddd", border: "1px solid #555",
                    fontSize: "11px", borderRadius: "4px", padding: "2px",
                    outline: "none", cursor: "pointer", height: "20px"
                });
                
                const fillOptions = [
                    { val: "fit", txt: "Fit" },
                    { val: "fill", txt: "Fill" },
                    { val: "stretch", txt: "Stretch" }
                ];
                
                fillOptions.forEach(opt => {
                    const el = document.createElement("option");
                    el.value = opt.val;
                    el.innerText = opt.txt;
                    if (opt.val === this.fillMode) el.selected = true;
                    fillSelect.appendChild(el);
                });

                fillSelect.onfocus = () => {
                    this.tempSnapshot = serializeState();
                };

                fillSelect.onchange = (e) => {
                    if (this.tempSnapshot) {
                        pushToUndo(this.tempSnapshot);
                        this.tempSnapshot = null;
                    }
                    const val = e.target.value;
                    this.fillMode = val;
                    if (w_method) w_method.value = val;
                    renderContent(); 
                };
                fillSelect.onmousedown = (e) => e.stopPropagation(); 

                // --- 组装工具栏 (顺序：Undo -> Redo -> MaxRes -> Slider -> W -> x -> H -> Fill -> Color) ---
                leftGroup.appendChild(btnUndo);
                leftGroup.appendChild(btnRedo);
                
                leftGroup.appendChild(inputMaxRes);
                leftGroup.appendChild(sliderGrid);
                
                // [修改] 移除了 sep 的添加

                leftGroup.appendChild(inputW);
                leftGroup.appendChild(xLabel);
                leftGroup.appendChild(inputH);
                leftGroup.appendChild(fillSelect); 
                
                colorBox.appendChild(colorInputHidden);
                leftGroup.appendChild(colorBox); 

                const rightGroup = document.createElement("div");
                rightGroup.style.display = "flex"; rightGroup.style.gap = "2px";

                const btnAddSmall = createIconBtn("+", "Add more images");
                const btnView = createIconBtn("▦", "Toggle List/Grid View");

                btnView.onclick = () => {
                    if (this.isUploading) return;
                    if (this.viewMode === "grid") {
                        this.viewMode = "list";
                        btnView.innerText = "☰"; 
                    } else {
                        this.viewMode = "grid";
                        btnView.innerText = "▦"; 
                    }
                    renderContent(); 
                };

                rightGroup.appendChild(btnAddSmall);
                rightGroup.appendChild(btnView);

                toolbar.appendChild(leftGroup);
                toolbar.appendChild(rightGroup);
                mainView.appendChild(toolbar);

                const contentArea = document.createElement("div");
                Object.assign(contentArea.style, {
                    flex: "1", overflowY: "auto", padding: "4px",
                    background: "#1a1a1a", alignContent: "start"
                });
                contentArea.onwheel = (e) => { e.stopPropagation(); };
                contentArea.onmousedown = (e) => { e.stopPropagation(); };

                mainView.appendChild(contentArea);
                container.appendChild(mainView);
                
                const fileInput = document.createElement("input");
                fileInput.type = "file"; fileInput.multiple = true; fileInput.accept = "image/*";
                fileInput.style.display = "none";
                document.body.appendChild(fileInput);

                // --- 注册 DOM Widget ---
                const widget = this.addDOMWidget("image_batch_ui", "ui", container, {
                    serialize: false,
                    hideOnZoom: false
                });
                widget.computeSize = () => [0, 0];

                // --- Resize 处理 ---
                const originalOnResize = this.onResize;
                this.onResize = function(size) {
                    if (originalOnResize) originalOnResize.apply(this, arguments);
                    
                    widget.computeSize = () => [0, 0];
                    const minSize = this.computeSize();
                    
                    const availableHeight = size[1] - minSize[1] - 15; 
                    
                    if (availableHeight > 0) {
                        container.style.height = `${availableHeight}px`;
                    }
                };

                // --- 逻辑控制 ---

                const updateUndoRedoBtnState = () => {
                    const setBtn = (btn, active) => {
                        if (active) {
                            btn.style.opacity = "1";
                            btn.style.pointerEvents = "auto";
                            btn.style.color = "#eee";
                        } else {
                            btn.style.opacity = "0.3";
                            btn.style.pointerEvents = "none";
                            btn.style.color = "#eee";
                        }
                    };
                    setBtn(btnUndo, this.undoStack.length > 0);
                    setBtn(btnRedo, this.redoStack.length > 0);
                };

                const recordState = (stateStr = null) => {
                    const currentStr = stateStr || serializeState();
                    const currentState = JSON.parse(currentStr);

                    if (currentState.images.length === 0 && this.undoStack.length === 0) return;

                    pushToUndo(currentStr);
                };

                const pushToUndo = (stateStr) => {
                    this.undoStack.push(stateStr);
                    if (this.undoStack.length > 50) this.undoStack.shift();
                    this.redoStack = []; 
                    updateUndoRedoBtnState(); 
                };

                const restoreState = (stateStr) => {
                    try {
                        const state = JSON.parse(stateStr);
                        
                        this.images = state.images || [];
                        this.fillMode = state.fill || "fill";
                        this.selectedIndices.clear(); 
                        
                        inputW.value = state.w;
                        inputH.value = state.h;
                        fillSelect.value = this.fillMode;
                        const color = state.color || "#000000";
                        colorBox.style.background = color;
                        
                        // [新增] 恢复 Max Res 和 Grid Size
                        this.maxPreviewRes = state.maxRes || 2000;
                        inputMaxRes.value = this.maxPreviewRes;

                        this.gridBaseSize = state.gridSize || 80;
                        sliderGrid.value = this.gridBaseSize;
                        
                        if (w_width) w_width.value = state.w;
                        if (w_height) w_height.value = state.h;
                        if (w_method) w_method.value = this.fillMode;
                        if (w_color) w_color.value = color;

                        container.style.setProperty("--grid-bg", color);
                        updateGridLook();
                        updateState();
                        updateNodeData();

                    } catch (e) {
                        console.error("Restore state failed", e);
                    }
                };

                const performUndo = () => {
                    if (this.isUploading) return;
                    if (this.undoStack.length === 0) return;
                    
                    this.redoStack.push(serializeState());
                    
                    const prevState = this.undoStack.pop();
                    restoreState(prevState);
                    updateUndoRedoBtnState(); 
                };

                const performRedo = () => {
                    if (this.isUploading) return;
                    if (this.redoStack.length === 0) return;
                    
                    this.undoStack.push(serializeState());
                    
                    const nextState = this.redoStack.pop();
                    restoreState(nextState);
                    updateUndoRedoBtnState(); 
                };

                btnUndo.onclick = performUndo;
                btnRedo.onclick = performRedo;

                const handleDelete = (targetIdx, e) => {
                    if (e) e.stopPropagation();
                    if (this.isUploading) return;
                    
                    recordState();

                    let indicesToDelete = [];
                    
                    if (this.selectedIndices.has(targetIdx)) {
                        indicesToDelete = Array.from(this.selectedIndices).sort((a, b) => b - a);
                        this.selectedIndices.clear();
                        this.lastSelectedIndex = null;
                    } else {
                        indicesToDelete = [targetIdx];
                        const newSelection = new Set();
                        this.selectedIndices.forEach(i => {
                            if (i < targetIdx) newSelection.add(i);
                            if (i > targetIdx) newSelection.add(i - 1);
                        });
                        this.selectedIndices = newSelection;
                        
                        if (this.lastSelectedIndex !== null) {
                            if (this.lastSelectedIndex > targetIdx) this.lastSelectedIndex--;
                            else if (this.lastSelectedIndex === targetIdx) this.lastSelectedIndex = null;
                        }
                    }

                    indicesToDelete.forEach(idx => {
                        const img = this.images[idx];
                        if (img) {
                            const fullUrl = `/view?filename=${encodeURIComponent(img.filename)}&type=${img.type}&subfolder=${encodeURIComponent(img.subfolder)}`;
                            if (this.thumbnailCache.has(fullUrl)) {
                                const blobUrl = this.thumbnailCache.get(fullUrl);
                                if (blobUrl && blobUrl.startsWith("blob:")) {
                                    URL.revokeObjectURL(blobUrl);
                                }
                                this.thumbnailCache.delete(fullUrl);
                            }
                        }
                        this.images.splice(idx, 1);
                    });

                    updateState();
                    updateNodeData();
                };

                const updateGridLook = () => {
                    const w = parseInt(inputW.value) || 1080;
                    const h = parseInt(inputH.value) || 1080;
                    const ratio = w / h;
                    const baseSize = this.gridBaseSize || 80; 
                    let minW = baseSize;
                    if (ratio > 1) {
                        minW = baseSize * ratio;
                    }
                    container.style.setProperty("--tile-ratio", String(ratio));
                    container.style.setProperty("--tile-min-width", `${minW}px`);
                };

                updateGridLook();

                const handleUploadClick = () => {
                    if (this.isUploading) return;
                    fileInput.click();
                };
                
                btnBigAdd.onclick = handleUploadClick;
                btnAddSmall.onclick = handleUploadClick;

                fileInput.onchange = async (e) => {
                    const files = Array.from(e.target.files);
                    if (!files.length) return;
                    
                    this.isUploading = true;
                    btnBigAdd.style.cursor = "not-allowed";
                    btnBigAdd.style.opacity = "0.6";
                    btnAddSmall.style.cursor = "not-allowed";
                    btnAddSmall.style.opacity = "0.5";
                    
                    recordState(); 

                    const originalText = btnBigAdd.innerText;
                    btnBigAdd.innerText = "Uploading...";

                    for (const file of files) {
                        const body = new FormData();
                        body.append("image", file);
                        body.append("subfolder", "");
                        body.append("type", "input");
                        try {
                            const resp = await api.fetchApi("/upload/image", { method: "POST", body });
                            const data = await resp.json();
                            this.images.push({
                                filename: data.name,
                                subfolder: data.subfolder,
                                type: data.type
                            });
                        } catch (err) {
                            console.error(err);
                            alert("Error uploading " + file.name);
                        }
                    }
                    btnBigAdd.innerText = originalText;
                    
                    this.isUploading = false;
                    btnBigAdd.style.cursor = "pointer";
                    btnBigAdd.style.opacity = "1";
                    btnAddSmall.style.cursor = "pointer";
                    btnAddSmall.style.opacity = "1";
                    
                    fileInput.value = "";
                    
                    updateState();
                    updateNodeData();
                };

                const updateState = () => {
                    if (this.images.length === 0) {
                        emptyState.style.display = "flex";
                        mainView.style.display = "none";
                    } else {
                        emptyState.style.display = "none";
                        mainView.style.display = "flex";
                        renderContent();
                    }
                };

                const updateSelectionVisuals = () => {
                    const children = Array.from(contentArea.children);
                    children.forEach((child, i) => {
                        const isSelected = this.selectedIndices.has(i);
                        if (this.viewMode === "grid") {
                            child.style.border = isSelected ? "2px solid #2196F3" : "1px solid #444";
                        } else {
                            child.style.background = isSelected ? "#2d3e50" : "#222";
                            child.style.borderLeft = isSelected ? "3px solid #2196F3" : "none";
                        }
                    });
                };

                const handleSelection = (idx, e) => {
                    if (e.ctrlKey || e.metaKey) {
                        if (this.selectedIndices.has(idx)) {
                            this.selectedIndices.delete(idx);
                        } else {
                            this.selectedIndices.add(idx);
                        }
                        this.lastSelectedIndex = idx;
                    } else if (e.shiftKey && this.lastSelectedIndex !== null) {
                        const start = Math.min(this.lastSelectedIndex, idx);
                        const end = Math.max(this.lastSelectedIndex, idx);
                        this.selectedIndices.clear();
                        for (let i = start; i <= end; i++) {
                            this.selectedIndices.add(i);
                        }
                    } else {
                        this.selectedIndices.clear();
                        this.selectedIndices.add(idx);
                        this.lastSelectedIndex = idx;
                    }
                    updateSelectionVisuals();
                };

                const processImageForDisplay = (url, targetElement) => {
                    if (this.thumbnailCache.has(url)) {
                        targetElement.style.backgroundImage = `url("${this.thumbnailCache.get(url)}")`;
                        return;
                    }

                    targetElement.style.backgroundImage = `url("${url}")`;

                    const img = new Image();
                    img.crossOrigin = "Anonymous";
                    img.src = url;
                    
                    img.onload = () => {
                        const maxEdge = this.maxPreviewRes || 2000; 
                        let w = img.width;
                        let h = img.height;

                        if (w > maxEdge || h > maxEdge) {
                            if (w > h) {
                                h = Math.round((h * maxEdge) / w);
                                w = maxEdge;
                            } else {
                                w = Math.round((w * maxEdge) / h);
                                h = maxEdge;
                            }

                            const canvas = document.createElement("canvas");
                            canvas.width = w;
                            canvas.height = h;
                            const ctx = canvas.getContext("2d");
                            ctx.drawImage(img, 0, 0, w, h);

                            canvas.toBlob((blob) => {
                                if (!blob) return;
                                const blobUrl = URL.createObjectURL(blob);
                                this.thumbnailCache.set(url, blobUrl);
                                if (targetElement.isConnected) {
                                    targetElement.style.backgroundImage = `url("${blobUrl}")`;
                                }
                            }, "image/jpeg", 0.85);
                        } else {
                            this.thumbnailCache.set(url, url);
                        }
                    };
                };

                let draggedIndex = null;
                
                const renderContent = () => {
                    contentArea.innerHTML = "";

                    if (this.viewMode === "grid") {
                        Object.assign(contentArea.style, {
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(var(--tile-min-width), 1fr))",
                            gridAutoRows: "min-content",
                            gap: "4px",
                            flexDirection: "row" 
                        });

                        const cssSize = getCssSize(this.fillMode); 

                        this.images.forEach((img, idx) => {
                            const item = document.createElement("div");
                            const isSelected = this.selectedIndices.has(idx);
                            
                            item.draggable = !this.isUploading; 
                            Object.assign(item.style, {
                                position: "relative",
                                aspectRatio: "var(--tile-ratio)",
                                background: "var(--grid-bg)", 
                                borderRadius: "4px",
                                border: isSelected ? "2px solid #2196F3" : "1px solid #444", 
                                backgroundSize: cssSize, 
                                backgroundRepeat: "no-repeat",
                                backgroundPosition: "center",
                                cursor: this.isUploading ? "wait" : "grab",
                                boxSizing: "border-box" 
                            });

                            const fullUrl = `/view?filename=${encodeURIComponent(img.filename)}&type=${img.type}&subfolder=${encodeURIComponent(img.subfolder)}`;
                            processImageForDisplay(fullUrl, item);
                            
                            item.onmousedown = (e) => {
                                e.stopPropagation();
                                if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                                    if (!this.selectedIndices.has(idx)) {
                                        handleSelection(idx, e);
                                    }
                                } else {
                                    handleSelection(idx, e);
                                }
                            };
                            
                            if (!this.isUploading) attachEvents(item, idx);
                            
                            const delBtn = createDelBtn(idx);
                            item.appendChild(delBtn);
                            item.onmouseover = () => { if(!this.isUploading) delBtn.style.display = "block"; };
                            item.onmouseout = () => delBtn.style.display = "none";

                            contentArea.appendChild(item);
                        });

                    } else {
                        Object.assign(contentArea.style, {
                            display: "flex",
                            flexDirection: "column",
                            gap: "2px",
                            gridTemplateColumns: "none", 
                            gridAutoRows: "auto" 
                        });

                        this.images.forEach((img, idx) => {
                            const row = document.createElement("div");
                            const isSelected = this.selectedIndices.has(idx);

                            row.draggable = !this.isUploading; 
                            Object.assign(row.style, {
                                height: "24px",
                                display: "flex",
                                alignItems: "center",
                                background: isSelected ? "#2d3e50" : "#222", 
                                borderBottom: "1px solid #333",
                                borderLeft: isSelected ? "3px solid #2196F3" : "none", 
                                padding: "0 8px",
                                color: "#ccc",
                                fontSize: "12px",
                                cursor: this.isUploading ? "wait" : "grab",
                                userSelect: "none",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                position: "relative" 
                            });

                            row.onmousedown = (e) => {
                                e.stopPropagation();
                                if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                                    if (!this.selectedIndices.has(idx)) {
                                        handleSelection(idx, e);
                                    }
                                } else {
                                    handleSelection(idx, e);
                                }
                            };

                            const textSpan = document.createElement("span");
                            textSpan.innerText = `${idx + 1}. ${img.filename}`;
                            textSpan.style.overflow = "hidden";
                            textSpan.style.textOverflow = "ellipsis";
                            
                            row.appendChild(textSpan);
                            if (!this.isUploading) attachEvents(row, idx);

                            const delBtn = document.createElement("div");
                            delBtn.innerHTML = "&times;";
                            Object.assign(delBtn.style, {
                                marginLeft: "auto", 
                                width: "16px",
                                height: "16px",
                                background: "transparent",
                                color: "#888",
                                textAlign: "center",
                                lineHeight: "16px",
                                fontSize: "14px",
                                cursor: "pointer",
                                fontWeight: "bold"
                            });
                            delBtn.onmouseover = () => delBtn.style.color = "red";
                            delBtn.onmouseout = () => delBtn.style.color = "#888";
                            delBtn.onclick = (e) => handleDelete(idx, e);
                            
                            row.appendChild(delBtn);
                            contentArea.appendChild(row);
                        });
                    }
                };

                const createDelBtn = (idx) => {
                    const btn = document.createElement("div");
                    btn.innerHTML = "&times;";
                    Object.assign(btn.style, {
                        position: "absolute",
                        top: "-4px",
                        right: "-4px",
                        width: "16px",
                        height: "16px",
                        background: "red",
                        color: "white",
                        borderRadius: "50%",
                        textAlign: "center",
                        lineHeight: "14px",
                        fontSize: "12px",
                        cursor: "pointer",
                        display: "none"
                    });
                    btn.onclick = (e) => handleDelete(idx, e);
                    return btn;
                };

                const attachEvents = (el, idx) => {
                    el.ondragstart = (e) => { 
                        draggedIndex = idx; 
                        e.dataTransfer.effectAllowed = "move";
                    };
                    el.ondragover = (e) => { e.preventDefault(); };
                    el.ondrop = (e) => {
                        e.preventDefault();
                        if (draggedIndex === null) return;
                        
                        if (!this.selectedIndices.has(draggedIndex)) {
                            this.selectedIndices.clear();
                            this.selectedIndices.add(draggedIndex);
                        }

                        const indicesToMove = Array.from(this.selectedIndices).sort((a, b) => a - b);
                        
                        const rect = el.getBoundingClientRect();
                        let isAfter = false;
                        
                        if (this.viewMode === "grid") {
                            const midX = rect.left + rect.width / 2;
                            if (e.clientX > midX) {
                                isAfter = true;
                            }
                        } else {
                            const midY = rect.top + rect.height / 2;
                            if (e.clientY > midY) {
                                isAfter = true;
                            }
                        }

                        if (indicesToMove.includes(idx) && indicesToMove.length === 1) return;

                        recordState(); 

                        const itemsToMove = indicesToMove.map(i => this.images[i]);
                        
                        let insertAt = idx;
                        if (isAfter) {
                            insertAt = idx + 1;
                        }

                        for (let i = indicesToMove.length - 1; i >= 0; i--) {
                            this.images.splice(indicesToMove[i], 1);
                        }
                        
                        const deletedBefore = indicesToMove.filter(i => i < insertAt).length;
                        let finalInsertIndex = insertAt - deletedBefore;
                        
                        this.images.splice(finalInsertIndex, 0, ...itemsToMove);
                        
                        this.selectedIndices.clear();
                        for (let i = 0; i < itemsToMove.length; i++) {
                            this.selectedIndices.add(finalInsertIndex + i);
                        }
                        
                        draggedIndex = null;
                        updateState();
                        updateNodeData();
                    };
                    
                    el.onclick = (e) => {
                        e.stopPropagation();
                        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                             if (!this.selectedIndices.has(idx)) {
                                 handleSelection(idx, e);
                             }
                        }
                    };
                };

                const updateNodeData = () => {
                    const w = this.widgets.find(w => w.name === "image_data");
                    if (w) w.value = JSON.stringify(this.images);
                };

                const originalOnRemoved = this.onRemoved;
                this.onRemoved = function() {
                    if (originalOnRemoved) originalOnRemoved.apply(this, arguments);
                    fileInput.remove();
                    
                    if (this.thumbnailCache) {
                        this.thumbnailCache.forEach(url => {
                            if (url && url.startsWith("blob:")) {
                                URL.revokeObjectURL(url);
                            }
                        });
                        this.thumbnailCache.clear();
                    }
                };

                setTimeout(() => {
                    updateState();
                    updateNodeData();
                    if (this.onResize) {
                        this.onResize(this.size);
                    }
                }, 100);
            };
            return r;
        }
    }
});