import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// 注入自定义 CSS
const style = document.createElement('style');
style.textContent = `
    .pix-video-slider {
        -webkit-appearance: none;
        appearance: none;
        background: transparent;
        cursor: pointer;
    }
    .pix-video-slider::-webkit-slider-runnable-track {
        background: #444;
        height: 4px;
        border-radius: 2px;
    }
    .pix-video-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        margin-top: -4px; 
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
    .pix-video-slider::-moz-range-track {
        background: #444;
        height: 4px;
        border-radius: 2px;
    }
    .pix-video-slider::-moz-range-thumb {
        background-color: #888;
        height: 12px;
        width: 12px;
        border: none;
        border-radius: 50%;
    }
`;
document.head.appendChild(style);

app.registerExtension({
    name: "Pix.VideoList",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "Pix_CreateVideoList") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                
                this.size = [520, 400]; 
                this.baseSize = 130;

                this.videos = [];
                this.viewMode = "grid"; 
                this.isUploading = false;
                this.selectedIndices = new Set();
                this.lastSelectedIndex = null; 
                this.undoStack = [];
                this.redoStack = [];
                
                // --- Widget 初始化 ---
                let dataWidget = this.widgets?.find(w => w.name === "video_data");
                if (!dataWidget) {
                    dataWidget = this.addWidget("text", "video_data", "[]", (v) => {});
                }
                if (dataWidget) {
                    dataWidget.computeSize = () => [0, -4]; 
                    dataWidget.draw = () => {}; 
                    if (dataWidget.element) {
                        dataWidget.element.style.display = "none";
                    }
                    // 恢复数据
                    if (dataWidget.value && dataWidget.value !== "") {
                        try {
                            const parsed = JSON.parse(dataWidget.value);
                            if (Array.isArray(parsed)) this.videos = parsed;
                        } catch (e) {}
                    }
                }

                // --- 构建 DOM 容器 ---
                const container = document.createElement("div");
                container.className = "pix-video-container";
                
                Object.assign(container.style, {
                    width: "100%",
                    // height 由 onResize 控制
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

                // --- 空状态视图 ---
                const emptyState = document.createElement("div");
                Object.assign(emptyState.style, {
                    width: "100%", height: "100%", display: "flex",
                    alignItems: "center", justifyContent: "center", background: "#222", flex: "1"
                });
                
                const btnBigAdd = document.createElement("button");
                btnBigAdd.innerText = "+ Add Video";
                Object.assign(btnBigAdd.style, {
                    background: "transparent", border: "2px dashed #666", color: "#888",
                    fontSize: "16px", padding: "20px 40px", borderRadius: "8px", 
                    cursor: "pointer", pointerEvents: "auto"
                });
                btnBigAdd.onmouseover = () => { if(!this.isUploading) { btnBigAdd.style.borderColor = "#fff"; btnBigAdd.style.color = "#fff"; } };
                btnBigAdd.onmouseout = () => { if(!this.isUploading) { btnBigAdd.style.borderColor = "#666"; btnBigAdd.style.color = "#888"; } };
                
                emptyState.appendChild(btnBigAdd);
                container.appendChild(emptyState);

                // --- 主视图 ---
                const mainView = document.createElement("div");
                Object.assign(mainView.style, {
                    width: "100%", height: "100%", display: "none", flexDirection: "column", flex: "1"
                });

                // --- 工具栏 ---
                const toolbar = document.createElement("div");
                Object.assign(toolbar.style, {
                    height: "36px", minHeight: "36px", display: "flex",
                    alignItems: "center", justifyContent: "space-between",
                    padding: "0 6px", background: "#333", borderBottom: "1px solid #111"
                });
                toolbar.onmousedown = (e) => e.stopPropagation(); 
                toolbar.onclick = (e) => e.stopPropagation(); 

                const createIconBtn = (iconChar, title) => {
                    const btn = document.createElement("div");
                    btn.innerText = iconChar; btn.title = title;
                    Object.assign(btn.style, {
                        width: "24px", height: "24px", lineHeight: "24px", textAlign: "center",
                        background: "#444", color: "#eee", borderRadius: "3px",
                        cursor: "pointer", fontSize: "14px", userSelect: "none"
                    });
                    btn.onmouseover = () => { if(!this.isUploading && btn.style.pointerEvents !== "none") btn.style.background = "#555"; };
                    btn.onmouseout = () => { if(!this.isUploading && btn.style.pointerEvents !== "none") btn.style.background = "#444"; };
                    return btn;
                };

                const leftGroup = document.createElement("div");
                leftGroup.style.display = "flex"; leftGroup.style.alignItems = "center"; leftGroup.style.gap = "4px";

                const btnUndo = createIconBtn("↩", "撤销");
                const btnRedo = createIconBtn("↪", "重做");
                
                btnUndo.style.opacity = "0.3"; btnUndo.style.pointerEvents = "none";
                btnRedo.style.opacity = "0.3"; btnRedo.style.pointerEvents = "none";

                // Slider
                const zoomSlider = document.createElement("input");
                zoomSlider.type = "range";
                zoomSlider.className = "pix-video-slider";
                zoomSlider.min = "60";
                zoomSlider.max = "300";
                zoomSlider.step = "10";
                zoomSlider.value = this.baseSize;
                zoomSlider.title = "缩放预览大小";
                Object.assign(zoomSlider.style, {
                    width: "100px", 
                    height: "4px",
                    marginLeft: "8px",
                    marginRight: "4px",
                    cursor: "pointer",
                    verticalAlign: "middle"
                });
                
                zoomSlider.onmousedown = (e) => e.stopPropagation();
                
                zoomSlider.oninput = (e) => {
                    this.baseSize = parseInt(e.target.value);
                    if (this.viewMode === "grid") {
                        renderContent();
                    }
                };

                const sep = document.createElement("div");
                sep.style.width = "4px";

                leftGroup.append(btnUndo, btnRedo, zoomSlider, sep);

                const rightGroup = document.createElement("div");
                rightGroup.style.display = "flex"; rightGroup.style.gap = "2px";

                const btnAddSmall = createIconBtn("+", "继续添加视频");
                const btnView = createIconBtn("▦", "切换视图"); 

                btnView.onclick = () => {
                    if (this.isUploading) return;
                    this.viewMode = this.viewMode === "grid" ? "list" : "grid";
                    btnView.innerText = this.viewMode === "grid" ? "▦" : "☰";
                    zoomSlider.disabled = (this.viewMode === "list");
                    zoomSlider.style.opacity = (this.viewMode === "list") ? "0.3" : "1";
                    renderContent();
                };

                rightGroup.append(btnAddSmall, btnView);
                toolbar.append(leftGroup, rightGroup);
                mainView.appendChild(toolbar);

                // --- 内容区域 ---
                const contentArea = document.createElement("div");
                Object.assign(contentArea.style, {
                    flex: "1", overflowY: "auto", padding: "4px",
                    background: "#1a1a1a", alignContent: "start"
                });
                contentArea.onwheel = (e) => e.stopPropagation();
                contentArea.onmousedown = (e) => e.stopPropagation();

                mainView.appendChild(contentArea);
                container.appendChild(mainView);
                
                const fileInput = document.createElement("input");
                fileInput.type = "file"; fileInput.multiple = true; fileInput.accept = "video/*";
                fileInput.style.display = "none";
                document.body.appendChild(fileInput);

                // --- 注册为 DOM Widget ---
                const widget = this.addDOMWidget("video_manager_ui", "ui", container, {
                    serialize: false,
                    hideOnZoom: false
                });
                
                widget.computeSize = () => [0, 0];

                // --- onResize 处理 ---
                const originalOnResize = this.onResize;
                this.onResize = function(size) {
                    if (originalOnResize) originalOnResize.apply(this, arguments);
                    
                    // 1. 临时告诉系统这个 DOM widget 高度为 0
                    widget.computeSize = () => [0, 0];
                    
                    // 2. 计算节点在没有这个 DOM widget 时的最小高度 (Header + 隐藏 Widget)
                    const minSize = this.computeSize(); 
                    
                    // 3. 计算可用高度
                    // 使用 size[1] (当前节点高度) 减去骨架高度，再留出底部 Resize Handle 的安全距离
                    let availableHeight = size[1] - minSize[1] - 15;
                    
                    // [修复] 兜底逻辑：如果计算异常，使用节点总高度的大部分
                    if (availableHeight <= 0) {
                        availableHeight = Math.max(100, size[1] - 40); 
                    }
                    
                    container.style.height = `${availableHeight}px`;
                    container.style.maxHeight = `${availableHeight}px`; // 确保不溢出
                };

                // --- Logic ---
                const serializeState = () => JSON.stringify({ videos: this.videos });

                const updateUndoRedoBtnState = () => {
                    const setBtn = (btn, active) => {
                        if (active) {
                            btn.style.opacity = "1"; btn.style.pointerEvents = "auto"; btn.style.color = "#eee";
                        } else {
                            btn.style.opacity = "0.3"; btn.style.pointerEvents = "none"; btn.style.color = "#eee";
                        }
                    };
                    setBtn(btnUndo, this.undoStack.length > 0);
                    setBtn(btnRedo, this.redoStack.length > 0);
                };

                const recordState = (stateStr = null) => {
                    const currentStr = stateStr || serializeState();
                    const currentState = JSON.parse(currentStr);
                    if (currentState.videos.length === 0 && this.undoStack.length === 0) return;
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
                        this.videos = state.videos || [];
                        this.selectedIndices.clear(); 
                        updateState();
                        updateNodeData();
                    } catch (e) { console.error(e); }
                };

                const performUndo = () => {
                    if (this.isUploading || this.undoStack.length === 0) return;
                    this.redoStack.push(serializeState());
                    restoreState(this.undoStack.pop());
                    updateUndoRedoBtnState(); 
                };

                const performRedo = () => {
                    if (this.isUploading || this.redoStack.length === 0) return;
                    this.undoStack.push(serializeState());
                    restoreState(this.redoStack.pop());
                    updateUndoRedoBtnState(); 
                };

                btnUndo.onclick = performUndo;
                btnRedo.onclick = performRedo;

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
                    btnBigAdd.innerText = "上传中...";
                    btnBigAdd.style.opacity = "0.5";
                    
                    recordState(); 

                    for (const file of files) {
                        const body = new FormData();
                        body.append("image", file); 
                        body.append("subfolder", "");
                        body.append("type", "input");
                        try {
                            const resp = await api.fetchApi("/upload/image", { method: "POST", body });
                            const data = await resp.json();
                            this.videos.push({
                                filename: data.name,
                                subfolder: data.subfolder,
                                type: data.type
                            });
                        } catch (err) { console.error(err); }
                    }
                    
                    this.isUploading = false;
                    btnBigAdd.innerText = "+ Add Video";
                    btnBigAdd.style.opacity = "1";
                    fileInput.value = "";
                    
                    updateState();
                    updateNodeData();
                };

                const updateState = () => {
                    if (this.videos.length === 0) {
                        emptyState.style.display = "flex";
                        mainView.style.display = "none";
                    } else {
                        emptyState.style.display = "none";
                        mainView.style.display = "flex";
                        renderContent();
                    }
                    // [修复] 每次状态更新（如上传后）强制触发布局更新，解决内容溢出问题
                    if (this.onResize) {
                        this.onResize(this.size);
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
                        if (this.selectedIndices.has(idx)) this.selectedIndices.delete(idx);
                        else this.selectedIndices.add(idx);
                        this.lastSelectedIndex = idx;
                    } else if (e.shiftKey && this.lastSelectedIndex !== null) {
                        const start = Math.min(this.lastSelectedIndex, idx);
                        const end = Math.max(this.lastSelectedIndex, idx);
                        this.selectedIndices.clear();
                        for (let i = start; i <= end; i++) this.selectedIndices.add(i);
                    } else {
                        this.selectedIndices.clear();
                        this.selectedIndices.add(idx);
                        this.lastSelectedIndex = idx;
                    }
                    updateSelectionVisuals();
                };

                let draggedIndex = null;

                const formatTime = (seconds) => {
                    const FPS = 30; 
                    const m = Math.floor(seconds / 60);
                    const s = Math.floor(seconds % 60);
                    const f = Math.floor((seconds - Math.floor(seconds)) * FPS);
                    return `${m}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
                };

                const handleDelete = (idx, e) => {
                    e.stopPropagation();
                    if (this.isUploading) return;
                    recordState();
                    let indicesToDelete = [];
                    if (this.selectedIndices.has(idx)) {
                        indicesToDelete = Array.from(this.selectedIndices).sort((a, b) => b - a);
                    } else {
                        indicesToDelete = [idx];
                    }
                    for (const i of indicesToDelete) this.videos.splice(i, 1);
                    this.selectedIndices.clear();
                    updateState();
                    updateNodeData();
                };
                
                const renderContent = () => {
                    contentArea.innerHTML = "";
                    const BASE_SIZE = this.baseSize;
                    
                    if (this.viewMode === "grid") {
                        Object.assign(contentArea.style, {
                            display: "flex", flexWrap: "wrap", gap: "4px",
                            flexDirection: "row", alignItems: "center" 
                        });

                        this.videos.forEach((vid, idx) => {
                            const item = document.createElement("div");
                            const isSelected = this.selectedIndices.has(idx);
                            
                            item.draggable = !this.isUploading; 
                            
                            let initialW = BASE_SIZE;
                            let initialH = BASE_SIZE;

                            if (vid.w && vid.h) {
                                if (vid.w >= vid.h) {
                                    initialH = BASE_SIZE;
                                    initialW = BASE_SIZE * (vid.w / vid.h);
                                } else {
                                    initialW = BASE_SIZE;
                                    initialH = BASE_SIZE * (vid.h / vid.w);
                                }
                            }

                            Object.assign(item.style, {
                                width: initialW + "px",
                                height: initialH + "px",
                                position: "relative",
                                background: "#000", borderRadius: "4px",
                                border: isSelected ? "2px solid #2196F3" : "1px solid #444", 
                                cursor: this.isUploading ? "wait" : "grab",
                                boxSizing: "border-box", overflow: "hidden", display: "flex",
                                alignItems: "center", justifyContent: "center"
                            });

                            const videoEl = document.createElement("video");
                            let src = `/view?filename=${encodeURIComponent(vid.filename)}&type=${vid.type}&subfolder=${encodeURIComponent(vid.subfolder)}`;
                            videoEl.src = src;
                            videoEl.muted = true;
                            videoEl.loop = true;
                            videoEl.preload = "metadata";
                            Object.assign(videoEl.style, {
                                width: "100%", height: "100%", 
                                objectFit: "contain",
                                display: "block",
                                pointerEvents: "none", 
                            });

                            videoEl.onloadedmetadata = () => {
                                const vw = videoEl.videoWidth;
                                const vh = videoEl.videoHeight;
                                if (!vw || !vh) return;

                                if (vid.w !== vw || vid.h !== vh) {
                                    vid.w = vw;
                                    vid.h = vh;
                                    if (vw >= vh) {
                                        item.style.height = BASE_SIZE + "px";
                                        item.style.width = (BASE_SIZE * (vw/vh)) + "px";
                                    } else {
                                        item.style.width = BASE_SIZE + "px";
                                        item.style.height = (BASE_SIZE * (vh/vw)) + "px";
                                    }
                                }
                            };

                            const progBg = document.createElement("div");
                            Object.assign(progBg.style, {
                                position: "absolute", bottom: "0", left: "0", width: "100%", height: "4px",
                                background: "rgba(255,255,255,0.3)", display: "none", pointerEvents: "none", zIndex: 5
                            });
                            const progFill = document.createElement("div");
                            Object.assign(progFill.style, {
                                width: "0%", height: "100%", background: "#2196F3", transition: "width 0.1s linear"
                            });
                            progBg.appendChild(progFill);

                            const timeLabel = document.createElement("div");
                            Object.assign(timeLabel.style, {
                                position: "absolute", bottom: "6px", right: "4px", 
                                color: "#fff", fontSize: "10px", fontWeight: "bold",
                                textShadow: "1px 1px 2px rgba(0,0,0,0.9)",
                                display: "none", pointerEvents: "none", zIndex: 6
                            });

                            item.appendChild(videoEl);
                            item.appendChild(progBg);
                            item.appendChild(timeLabel);

                            let rafId = null;
                            const updateUI = () => {
                                if (videoEl.duration) {
                                    const p = videoEl.currentTime / videoEl.duration;
                                    progFill.style.width = (p * 100) + "%";
                                    timeLabel.innerText = formatTime(videoEl.currentTime);
                                }
                                rafId = requestAnimationFrame(updateUI);
                            };

                            item.onmouseenter = () => {
                                if(!this.isUploading) {
                                    delBtn.style.display = "block";
                                    progBg.style.display = "block";
                                }
                                videoEl.play().catch(()=>{});
                                cancelAnimationFrame(rafId);
                                rafId = requestAnimationFrame(updateUI);
                            };
                            
                            item.onmouseleave = () => { 
                                delBtn.style.display = "none";
                                progBg.style.display = "none";
                                timeLabel.style.display = "none";
                                videoEl.pause();
                                cancelAnimationFrame(rafId);
                            };
                            
                            item.onmousemove = (e) => {
                                if (videoEl.duration) {
                                    const rect = item.getBoundingClientRect();
                                    const x = e.clientX - rect.left;
                                    const pos = Math.max(0, Math.min(1, x / rect.width));
                                    videoEl.currentTime = pos * videoEl.duration;
                                    timeLabel.style.display = "block";
                                }
                            };

                            item.onmousedown = (e) => {
                                e.stopPropagation();
                                if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                                    if (!this.selectedIndices.has(idx)) handleSelection(idx, e);
                                } else {
                                    handleSelection(idx, e);
                                }
                            };

                            if (!this.isUploading) attachEvents(item, idx);
                            
                            const delBtn = createDelBtn(idx);
                            item.appendChild(delBtn);
                            contentArea.appendChild(item);
                        });

                    } else {
                        Object.assign(contentArea.style, {
                            display: "flex", flexDirection: "column", gap: "2px", 
                            flexWrap: "nowrap", alignItems: "stretch" 
                        });
                        this.videos.forEach((vid, idx) => {
                            const row = document.createElement("div");
                            const isSelected = this.selectedIndices.has(idx);

                            row.draggable = !this.isUploading; 
                            Object.assign(row.style, {
                                height: "24px", display: "flex", alignItems: "center",
                                background: isSelected ? "#2d3e50" : "#222", 
                                borderBottom: "1px solid #333",
                                borderLeft: isSelected ? "3px solid #2196F3" : "none", 
                                padding: "0 8px", color: "#ccc", fontSize: "12px",
                                cursor: this.isUploading ? "wait" : "grab",
                                userSelect: "none", whiteSpace: "nowrap", overflow: "hidden", position: "relative" 
                            });

                            row.onmousedown = (e) => {
                                e.stopPropagation();
                                if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                                    if (!this.selectedIndices.has(idx)) handleSelection(idx, e);
                                } else {
                                    handleSelection(idx, e);
                                }
                            };

                            const textSpan = document.createElement("span");
                            textSpan.innerText = `${idx + 1}. ${vid.filename}`;
                            textSpan.style.overflow = "hidden";
                            textSpan.style.textOverflow = "ellipsis";
                            textSpan.style.flex = "1"; 
                            
                            row.appendChild(textSpan);
                            if (!this.isUploading) attachEvents(row, idx);

                            const delBtn = document.createElement("div");
                            delBtn.innerHTML = "&times;";
                            Object.assign(delBtn.style, {
                                marginLeft: "8px", width: "16px", height: "16px",
                                color: "#888", textAlign: "center", lineHeight: "16px",
                                cursor: "pointer", fontWeight: "bold"
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
                        position: "absolute", top: "2px", right: "2px",
                        width: "16px", height: "16px", background: "red", color: "white",
                        borderRadius: "50%", textAlign: "center", lineHeight: "14px",
                        fontSize: "12px", cursor: "pointer", display: "none", zIndex: 10
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
                            if (e.clientX > midX) isAfter = true;
                        } else {
                            const midY = rect.top + rect.height / 2;
                            if (e.clientY > midY) isAfter = true;
                        }

                        if (indicesToMove.includes(idx) && indicesToMove.length === 1) return;

                        recordState(); 

                        const itemsToMove = indicesToMove.map(i => this.videos[i]);
                        
                        let insertAt = idx;
                        if (isAfter) insertAt = idx + 1;

                        for (let i = indicesToMove.length - 1; i >= 0; i--) {
                            this.videos.splice(indicesToMove[i], 1);
                        }
                        
                        const deletedBefore = indicesToMove.filter(i => i < insertAt).length;
                        let finalInsertIndex = insertAt - deletedBefore;
                        
                        this.videos.splice(finalInsertIndex, 0, ...itemsToMove);
                        
                        this.selectedIndices.clear();
                        for (let i = 0; i < itemsToMove.length; i++) {
                            this.selectedIndices.add(finalInsertIndex + i);
                        }
                        
                        draggedIndex = null;
                        updateState();
                        updateNodeData();
                    };
                };

                const updateNodeData = () => {
                    const w = this.widgets?.find(w => w.name === "video_data");
                    if (w) {
                        w.value = JSON.stringify(this.videos);
                    }
                };

                const originalOnRemoved = this.onRemoved;
                this.onRemoved = function() {
                    if (originalOnRemoved) originalOnRemoved.apply(this, arguments);
                    fileInput.remove();
                };
                
                // [修复] 强制触发首次 Resize，确保容器有高度
                // 同时在 setTimeout 中执行，等待 DOM 挂载
                setTimeout(() => {
                    updateState();
                    updateNodeData();
                    // 强制刷新一次尺寸
                    if (this.onResize) {
                        this.onResize(this.size);
                    }
                }, 50);
            };
            return r;
        }
    }
});