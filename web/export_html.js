// --- HTML 导出模块 (Export HTML) ---
// 包含 UI 构建和打包逻辑

let isJSZipLoading = false;
const loadJSZipLib = async () => {
    if (window.JSZip) return true;
    if (isJSZipLoading) {
        return new Promise(resolve => {
            const check = setInterval(() => {
                if (window.JSZip) { clearInterval(check); resolve(true); }
            }, 100);
        });
    }
    isJSZipLoading = true;
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
        script.onload = () => { isJSZipLoading = false; resolve(true); };
        script.onerror = () => { isJSZipLoading = false; alert("Failed to load JSZip."); reject(false); };
        document.head.appendChild(script);
    });
};

/**
 * 创建 HTML 导出行的 UI
 * @param {HTMLElement} targetElement - 需要打包的目标 DOM
 * @param {Function} closeMenuFn - 关闭菜单的回调函数
 * @param {Object} utils - 通用工具函数集合
 * @returns {HTMLElement} - 返回构建好的行元素
 */
export function createHtmlExportUI(targetElement, closeMenuFn, utils) {
    const row = document.createElement('div');
    row.className = 'aigv-ctx-row';

    const btnSaveHtml = document.createElement('div');
    btnSaveHtml.className = 'aigv-ctx-btn-full';
    btnSaveHtml.title = "Download HTML Package with assets (ZIP)";
    
    // 修改：高度设为 32px
    btnSaveHtml.style.height = '32px'; 
    
    // 修改：移除 SVG 图标，仅保留文字
    btnSaveHtml.innerText = "Pack HTML";

    btnSaveHtml.onclick = () => {
        closeMenuFn();
        performHtmlExport(targetElement, utils);
    };

    row.appendChild(btnSaveHtml);
    return row;
}

// --- 核心 CSS (注入到导出的 HTML) ---
const CORE_CSS = `
    :root {
        --bg-color: #121212;
        --card-bg: #1e1e1e;
        --text-color: #e0e0e0;
        --accent-color: #4daafc;
        --sidebar-width: 260px;
        --col-count: 3;
        --card-scale: 0.6; 
        --font-stack: 'Microsoft YaHei', 'SimHei', sans-serif;
    }

    * { box-sizing: border-box; }

    body { 
        background: var(--bg-color); 
        color: var(--text-color); 
        font-family: var(--font-stack);
        margin: 0; 
        min-height: 100vh;
        overflow-y: auto; 
    }

    .app-layout {
        display: block; 
        width: 100%;
        min-height: 100vh;
    }

    /* 侧边栏 */
    .sidebar {
        width: var(--sidebar-width);
        background: #181818;
        border-left: 1px solid #333;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        box-shadow: -2px 0 10px rgba(0,0,0,0.3);
        z-index: 100;
        font-family: var(--font-stack);
        position: fixed;
        right: 0;
        top: 0;
        height: 100vh;
        overflow-y: auto; 
    }

    /* 滚动条样式 */
    ::-webkit-scrollbar { width: 12px; height: 12px; }
    ::-webkit-scrollbar-track { background: #121212; }
    ::-webkit-scrollbar-thumb { background: #444; border-radius: 6px; border: 2px solid #121212; }
    ::-webkit-scrollbar-thumb:hover { background: #666; }

    .sidebar h2 { margin: 0 0 10px 0; font-size: 18px; color: #fff; border-bottom: 1px solid #333; padding-bottom: 10px; font-weight: normal; }
    
    .control-group { display: flex; flex-direction: column; gap: 8px; }
    .control-group label { font-size: 13px; color: #aaa; display: flex; justify-content: space-between; }
    .control-group input[type="range"] { width: 100%; cursor: pointer; }
    .control-value { color: var(--accent-color); font-weight: bold; }
    
    .sidebar-btn {
        background: #333;
        color: #ddd;
        border: 1px solid #444;
        padding: 8px;
        border-radius: 4px;
        cursor: pointer;
        text-align: center;
        font-size: 13px;
        transition: background 0.2s;
        margin-bottom: 8px;
    }
    .sidebar-btn:hover { background: #444; color: #fff; }
    .sidebar-btn.primary { background: #1e3a5a; border-color: #2b5280; }
    .sidebar-btn.primary:hover { background: #2b5280; }

    /* 主内容区 */
    .main-content {
        margin-right: var(--sidebar-width);
        width: auto;
        padding: 40px;
        display: flex;
        justify-content: center;
        position: relative;
    }

    /* 分镜容器 */
    .aigv-sb-container {
        display: grid;
        grid-template-columns: repeat(var(--col-count), 1fr);
        gap: 20px;
        align-content: start;
        width: 100%;
        max-width: calc(100% * var(--card-scale));
        transition: max-width 0.2s ease, grid-template-columns 0.2s ease;
    }

    /* 卡片样式 */
    .aigv-sb-card {
        background: var(--card-bg); 
        border: 1px solid #333; 
        border-radius: 8px; 
        overflow: hidden;
        display: flex; 
        flex-direction: column; 
        box-shadow: 0 4px 10px rgba(0,0,0,0.3); 
        position: relative;
        transition: transform 0.2s, box-shadow 0.2s;
        height: auto;
        cursor: pointer; 
    }
    .aigv-sb-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.5); border-color: #555; }
    
    .aigv-sb-tag {
        position: absolute; top: 6px; left: 6px; z-index: 20; 
        font-weight: bold; font-size: 11px; color: #fff; 
        background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(2px);
        padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);
        font-family: var(--font-stack);
    }

    /* 媒体容器 */
    .aigv-sb-media { 
        position: relative; width: 100%; background: #000; font-size: 0; overflow: hidden; flex-shrink: 0; 
        min-height: 50px; /* 确保无内容时也有高度 */
    }
    .aigv-sb-media img, .aigv-sb-media video { width: 100%; display: block; object-fit: contain; }

    .aigv-sb-media img { position: relative; height: auto; z-index: 10; transition: opacity 0.3s ease; }
    .aigv-sb-media video { position: absolute; top:0; left:0; height:100%; z-index: 5; }

    .aigv-sb-media.video-mode video { position: relative; height: auto; z-index: 5; }
    .aigv-sb-media.video-mode img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 10; }

    .aigv-sb-media.has-video:hover img.cover-img,
    .aigv-sb-media.video-mode:hover img { opacity: 0; }

    .aigv-sb-progress { position: absolute; bottom: 0; left: 0; width: 100%; height: 4px; background: rgba(255,255,255,0.2); z-index: 15; display: none; pointer-events: none; }
    .aigv-sb-progress-fill { width: 0%; height: 100%; background: var(--accent-color); transition: width 0.05s linear; }
    
    /* 修改：移除了 background, padding, border-radius */
    .aigv-sb-time { 
        position: absolute; bottom: 8px; right: 6px; color: #fff; font-size: 11px; font-weight: bold; 
        text-shadow: 0 1px 3px rgba(0,0,0,0.9); z-index: 16; display: none; pointer-events: none; 
        font-family: var(--font-stack); 
    }

    .aigv-sb-info { 
        padding: 12px; font-family: var(--font-stack); font-size: 12px; 
        background: #252525; display: flex; flex-direction: column; gap: 6px; 
        border-top: 1px solid #333; flex-grow: 1; flex-shrink: 0;
    }
    .aigv-sb-row { display: block; line-height: 1.5; border-bottom: 1px solid #333; padding-bottom: 4px; margin-bottom: 2px; }
    .aigv-sb-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .aigv-sb-label { color: #888; margin-right: 5px; }
    .aigv-sb-content { color: #ccc; word-break: break-all; }

    /* 模态框 */
    .modal-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(8px); 
        z-index: 2000;
        display: none;
        justify-content: center;
        align-items: center;
        padding: 40px;
    }
    .modal-overlay.active { display: flex; animation: fadeIn 0.2s ease; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .modal-content {
        background: #1e1e1e;
        border: 1px solid #333;
        border-radius: 12px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        width: 90%;
        max-width: 1400px;
        height: 80vh;
        display: flex;
        overflow: hidden;
        position: relative;
    }

    .modal-close {
        position: absolute; top: 15px; right: 15px;
        width: 32px; height: 32px;
        background: rgba(0,0,0,0.5);
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 50%;
        color: #fff; font-size: 20px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; z-index: 100;
        transition: all 0.2s;
    }
    .modal-close:hover { background: #fff; color: #000; }

    .modal-left {
        flex: 3.5; 
        background: #000;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        position: relative;
    }
    .modal-left img, .modal-left video {
        max-width: 100%; max-height: 100%; object-fit: contain; display: block;
    }

    /* 上传区域样式 */
    .upload-area {
        border: 2px dashed #444;
        border-radius: 8px;
        padding: 40px;
        text-align: center;
        color: #666;
        cursor: pointer;
        transition: all 0.2s;
    }
    .upload-area:hover { border-color: var(--accent-color); color: var(--accent-color); }

    .modal-right {
        flex: 1; 
        background: #252525;
        border-left: 1px solid #333;
        padding: 30px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 15px;
    }
    
    .modal-info-block { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
    .modal-key { font-size: 12px; color: #888; font-weight: bold; outline: none; cursor: text; }
    .modal-value {
        font-size: 14px; color: #eee; background: rgba(0, 0, 0, 0.2);
        padding: 8px 10px; border-radius: 4px; outline: none;
        white-space: pre-wrap; word-break: break-all; line-height: 1.5;
        cursor: text; transition: background 0.2s;
    }
    .modal-value:focus, .modal-key:focus { background: rgba(0, 0, 0, 0.4); }

    .add-field-btn {
        margin-top: auto;
        padding: 10px;
        text-align: center;
        border: 1px dashed #444;
        border-radius: 4px;
        color: #666;
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
    }
    .add-field-btn:hover { border-color: var(--accent-color); color: var(--accent-color); }
`;

// --- 核心 JS (注入到导出的 HTML) ---
const CORE_JS = `
document.addEventListener('DOMContentLoaded', () => {
    
    const container = document.querySelector('.aigv-sb-container');
    
    // --- 1. Settings Panel ---
    const colInput = document.getElementById('col-input');
    const colVal = document.getElementById('col-val');
    const scaleInput = document.getElementById('scale-input');
    const scaleVal = document.getElementById('scale-val');

    function updateGrid() {
        const cols = colInput.value;
        const scale = scaleInput.value / 100;
        document.documentElement.style.setProperty('--col-count', cols);
        document.documentElement.style.setProperty('--card-scale', scale);
        colVal.textContent = cols;
        scaleVal.textContent = scaleInput.value + '%';
    }

    if(colInput && scaleInput) {
        colInput.addEventListener('input', updateGrid);
        scaleInput.addEventListener('input', updateGrid);
        updateGrid();
    }

    // --- Import / Export / Save ---
    
    // 1. Export JSON (Original)
    const btnExportJson = document.getElementById('btn-export-json');
    if (btnExportJson) {
        btnExportJson.addEventListener('click', () => {
            const data = getPageData(false); // keep rules
            const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
            downloadBlob(blob, 'storyboard_data.json');
        });
    }

    // 2. Export Clean JSON (No Rules)
    const btnExportJsonClean = document.getElementById('btn-export-json-clean');
    if (btnExportJsonClean) {
        btnExportJsonClean.addEventListener('click', () => {
            const data = getPageData(true); // clean rules
            const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
            downloadBlob(blob, 'storyboard_data_clean.json');
        });
    }

    // 3. Import JSON
    const fileImport = document.getElementById('file-import-json');
    const btnImportJson = document.getElementById('btn-import-json');
    if(btnImportJson && fileImport) {
        btnImportJson.addEventListener('click', () => fileImport.click());
        fileImport.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if(!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    rebuildGrid(data);
                } catch(err) {
                    alert("Import Failed: " + err);
                }
            };
            reader.readAsText(file);
        });
    }

    // 4. Save as HTML
    const btnSaveHtml = document.getElementById('btn-save-html');
    if (btnSaveHtml) {
        btnSaveHtml.addEventListener('click', () => {
            const clone = document.documentElement.cloneNode(true);
            clone.querySelector('.modal-overlay')?.classList.remove('active');
            clone.querySelector('#col-input').setAttribute('value', colInput.value);
            clone.querySelector('#scale-input').setAttribute('value', scaleInput.value);
            
            // Check for blob URLs
            const hasBlob = Array.from(clone.querySelectorAll('img, video')).some(el => el.src.startsWith('blob:'));
            if(hasBlob) {
                if(!confirm("Warning: You have added new media (blob URLs). 'Save HTML' cannot persist these files permanently. Continue saving HTML only?")) {
                    return;
                }
            }

            const htmlContent = "<!DOCTYPE html>\\n" + clone.outerHTML;
            const blob = new Blob([htmlContent], {type: 'text/html'});
            downloadBlob(blob, 'storyboard_updated.html');
        });
    }

    // --- Data & Helpers ---

    const transformCase = (text, mode) => {
        if (!text || !mode) return text;
        if (mode === "upper") return text.toUpperCase();
        if (mode === "lower") return text.toLowerCase();
        if (mode === "title") {
            if (text.length === 0) return text;
            return text.charAt(0).toUpperCase() + text.slice(1);
        }
        return text;
    };

    function updateMetadataRow(row, rawLabel, rawValue) {
        row.innerHTML = '';
        row.className = 'aigv-sb-row';
        
        // --- 核心修复：重置所有对齐样式，防止删除规则后残留旧样式 ---
        row.style.textAlign = '';
        row.style.textAlignLast = '';
        row.style.justifyContent = '';
        
        // 关键：将含有规则的原始文本保存回去
        row.dataset.rawLabel = rawLabel || "";
        row.dataset.rawValue = rawValue || "";

        let labelText = rawLabel;
        let valueText = rawValue;

        const styles = {
            align: null,
            keyColor: null, valColor: null,
            keySize: null, valSize: null,
            keyCase: null, valCase: null,
            keyWeight: null, valWeight: null,
            keyStyle: null, valStyle: null,
            keyDecor: null, valDecor: null,
            isBlock: false 
        };

        // --- 样式解析引擎 ---
        if (labelText && typeof labelText === 'string') {
            if (labelText.trim().startsWith("[")) {
                const closeIndex = labelText.indexOf("]");
                if (closeIndex > -1) {
                    const ruleContent = labelText.substring(1, closeIndex);
                    labelText = labelText.substring(closeIndex + 1).trim();
                    const rawParts = ruleContent.split(",").map(s => s.trim());
                    rawParts.forEach(rawPart => {
                        const lowerPart = rawPart.toLowerCase();
                        if (lowerPart === "block") { styles.isBlock = true; return; }
                        if (["left", "right", "center"].includes(lowerPart)) { styles.align = lowerPart; return; }
                        const detectProp = (val, target) => {
                            if (!val) return;
                            const vLower = val.toLowerCase();
                            if (val.startsWith("#")) { target === 'key' ? styles.keyColor = val : styles.valColor = val; }
                            else if (val.endsWith("px")) { target === 'key' ? styles.keySize = val : styles.valSize = val; }
                            else if (['upper', 'lower', 'title'].includes(vLower)) { target === 'key' ? styles.keyCase = vLower : styles.valCase = vLower; }
                            else if (vLower === 'bold') { target === 'key' ? styles.keyWeight = 'bold' : styles.valWeight = 'bold'; }
                            else if (vLower === 'italic') { target === 'key' ? styles.keyStyle = 'italic' : styles.valStyle = 'italic'; }
                            else if (vLower === 'underline') { target === 'key' ? styles.keyDecor = 'underline' : styles.valDecor = 'underline'; }
                            else if (vLower === 'strike') { target === 'key' ? styles.keyDecor = 'line-through' : styles.valDecor = 'line-through'; }
                        };
                        if (rawPart.includes(":")) {
                            const subParts = rawPart.split(":").map(s => s.trim());
                            detectProp(subParts[0], 'key');
                            detectProp(subParts[1], 'val');
                        } else {
                            detectProp(rawPart, 'key');
                        }
                    });
                }
            } 
        }

        if (styles.align) {
            row.style.textAlign = styles.align;
            row.style.textAlignLast = styles.align; 
            if(styles.align === "right") row.style.justifyContent = "flex-end";
            if(styles.align === "center") row.style.justifyContent = "center";
        }

        if (labelText !== null && labelText !== undefined) {
            const label = document.createElement("span");
            label.className = "aigv-sb-label";
            labelText = transformCase(labelText, styles.keyCase);
            label.textContent = \`\${labelText}: \`; 
            
            if (styles.keyColor) label.style.color = styles.keyColor;
            if (styles.keySize) label.style.fontSize = styles.keySize;
            if (styles.keyWeight) label.style.fontWeight = styles.keyWeight;
            if (styles.keyStyle) label.style.fontStyle = styles.keyStyle;
            if (styles.keyDecor) label.style.textDecoration = styles.keyDecor;
            if (styles.isBlock) label.style.display = "block";

            row.appendChild(label);
        }
        
        const content = document.createElement("span");
        content.className = "aigv-sb-content";
        valueText = transformCase(valueText, styles.valCase);
        content.textContent = valueText;
        
        if (styles.valColor) content.style.color = styles.valColor;
        if (styles.valSize) content.style.fontSize = styles.valSize;
        if (styles.valWeight) content.style.fontWeight = styles.valWeight;
        if (styles.valStyle) content.style.fontStyle = styles.valStyle;
        if (styles.valDecor) content.style.textDecoration = styles.valDecor;
        if (styles.isBlock) {
            content.style.display = "block";
            content.style.paddingLeft = "0px";
        }

        row.appendChild(content);
    }

    function getPageData(cleanRules = false) {
        const data = [];
        const cards = Array.from(document.querySelectorAll('.aigv-sb-card'));
        cards.forEach((card, index) => {
            const item = { id: index + 1, metadata: {} };
            card.querySelectorAll('.aigv-sb-row').forEach(row => {
                // 获取原始 label
                let label = row.dataset.rawLabel || row.querySelector('.aigv-sb-label')?.innerText.replace(/[:\\s]+$/, '') || 'Key';
                const value = row.dataset.rawValue || row.querySelector('.aigv-sb-content')?.innerText || '';
                
                // 如果需要清理规则，且 label 以 [ 开头
                if (cleanRules && label && label.trim().startsWith("[")) {
                    const closeIndex = label.indexOf("]");
                    if (closeIndex > -1) {
                        label = label.substring(closeIndex + 1).trim();
                    }
                }
                
                item.metadata[label] = value;
            });
            const img = card.querySelector('img');
            if(img) item.image = img.getAttribute('src');
            const video = card.querySelector('video');
            if(video) item.video = video.querySelector('source')?.src || video.src;
            data.push(item);
        });
        return data;
    }

    function downloadBlob(blob, filename) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }

    function rebuildGrid(data) {
        container.innerHTML = '';
        data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'aigv-sb-card';
            
            const tag = document.createElement('div');
            tag.className = 'aigv-sb-tag';
            tag.innerText = '#' + item.id;
            card.appendChild(tag);
            
            if(item.image || item.video) {
                const mediaDiv = document.createElement('div');
                mediaDiv.className = 'aigv-sb-media';
                if(item.video) {
                    mediaDiv.classList.add('video-mode');
                    const vid = document.createElement('video');
                    vid.src = item.video;
                    vid.loop = true;
                    vid.muted = true;
                    mediaDiv.appendChild(vid);
                }
                if(item.image) {
                    const img = document.createElement('img');
                    img.src = item.image;
                    if(item.video) {
                        img.className = 'cover-img';
                        img.style.position = 'absolute';
                        img.style.top = '0'; img.style.left = '0';
                    }
                    mediaDiv.appendChild(img);
                }
                card.appendChild(mediaDiv);
            }
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'aigv-sb-info';
            if(item.metadata) {
                for(const [k, v] of Object.entries(item.metadata)) {
                    const row = document.createElement('div');
                    // 使用新的渲染函数
                    updateMetadataRow(row, k, v);
                    infoDiv.appendChild(row);
                }
            }
            card.appendChild(infoDiv);
            
            bindCardEvents(card);
            container.appendChild(card);
        });
    }

    // --- Video Logic & Events ---
    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return "0:00:00";
        const fps = 30; // Default frame rate
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        // Calculate frames (30fps)
        const f = Math.floor((seconds - Math.floor(seconds)) * fps); 
        const pad = (n) => n.toString().padStart(2, '0');
        return \`\${m}:\${pad(s)}:\${pad(f)}\`;
    };

    function bindCardEvents(card) {
        card.addEventListener('click', () => openModal(card));

        const mediaDiv = card.querySelector('.aigv-sb-media');
        if(!mediaDiv) return;
        const video = mediaDiv.querySelector('video');
        if (!video) return;

        if(!mediaDiv.querySelector('.aigv-sb-progress')) {
            const prog = document.createElement('div'); prog.className = 'aigv-sb-progress';
            prog.innerHTML = '<div class=\"aigv-sb-progress-fill\"></div>';
            mediaDiv.appendChild(prog);
            const time = document.createElement('div'); time.className = 'aigv-sb-time'; time.innerText = '0:00:00';
            mediaDiv.appendChild(time);
        }

        const progBg = mediaDiv.querySelector('.aigv-sb-progress');
        const progFill = mediaDiv.querySelector('.aigv-sb-progress-fill');
        const timeLabel = mediaDiv.querySelector('.aigv-sb-time');
        
        let rafId = null;
        let isScrubbing = false;
        let scrubTimeout = null;

        video.loop = true;
        video.muted = true;

        const updateUI = () => {
            if (video.duration && !isScrubbing) {
                const p = video.currentTime / video.duration;
                if(progFill) progFill.style.width = (p * 100) + "%";
                if(timeLabel) timeLabel.textContent = formatTime(video.currentTime);
            }
            rafId = requestAnimationFrame(updateUI);
        };

        mediaDiv.addEventListener('mouseenter', () => {
            if(progBg) progBg.style.display = 'block';
            if(timeLabel) timeLabel.style.display = 'block';
            
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {});
            }

            if(rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(updateUI);
        });

        mediaDiv.addEventListener('mouseleave', () => {
            if(progBg) progBg.style.display = 'none';
            if(timeLabel) timeLabel.style.display = 'none';
            video.pause();
            if(rafId) cancelAnimationFrame(rafId);
        });

        mediaDiv.addEventListener('mousemove', (e) => {
            if (video.duration) {
                isScrubbing = true;
                const rect = mediaDiv.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const pct = Math.max(0, Math.min(1, x / rect.width));
                if(progFill) { progFill.style.transition = 'none'; progFill.style.width = (pct * 100) + "%"; }
                if(timeLabel) timeLabel.textContent = formatTime(pct * video.duration);
                if (Math.abs(video.currentTime - pct * video.duration) > 0.05) video.currentTime = pct * video.duration;
                if (video.paused) video.play().catch(()=>{});
                if (scrubTimeout) clearTimeout(scrubTimeout);
                scrubTimeout = setTimeout(() => { isScrubbing = false; if(progFill) progFill.style.transition = 'width 0.05s linear'; }, 100);
            }
        });
    }

    // Init bind
    document.querySelectorAll('.aigv-sb-card').forEach(c => {
        if(!c.classList.contains('add-card-placeholder')) bindCardEvents(c);
    });

    // --- Modal Logic ---
    const modal = document.getElementById('preview-modal');
    const modalClose = document.querySelector('.modal-close');
    const modalLeft = document.querySelector('.modal-left');
    const modalRight = document.querySelector('.modal-right');
    let currentCard = null; 

    const openModal = (card) => {
        currentCard = card;
        modalLeft.innerHTML = '';
        modalRight.innerHTML = '';

        if (card) {
            const mediaDiv = card.querySelector('.aigv-sb-media');
            if (mediaDiv) {
                const videoSrc = mediaDiv.querySelector('video')?.currentSrc || mediaDiv.querySelector('video')?.src;
                const imgSrc = mediaDiv.querySelector('img')?.src;
                if (videoSrc) {
                    const video = document.createElement('video'); video.src = videoSrc; video.controls = true; video.autoplay = true; video.loop = true; modalLeft.appendChild(video);
                } else if (imgSrc) {
                    const img = document.createElement('img'); img.src = imgSrc; modalLeft.appendChild(img);
                }
            }
            const infoDiv = card.querySelector('.aigv-sb-info');
            if (infoDiv) {
                infoDiv.querySelectorAll('.aigv-sb-row').forEach(row => {
                    createEditableBlock(row);
                });
            }
            renderAddFieldBtn();
        }
        modal.classList.add('active');
    };

    function createEditableBlock(originalRow) {
        // 修改：直接使用 dataset.rawLabel，获取包含 [rules] 的原始文本
        // 如果没有 dataset (兼容性兜底)，则回退到 innerText
        const rawLabel = originalRow.dataset.rawLabel || (originalRow.querySelector('.aigv-sb-label')?.innerText.replace(/[:\\s]+$/, '') || 'Key');
        const rawValue = originalRow.dataset.rawValue || (originalRow.querySelector('.aigv-sb-content')?.innerText || '');

        const block = document.createElement('div');
        block.className = 'modal-info-block';

        const keyEl = document.createElement('div');
        keyEl.className = 'modal-key';
        keyEl.contentEditable = true;
        keyEl.innerText = rawLabel; // 显示带规则的文本
        
        // 实时预览：当键名改变时，重新渲染原始卡片行
        keyEl.addEventListener('input', () => { 
            updateMetadataRow(originalRow, keyEl.innerText, valEl.innerText);
        });

        const valEl = document.createElement('div');
        valEl.className = 'modal-value';
        valEl.contentEditable = true;
        valEl.innerText = rawValue;
        
        // 实时预览：当值改变时，重新渲染原始卡片行
        valEl.addEventListener('input', () => { 
            updateMetadataRow(originalRow, keyEl.innerText, valEl.innerText);
        });

        block.appendChild(keyEl);
        block.appendChild(valEl);
        modalRight.appendChild(block);
    }

    function renderAddFieldBtn() {
        const btn = document.createElement('div');
        btn.className = 'add-field-btn';
        btn.innerText = '+ Add Field';
        btn.onclick = () => {
            if(!currentCard) return;
            const infoDiv = currentCard.querySelector('.aigv-sb-info');
            
            const row = document.createElement('div');
            // 初始化新行
            updateMetadataRow(row, 'New Key', 'Value');
            infoDiv.appendChild(row);
            
            const block = document.createElement('div');
            block.className = 'modal-info-block';
            const k = document.createElement('div'); k.className='modal-key'; k.contentEditable=true; k.innerText='New Key';
            const v = document.createElement('div'); v.className='modal-value'; v.contentEditable=true; v.innerText='Value';
            
            k.addEventListener('input', () => updateMetadataRow(row, k.innerText, v.innerText));
            v.addEventListener('input', () => updateMetadataRow(row, k.innerText, v.innerText));
            
            block.appendChild(k); block.appendChild(v);
            modalRight.insertBefore(block, btn);
        };
        modalRight.appendChild(btn);
    }

    function renderAddButtonOnly() {
        renderAddFieldBtn();
    }

    const closeModal = () => {
        modal.classList.remove('active');
        modalLeft.innerHTML = '';
        currentCard = null;
    };

    modalClose.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
});
`;

// 导出内部处理函数供调用
const performHtmlExport = async (targetElement, utils) => {
    const loading = utils.createLoading(targetElement, "Loading JSZip...");
    
    try {
        await loadJSZipLib();
        const zip = new JSZip();
        const assetsFolder = zip.folder("assets");
        
        utils.updateLoading(loading, "Analyzing assets...");
        await utils.nextFrame();

        // 1. 克隆 DOM
        const clone = targetElement.cloneNode(true);
        const garbages = clone.querySelectorAll('.aigv-loading-overlay, .aigv-ctx-menu');
        garbages.forEach(el => el.remove());

        // --- 预处理 ---
        clone.querySelectorAll('img').forEach(img => {
            img.removeAttribute('crossorigin');
            img.removeAttribute('loading');
        });

        clone.querySelectorAll('.aigv-sb-media').forEach(div => {
            const vid = div.querySelector('video');
            if (vid) {
                div.classList.add('video-mode');
                vid.className = ''; 
                const img = div.querySelector('img');
                if(img) img.className = '';
            }
        });

        // 4. 下载资源
        const mediaElements = clone.querySelectorAll('img, video');
        let count = 0;
        const total = mediaElements.length;

        for (const el of mediaElements) {
            const src = el.src || el.currentSrc;
            if (!src) continue;

            count++;
            utils.updateLoading(loading, `Downloading ${count}/${total}...`);

            try {
                const response = await fetch(src);
                if (!response.ok) throw new Error("Network error");
                const blob = await response.blob();
                
                let ext = blob.type.split('/')[1] || 'bin';
                if (ext === 'jpeg') ext = 'jpg';
                if (ext === 'quicktime') ext = 'mov'; 
                
                const filename = `media_${count}.${ext}`;
                assetsFolder.file(filename, blob);

                el.src = `./assets/${filename}`;
                
                if (el.tagName.toLowerCase() === 'video') {
                    el.removeAttribute('autoplay');
                    // 核心修改：保留 loop 属性，并添加 preload 和 playsinline 优化加载
                    el.setAttribute('loop', '');
                    el.setAttribute('preload', 'auto');
                    el.setAttribute('playsinline', '');
                    el.muted = true;
                }
            } catch (e) {
                console.warn("Asset download failed:", src, e);
                if (el.tagName.toLowerCase() === 'img') {
                    el.remove();
                }
            }
        }

        // 5. 构建 HTML
        // 注入当前的配置值，确保导出的 HTML 默认就是当前状态
        const currentCols = document.documentElement.style.getPropertyValue('--col-count') || 3;
        // 计算百分比
        let currentScale = 60;
        const scaleVar = document.documentElement.style.getPropertyValue('--card-scale');
        if(scaleVar) currentScale = parseFloat(scaleVar) * 100;

        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Storyboard Gallery</title>
    
    <!-- 引入 JSZip 库 (CDN) 用于客户端打包 -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
    
    <style>
        ${CORE_CSS}
    </style>
</head>
<body>
    <div class="app-layout">
        <!-- 主内容区 -->
        <div class="main-content">
            <div class="aigv-sb-container">
                ${clone.innerHTML}
            </div>
        </div>
        
        <!-- 侧边栏 -->
        <div class="sidebar">
            <h2>Storyboard Settings</h2>
            <div class="control-group">
                <label>Columns <span class="control-value" id="col-val">${currentCols}</span></label>
                <input type="range" id="col-input" min="1" max="6" value="${currentCols}" step="1">
            </div>
            <div class="control-group">
                <label>Card Scale <span class="control-value" id="scale-val">${currentScale}%</span></label>
                <input type="range" id="scale-input" min="20" max="100" value="${currentScale}" step="5">
            </div>
            
            <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 10px;">
                <!-- 修改：移除了 primary 类，改为默认样式 -->
                <button id="btn-save-html" class="sidebar-btn">Save HTML (Overwrite)</button>
                <!-- 删除了 btn-pack-zip -->
                <div style="height:1px; background:#333; margin: 5px 0;"></div>
                <button id="btn-export-json" class="sidebar-btn">Export Metadata JSON</button>
                <button id="btn-export-json-clean" class="sidebar-btn">Export Clean JSON</button>
                <button id="btn-import-json" class="sidebar-btn">Import JSON</button>
                <input type="file" id="file-import-json" accept=".json" style="display:none">
            </div>

            <div style="margin-top: auto; font-size: 11px; color: #555;">Generated by ComfyUI AIGV</div>
        </div>
    </div>

    <!-- 2. 新增模态框结构 -->
    <div class="modal-overlay" id="preview-modal">
        <div class="modal-content">
            <button class="modal-close">×</button>
            <div class="modal-left"></div>
            <div class="modal-right"></div>
        </div>
    </div>

    <script>
        ${CORE_JS}
    </script>
</body>
</html>`;

        zip.file("index.html", htmlContent);

        // 6. 压缩下载
        utils.updateLoading(loading, "Compressing...");
        await utils.nextFrame();
        
        const zipContent = await zip.generateAsync({ type: "blob" });
        const zipUrl = URL.createObjectURL(zipContent);
        utils.downloadFile("storyboard_package.zip", zipUrl);
        URL.revokeObjectURL(zipUrl);

    } catch (err) {
        console.error(err);
        alert("Export HTML Failed: " + err.message);
    } finally {
        loading.remove();
    }
};