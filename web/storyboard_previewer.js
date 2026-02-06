import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { createImageExportUI } from "./export_image.js";
import { createHtmlExportUI } from "./export_html.js";

// --- 1. 样式定义 ---
const style = document.createElement("style");
style.textContent = `
    /* 主体容器样式 */
    .aigv-sb-container {
        width: 100%;
        height: 100%;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        grid-auto-rows: min-content;
        gap: 10px;
        overflow: auto;
        padding: 10px;
        box-sizing: border-box;
        background: #1e1e1e;
        border-radius: 4px;
        align-content: start;
        /* align-items: start; 已移除，允许卡片自动拉伸以保持行内高度一致 */
        pointer-events: auto;
        font-size: 10px;
        position: relative; 
    }

    .aigv-sb-container::-webkit-scrollbar { width: 8px; height: 8px; }
    .aigv-sb-container::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }
    .aigv-sb-container::-webkit-scrollbar-track { background: #222; }
    .aigv-sb-container::-webkit-scrollbar-corner { background: #222; }

    /* 卡片样式 */
    .aigv-sb-card {
        background: #2a2a2a;
        border: 1px solid #333;
        border-radius: 6px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        height: 100%; /* 确保卡片填满 Grid 分配的高度 */
        position: relative;
    }
    
    /* 导出模式样式修正 (Export Mode Overrides) */

    /* 1. 正常状态下的 Hover (非导出时有效) */
    .aigv-sb-container:not(.aigv-exporting) .aigv-sb-card:hover { 
        border-color: #666; 
        box-shadow: 0 4px 12px rgba(0,0,0,0.4); 
    }

    /* 2. 导出时：强制隐藏视频进度条和时间码 */
    .aigv-sb-container.aigv-exporting .aigv-sb-progress,
    .aigv-sb-container.aigv-exporting .aigv-sb-time {
        display: none !important;
    }

    /* 3. 导出时：强制显示封面图 (如果存在)，无视 Hover 时的透明效果 */
    .aigv-sb-container.aigv-exporting .aigv-sb-media.has-video img.cover-img {
        opacity: 1 !important;
    }

    /* 媒体容器 */
    .aigv-sb-media {
        position: relative; width: 100%; background: #000; font-size: 0; 
        overflow: hidden; border-bottom: 1px solid #333; min-height: 1px; 
    }
    .aigv-sb-media img.cover-img { position: relative; width: 100%; height: auto; display: block; z-index: 10; transition: opacity 0.2s ease; }
    .aigv-sb-media video.bg-video { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; z-index: 5; pointer-events: none; }
    .aigv-sb-media video.main-video { position: relative; width: 100%; height: auto; display: block; z-index: 10; pointer-events: none; }
    .aigv-sb-media.has-video:hover img.cover-img { opacity: 0; }

    /* 进度条与标签 */
    .aigv-sb-progress { position: absolute; bottom: 0; left: 0; width: 100%; height: 4px; background: rgba(255, 255, 255, 0.3); z-index: 15; display: none; pointer-events: none; }
    .aigv-sb-progress-fill { width: 0%; height: 100%; background: #2196F3; transition: width 0.05s linear; }
    
    /* 修改：时间码样式优化 (sans-serif, 无背景块) */
    .aigv-sb-time { 
        position: absolute; bottom: 6px; right: 4px; 
        color: #fff; 
        font-size: 10px; 
        font-weight: bold; 
        text-shadow: 0 1px 2px rgba(0,0,0,0.8); /* 使用阴影代替背景块 */
        z-index: 16; 
        display: none; 
        pointer-events: none; 
        font-family: sans-serif; /* 改为无衬线体 */
    }

    /* 修改：序号标签样式优化 (更小, 不加粗, 透明度50%) */
    .aigv-sb-tag { 
        position: absolute; top: 4px; left: 10px; z-index: 20; 
        font-weight: normal; /* 不加粗 */
        font-size: 9px; /* 字体缩小 */
        color: #fff; 
        background: rgba(22, 45, 215, 1); /* 透明度 100% */
        padding: 1px 4px; /* 背景块缩小 */
        border-radius: 3px; 
        pointer-events: none; 
    }
    
    /* 信息区域 */
    .aigv-sb-info { 
        padding: 8px 10px; 
        /* 修改: 将原来的 Consolas 等固定字体改为 sans-serif，统一风格并自动适配系统 */
        font-family: sans-serif; 
        color: #ddd; 
        display: flex; 
        flex-direction: column; 
        background: #252525; 
        gap: 6px; 
        flex-grow: 1; /* 填充剩余空间，保证卡片高度拉伸时布局合理 */
    }
    .aigv-sb-info.no-media { padding-top: 24px; }
    .aigv-sb-row { display: block; line-height: 1.4; padding-bottom: 4px; text-align: justify; text-align-last: left; }
    .aigv-sb-row + .aigv-sb-row { border-top: 1px solid #3a3a3a; padding-top: 6px; }
    
    /* --- 修改点开始: 强制 Label 使用无衬线字体 --- */
    .aigv-sb-label { 
        display: inline; 
        color: #b3b3b3; 
        font-weight: normal; 
        font-size: 10px; 
        user-select: none; 
        -webkit-user-select: none; 
        cursor: default; 
        font-family: sans-serif; /* 强制使用无衬线体 */
    }
    /* --- 修改点结束 --- */

    .aigv-sb-content { display: inline; word-break: break-word; color: #b3b3b3; font-family: sans-serif; padding-left: 2px; user-select: text; cursor: text; }

    /* --- 上下文菜单样式 --- */
    .aigv-ctx-menu {
        position: fixed; background: #222; border: 1px solid #444; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        border-radius: 6px; padding: 6px; display: flex; flex-direction: column; gap: 6px; z-index: 9999;
        /* 修改: 移除 'Microsoft YaHei', 'SimHei' 等硬编码字体，统一使用 sans-serif */
        font-family: sans-serif; 
        font-size: 13px; color: #eee; width: auto; min-width: 160px;
    }
    .aigv-ctx-row { display: flex; align-items: center; gap: 10px; width: 100%; box-sizing: border-box; }
    .aigv-ctx-divider { height: 1px; background: #333; width: 100%; margin: 0; }
    
    /* 菜单内部组件样式 */
    .aigv-ctx-input-group { display: flex; align-items: baseline; gap: 0; padding: 0 4px; background: transparent; border: none; cursor: default; flex-grow: 1; }
    .aigv-ctx-label { color: #888; font-size: 13px; font-weight: bold; user-select: none; line-height: 1; font-family: inherit; }
    .aigv-ctx-input { background: transparent; border: none; color: #4daafc; width: 12px; text-align: right; outline: none; font-size: 13px; font-weight: bold; padding: 0; margin: 0; cursor: text; line-height: 1; font-family: inherit; }
    .aigv-ctx-input:focus { color: #fff; }
    .aigv-ctx-input::-webkit-outer-spin-button, .aigv-ctx-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

    .aigv-ctx-btn { background: #333; border: 1px solid #444; border-radius: 4px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; color: #ccc; padding: 0; flex-shrink: 0; }
    .aigv-ctx-btn:hover { background: #444; border-color: #666; color: #fff; }
    .aigv-ctx-btn:active { background: #111; }
    
    .aigv-ctx-btn-full { width: 100%; height: 28px; display: flex; align-items: center; justify-content: center; gap: 6px; background: #333; border: 1px solid #444; border-radius: 4px; cursor: pointer; color: #ccc; font-size: 12px; font-weight: bold; user-select: none; font-family: inherit; }
    .aigv-ctx-btn-full:hover { background: #444; border-color: #666; color: #fff; }
    
    .aigv-ctx-btn svg, .aigv-ctx-btn-full svg { width: 16px; height: 16px; fill: currentColor; }

    /* Loading Overlay */
    .aigv-loading-overlay {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7);
        display: flex; flex-direction: column; justify-content: center; align-items: center;
        color: white; z-index: 1000; font-size: 14px; pointer-events: none; border-radius: 4px;
        text-align: center; padding: 20px; 
        /* 修改: 移除 'Microsoft YaHei'，统一使用 sans-serif */
        font-family: sans-serif;
    }
`;
document.head.appendChild(style);

// --- 2. 辅助工具 (Loading, Download, etc.) ---
const utils = {
    createLoading: (parent, text) => {
        const el = document.createElement('div');
        el.className = 'aigv-loading-overlay';
        el.textContent = text;
        parent.appendChild(el);
        return el;
    },
    updateLoading: (el, text) => {
        if (el) el.textContent = text;
    },
    downloadFile: (filename, url) => {
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.click();
    },
    nextFrame: () => new Promise(resolve => requestAnimationFrame(resolve)),
    formatTime: (seconds) => {
        if (!seconds || isNaN(seconds)) return "0:00:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        // 修改：使用 30fps 计算帧数，替代原来的百分比
        const f = Math.floor((seconds % 1) * 30); 
        const pad = (n) => n.toString().padStart(2, '0');
        return `${m}:${pad(s)}:${pad(f)}`;
    },
    transformCase: (text, mode) => {
        if (!text || !mode) return text;
        if (mode === "upper") return text.toUpperCase();
        if (mode === "lower") return text.toLowerCase();
        if (mode === "title") {
            if (text.length === 0) return text;
            return text.charAt(0).toUpperCase() + text.slice(1);
        }
        return text;
    }
};

// --- 修改点: 扩展名称 ---
app.registerExtension({
    name: "Pix.StoryboardPreviewer", // 建议与节点 Key 保持命名空间一致，虽然不是必须的
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // --- 修改点: 核心匹配逻辑 ---
        if (nodeData.name === "Pix_StoryboardPreviewer") {
            
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;

                const widget = {
                    type: "HTML",
                    name: "preview_container",
                    draw(ctx, node, widget_width, y, widget_height) {},
                    // 修改：减小默认占位高度，避免初始过高 (原为 [200, 300])
                    computeSize: () => [200, 20], 
                };
                this.addCustomWidget(widget);

                this.storyboardDiv = document.createElement("div");
                this.storyboardDiv.className = "aigv-sb-container";
                this.storyboardDiv.style.display = "none";
                document.body.appendChild(this.storyboardDiv);
                
                // 修改点 2: 标记是否包含数据，默认为 false
                this.hasData = false;

                // --- 右键菜单导出功能 (集成版) ---
                this.storyboardDiv.addEventListener('contextmenu', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const oldMenu = document.querySelector('.aigv-ctx-menu');
                    if (oldMenu) oldMenu.remove();

                    const menu = document.createElement('div');
                    menu.className = 'aigv-ctx-menu';
                    menu.style.left = `${e.clientX}px`;
                    menu.style.top = `${e.clientY}px`;

                    const closeMenu = () => { menu.remove(); };

                    // 1. 组装图片导出行
                    const imageRow = createImageExportUI(this.storyboardDiv, closeMenu, utils);
                    menu.appendChild(imageRow);

                    // 2. 组装 HTML 导出行 (移除分割线)
                    const htmlRow = createHtmlExportUI(this.storyboardDiv, closeMenu, utils);
                    menu.appendChild(htmlRow);

                    document.body.appendChild(menu);

                    // 点击外部关闭
                    const handleOutsideClick = (ev) => {
                        if (!menu.contains(ev.target)) {
                            menu.remove();
                            document.removeEventListener('mousedown', handleOutsideClick);
                        }
                    };
                    document.addEventListener('mousedown', handleOutsideClick);
                });

                this.lastPos = { x: 0, y: 0, w: 0, h: 0, scale: 0, nodeW: 0 };

                this.resizeObserver = new ResizeObserver(() => {});
                this.resizeObserver.observe(this.storyboardDiv);
                
                // 修改: 将初始尺寸设置得更小，避免初始留白过大 (原为 [300, 120])
                this.size = [200, 60];

                const onRemoved = this.onRemoved;
                this.onRemoved = function() {
                    if (this.storyboardDiv) {
                        this.storyboardDiv.remove();
                        this.storyboardDiv = null;
                    }
                    if (this.resizeObserver) {
                        this.resizeObserver.disconnect();
                        this.resizeObserver = null;
                    }
                    if (onRemoved) onRemoved.apply(this, arguments);
                }
                return r;
            };

            const onDrawBackground = nodeType.prototype.onDrawBackground;
            nodeType.prototype.onDrawBackground = function (ctx) {
                const r = onDrawBackground ? onDrawBackground.apply(this, arguments) : undefined;
                if (!this.storyboardDiv) return r;
                
                // 修改点 3: 如果没有数据，强制隐藏并退出绘制
                if (!this.hasData || this.flags.collapsed) {
                    this.storyboardDiv.style.display = "none";
                    return r;
                }

                const s = app.canvas.ds.scale;
                const canvasOriginX = app.canvas.ds.offset[0];
                const canvasOriginY = app.canvas.ds.offset[1];
                
                const topMargin = 80; 

                const nodeX = this.pos[0];
                const nodeY = this.pos[1];
                
                const screenX = (nodeX + canvasOriginX) * s;
                const screenY = (nodeY + canvasOriginY) * s;

                const logicPadding = 10;
                const logicW = this.size[0] - (logicPadding * 2);
                const logicH = this.size[1] - topMargin - logicPadding;

                const offsetX = logicPadding * s;
                const offsetY = topMargin * s;
                
                const finalX = screenX + offsetX;
                const finalY = screenY + offsetY;

                const diff = Math.abs(finalX - this.lastPos.x) + 
                             Math.abs(finalY - this.lastPos.y) + 
                             Math.abs(logicW - this.lastPos.w) + 
                             Math.abs(logicH - this.lastPos.h) +
                             Math.abs(s - this.lastPos.scale);

                if (diff > 0.1) {
                    this.storyboardDiv.style.display = "grid";
                    this.storyboardDiv.style.width = `${logicW}px`;
                    this.storyboardDiv.style.height = `${logicH}px`;
                    this.storyboardDiv.style.position = "absolute";
                    this.storyboardDiv.style.transformOrigin = "0 0"; 
                    this.storyboardDiv.style.left = "0px";
                    this.storyboardDiv.style.top = "0px";
                    this.storyboardDiv.style.transform = `translate(${finalX}px, ${finalY}px) scale(${s})`;
                    this.storyboardDiv.style.zIndex = 100;
                    this.storyboardDiv.style.fontSize = ""; 
                    this.storyboardDiv.style.removeProperty("--col-count");

                    this.lastPos = { x: finalX, y: finalY, w: logicW, h: logicH, scale: s };
                }
                return r;
            };

            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function (message) {
                onExecuted?.apply(this, arguments);
                
                const targetWidth = 800; 
                if (this.size[0] < targetWidth) {
                    this.size[0] = targetWidth;
                    // 修改：恢复强制高度限制，并改为 500
                    if (this.size[1] < 500) {
                       this.size[1] = 500;
                    }
                    this.setDirtyCanvas(true, true);
                }

                if (!this.storyboardDiv) return;
                
                const data = message.storyboard_data;
                this.storyboardDiv.innerHTML = "";

                // 修改点 4: 根据是否有数据更新 hasData 状态
                if (!data || data.length === 0) {
                    this.hasData = false;
                    this.storyboardDiv.style.display = "none";
                    return;
                }
                this.hasData = true;

                data.forEach((item, index) => {
                    const card = document.createElement("div");
                    card.className = "aigv-sb-card";

                    // 1. 添加左上角序号标签
                    const tag = document.createElement("div");
                    tag.className = "aigv-sb-tag";
                    tag.textContent = `#${index + 1}`;
                    card.appendChild(tag);

                    // 2. 媒体部分
                    let mediaDiv = null;
                    if (item.image || item.video) {
                        mediaDiv = document.createElement("div");
                        mediaDiv.className = "aigv-sb-media";

                        let videoEl = null;
                        
                        // 准备视频元素
                        if (item.video) {
                            videoEl = document.createElement("video");
                            videoEl.muted = true;
                            videoEl.loop = true;
                            videoEl.preload = "auto"; // 预加载

                            // 构建 URL
                            let videoSrc = "";
                            // 检查是否是 ComfyUI 的 temp/output 对象
                            if (item.video.filename) {
                                videoSrc = api.apiURL(`/view?filename=${encodeURIComponent(item.video.filename)}&type=${item.video.type}&subfolder=${encodeURIComponent(item.video.subfolder || "")}`);
                            } else {
                                // 兜底：如果是字符串路径 (虽然后端应该已经处理了)
                                let rawSrc = item.video;
                                if (!rawSrc.startsWith("http") && !rawSrc.startsWith("blob")) {
                                     videoSrc = api.apiURL(`/view?filename=${encodeURIComponent(rawSrc)}`);
                                } else {
                                    videoSrc = rawSrc;
                                }
                            }
                            videoEl.src = videoSrc;
                        }

                        // 准备图片元素
                        let imgEl = null;
                        if (item.image) {
                            imgEl = document.createElement("img");
                            imgEl.className = "cover-img";
                            imgEl.src = api.apiURL(`/view?filename=${item.image.filename}&type=${item.image.type}&subfolder=${item.image.subfolder}`);
                            // 支持跨域以便 dom-to-image 截图
                            imgEl.crossOrigin = "anonymous";
                        }

                        // 组装 DOM
                        if (imgEl) {
                            mediaDiv.appendChild(imgEl);
                            if (videoEl) {
                                videoEl.className = "bg-video";
                                mediaDiv.classList.add("has-video");
                                mediaDiv.appendChild(videoEl);
                            }
                        } else if (videoEl) {
                            videoEl.className = "main-video";
                            mediaDiv.classList.add("has-video");
                            mediaDiv.appendChild(videoEl);
                        }

                        // 3. 视频预览交互 (进度条与拖动)
                        if (videoEl) {
                            const progBg = document.createElement("div");
                            progBg.className = "aigv-sb-progress";
                            const progFill = document.createElement("div");
                            progFill.className = "aigv-sb-progress-fill";
                            progBg.appendChild(progFill);
                            
                            const timeLabel = document.createElement("div");
                            timeLabel.className = "aigv-sb-time";
                            timeLabel.textContent = "0:00:00";

                            mediaDiv.appendChild(progBg);
                            mediaDiv.appendChild(timeLabel);

                            let rafId = null;
                            let isScrubbing = false; // 状态锁：是否正在鼠标滑动控制中
                            let scrubTimeout = null; // 防抖定时器

                            // 渲染循环：仅当非手动滑动时，才从视频时间更新 UI
                            const updateUI = () => {
                                if (videoEl.duration && !isScrubbing) {
                                    const p = videoEl.currentTime / videoEl.duration;
                                    progFill.style.width = (p * 100) + "%";
                                    // 移除过渡效果以防止跳动，或者保持线性过渡
                                    progFill.style.transition = "width 0.05s linear";
                                    timeLabel.textContent = utils.formatTime(videoEl.currentTime);
                                }
                                rafId = requestAnimationFrame(updateUI);
                            };

                            // 鼠标进入：开始播放
                            mediaDiv.addEventListener("mouseenter", () => {
                                progBg.style.display = "block";
                                timeLabel.style.display = "block";
                                isScrubbing = false;
                                
                                videoEl.play().catch(()=>{});
                                if(rafId) cancelAnimationFrame(rafId);
                                rafId = requestAnimationFrame(updateUI);
                            });

                            // 鼠标离开：暂停
                            mediaDiv.addEventListener("mouseleave", () => {
                                progBg.style.display = "none";
                                timeLabel.style.display = "none";
                                isScrubbing = false;
                                
                                videoEl.pause();
                                if(rafId) cancelAnimationFrame(rafId);
                            });

                            // 鼠标移动：滑动预览
                            mediaDiv.addEventListener("mousemove", (e) => {
                                if (videoEl.duration) {
                                    // 1. 标记正在滑动，暂停 RAF 的 UI 更新
                                    isScrubbing = true;

                                    const rect = mediaDiv.getBoundingClientRect();
                                    const x = e.clientX - rect.left;
                                    const pct = Math.max(0, Math.min(1, x / rect.width));
                                    
                                    // 2. 核心修改：UI 强制跟随鼠标，不等待视频 seek
                                    // 移除 transition 以便瞬间响应鼠标
                                    progFill.style.transition = "none"; 
                                    progFill.style.width = (pct * 100) + "%";
                                    
                                    const targetTime = pct * videoEl.duration;
                                    timeLabel.textContent = utils.formatTime(targetTime);
                                    
                                    // 3. 尝试更新视频时间 (这部分是异步的，可能会有延迟，但 UI 已经更过去了)
                                    // 为了平滑，可以判断差值，但这通常交给浏览器即可
                                    if (Math.abs(videoEl.currentTime - targetTime) > 0.1) {
                                         videoEl.currentTime = targetTime;
                                    }
                                    
                                    // 4. 确保继续播放
                                    if (videoEl.paused) videoEl.play().catch(()=>{});

                                    // 5. 防抖：如果鼠标停下不动 100ms，认为滑动结束，交还控制权给视频
                                    if (scrubTimeout) clearTimeout(scrubTimeout);
                                    scrubTimeout = setTimeout(() => {
                                        isScrubbing = false;
                                    }, 100);
                                }
                            });
                        }
                        
                        card.appendChild(mediaDiv);
                    }

                    // 4. 文本部分 (更新支持 [] 样式语法，包括大小写、富文本和块对齐修复)
                    if (item.metadata && item.metadata.length > 0) {
                        const infoDiv = document.createElement("div");
                        infoDiv.className = "aigv-sb-info";
                        
                        if (!mediaDiv) {
                            infoDiv.classList.add("no-media");
                        }
                        
                        item.metadata.forEach(field => {
                            const row = document.createElement("div");
                            row.className = "aigv-sb-row";
                            
                            // 保存原始数据到 dataset，供导出 HTML 使用
                            row.dataset.rawLabel = field.label || "";
                            row.dataset.rawValue = field.value || "";

                            let labelText = field.label;
                            let valueText = field.value;

                            // 样式配置对象
                            const styles = {
                                align: null,
                                keyColor: null, valColor: null,
                                keySize: null, valSize: null,
                                keyCase: null, valCase: null,
                                keyWeight: null, valWeight: null, // bold
                                keyStyle: null, valStyle: null,   // italic
                                keyDecor: null, valDecor: null,   // underline, strike
                                isBlock: false 
                            };

                            // 解析样式规则
                            if (labelText && typeof labelText === 'string') {
                                // 1. 优先处理 [] 语法
                                if (labelText.trim().startsWith("[")) {
                                    const closeIndex = labelText.indexOf("]");
                                    if (closeIndex > -1) {
                                        const ruleContent = labelText.substring(1, closeIndex);
                                        // 提取完规则后，清理 labelText
                                        labelText = labelText.substring(closeIndex + 1).trim();

                                        // 分割规则部分
                                        const rawParts = ruleContent.split(",").map(s => s.trim());
                                        rawParts.forEach(rawPart => {
                                            const lowerPart = rawPart.toLowerCase();

                                            // Block 检测
                                            if (lowerPart === "block") {
                                                styles.isBlock = true;
                                                return;
                                            }

                                            // 对齐检测
                                            if (["left", "right", "center"].includes(lowerPart)) {
                                                styles.align = lowerPart;
                                                return;
                                            }

                                            // 通用属性检测器
                                            const detectProp = (val, target) => { // target: 'key' or 'val'
                                                if (!val) return;
                                                const vLower = val.toLowerCase();
                                                
                                                // Color (#hex)
                                                if (val.startsWith("#")) {
                                                    if (target === 'key') styles.keyColor = val;
                                                    else styles.valColor = val;
                                                }
                                                // Size (px)
                                                else if (val.endsWith("px")) {
                                                    if (target === 'key') styles.keySize = val;
                                                    else styles.valSize = val;
                                                }
                                                // Case (upper, lower, title)
                                                else if (['upper', 'lower', 'title'].includes(vLower)) {
                                                    if (target === 'key') styles.keyCase = vLower;
                                                    else styles.valCase = vLower;
                                                }
                                                // Font Weight (bold)
                                                else if (vLower === 'bold') {
                                                    if (target === 'key') styles.keyWeight = 'bold';
                                                    else styles.valWeight = 'bold';
                                                }
                                                // Font Style (italic)
                                                else if (vLower === 'italic') {
                                                    if (target === 'key') styles.keyStyle = 'italic';
                                                    else styles.valStyle = 'italic';
                                                }
                                                // Decoration (underline)
                                                else if (vLower === 'underline') {
                                                    if (target === 'key') styles.keyDecor = 'underline';
                                                    else styles.valDecor = 'underline';
                                                }
                                                // Decoration (strike)
                                                else if (vLower === 'strike') {
                                                    if (target === 'key') styles.keyDecor = 'line-through';
                                                    else styles.valDecor = 'line-through';
                                                }
                                            };

                                            // 分割检测 (支持所有属性的 : 分割)
                                            if (rawPart.includes(":")) {
                                                const subParts = rawPart.split(":").map(s => s.trim());
                                                detectProp(subParts[0], 'key');
                                                detectProp(subParts[1], 'val');
                                            } else {
                                                // 单值属性 (默认仅作用于键)
                                                detectProp(rawPart, 'key');
                                            }
                                        });
                                    }
                                } 
                            }

                            // 应用行样式 (对齐)
                            if (styles.align) {
                                row.style.textAlign = styles.align;
                                row.style.textAlignLast = styles.align; 
                                if(styles.align === "right") row.style.justifyContent = "flex-end";
                                if(styles.align === "center") row.style.justifyContent = "center";
                            }

                            // 存在 label (字典模式)
                            if (labelText !== null && labelText !== undefined) {
                                const label = document.createElement("span");
                                label.className = "aigv-sb-label";
                                
                                // 应用大小写转换
                                labelText = utils.transformCase(labelText, styles.keyCase);
                                // 根据是否 Block 模式决定是否加冒号
                                label.textContent = styles.isBlock ? labelText : `${labelText}: `; 
                                
                                // 应用 Label 样式
                                if (styles.keyColor) label.style.color = styles.keyColor;
                                if (styles.keySize) label.style.fontSize = styles.keySize;
                                if (styles.keyWeight) label.style.fontWeight = styles.keyWeight;
                                if (styles.keyStyle) label.style.fontStyle = styles.keyStyle;
                                if (styles.keyDecor) label.style.textDecoration = styles.keyDecor;
                                
                                // 应用 Block 样式
                                if (styles.isBlock) {
                                    label.style.display = "block";
                                }

                                row.appendChild(label);
                            }
                            
                            const content = document.createElement("span");
                            content.className = "aigv-sb-content";
                            
                            // 应用大小写转换
                            valueText = utils.transformCase(valueText, styles.valCase);
                            content.textContent = valueText;
                            
                            // 应用 Value 样式
                            if (styles.valColor) content.style.color = styles.valColor;
                            if (styles.valSize) content.style.fontSize = styles.valSize;
                            if (styles.valWeight) content.style.fontWeight = styles.valWeight;
                            if (styles.valStyle) content.style.fontStyle = styles.valStyle;
                            if (styles.valDecor) content.style.textDecoration = styles.valDecor;

                            // 应用 Block 样式
                            if (styles.isBlock) {
                                content.style.display = "block";
                                // 修复左侧对齐问题：Block 模式下移除默认 padding
                                content.style.paddingLeft = "0px";
                            }

                            row.appendChild(content);
                            infoDiv.appendChild(row);
                        });
                        card.appendChild(infoDiv);
                    }

                    this.storyboardDiv.appendChild(card);
                });
            };
        }
    }
});