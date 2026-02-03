// --- 图片导出模块 (Export Image) ---
// 包含 UI 构建和导出逻辑

let isDomToImageLoading = false;
const loadDomToImageLib = async () => {
    if (window.domtoimage) return true;
    if (isDomToImageLoading) {
        return new Promise(resolve => {
            const check = setInterval(() => {
                if (window.domtoimage) { clearInterval(check); resolve(true); }
            }, 100);
        });
    }
    isDomToImageLoading = true;
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://unpkg.com/dom-to-image-more@3.3.0/dist/dom-to-image-more.min.js";
        script.onload = () => { isDomToImageLoading = false; resolve(true); };
        script.onerror = () => { isDomToImageLoading = false; alert("Failed to load dom-to-image-more."); reject(false); };
        document.head.appendChild(script);
    });
};

/**
 * 创建图片导出行的 UI
 * @param {HTMLElement} targetElement - 需要截图的目标 DOM
 * @param {Function} closeMenuFn - 关闭菜单的回调函数
 * @param {Object} utils - 通用工具函数集合 (loading 等)
 * @returns {HTMLElement} - 返回构建好的行元素
 */
export function createImageExportUI(targetElement, closeMenuFn, utils) {
    const row = document.createElement('div');
    row.className = 'aigv-ctx-row';

    // --- 1. 创建统一的工具栏容器 ---
    const toolbar = document.createElement('div');
    toolbar.style.cssText = `
        width: 100%;
        height: 32px;            /* 修改：高度改为 32px */
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0px;
        background: #333;
        border: 1px solid #444;
        border-radius: 4px;
        padding: 0 4px;
        box-sizing: border-box;
    `;

    // --- 元素1：输入框组 (Up x) ---
    const inputGroup = document.createElement('div');
    inputGroup.className = 'aigv-ctx-input-group';
    inputGroup.style.flexGrow = '0';
    inputGroup.style.display = 'flex';
    inputGroup.style.alignItems = 'center';
    inputGroup.style.gap = '2px'; // Up/x 与数字之间的紧凑间距
    inputGroup.style.position = 'relative'; 
    
    const labelPrefix = document.createElement('span');
    labelPrefix.className = 'aigv-ctx-label';
    labelPrefix.innerText = 'Up'; 
    
    const input = document.createElement('input');
    input.className = 'aigv-ctx-input';
    input.type = 'number';
    input.value = 3; 
    input.step = 1;
    input.min = 1;
    input.max = 10;
    input.style.textAlign = 'center';
    
    const labelSuffix = document.createElement('span');
    labelSuffix.className = 'aigv-ctx-label';
    labelSuffix.innerText = 'x'; 

    // 输入框宽度自适应逻辑
    const measureSpan = document.createElement('span');
    measureSpan.style.visibility = 'hidden';
    measureSpan.style.position = 'absolute';
    measureSpan.style.top = '0';
    measureSpan.style.left = '0';
    measureSpan.style.fontSize = '13px';
    measureSpan.style.fontWeight = 'bold';
    measureSpan.style.fontFamily = 'Microsoft YaHei, sans-serif'; 
    measureSpan.style.whiteSpace = 'pre';
    inputGroup.appendChild(measureSpan);

    const adjustWidth = () => {
        measureSpan.textContent = input.value || "0";
        const width = measureSpan.getBoundingClientRect().width;
        input.style.width = `${Math.max(10, Math.ceil(width) + 1)}px`;
    };
    
    input.addEventListener('input', adjustWidth);
    requestAnimationFrame(adjustWidth); 
    input.onfocus = () => input.select();
    
    inputGroup.appendChild(labelPrefix);
    inputGroup.appendChild(input);
    inputGroup.appendChild(labelSuffix);

    // --- 元素2：垂直分割线 ---
    const separator = document.createElement('div');
    separator.style.cssText = `
        width: 1px;
        height: 14px;
        background: #555;
        margin: 0 6px; /* 控制左右两侧的间距 */
    `;

    // 辅助函数：创建扁平化图标按钮
    const createIconButton = (svgContent, title, onClick) => {
        const btn = document.createElement('div');
        btn.title = title;
        btn.innerHTML = svgContent;
        btn.style.cssText = `
            width: 24px; 
            height: 24px; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            cursor: pointer; 
            border-radius: 3px;
            color: #ccc;
            transition: all 0.2s;
            background: transparent; 
            border: none;           
        `;
        
        btn.onmouseenter = () => { btn.style.background = '#444'; btn.style.color = '#fff'; };
        btn.onmouseleave = () => { btn.style.background = 'transparent'; btn.style.color = '#ccc'; };
        btn.onclick = onClick;

        const svg = btn.querySelector('svg');
        if(svg) { 
            svg.style.width = '16px'; 
            svg.style.height = '16px'; 
            svg.style.fill = 'currentColor'; 
        }
        return btn;
    };

    // --- 元素3：按钮组容器 ---
    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = `
        display: flex;
        align-items: center;
        gap: 1px; /* 按钮之间的间距改为 1px */
    `;

    // 复制按钮
    const btnCopy = createIconButton(
        `<svg viewBox="0 0 24 24"><path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z"/></svg>`,
        "Copy Image to Clipboard",
        () => {
             closeMenuFn();
             const scale = parseFloat(input.value) || 3;
             performImageExport(targetElement, 'copy', scale, utils);
        }
    );
    
    // 保存按钮
    const btnSaveImg = createIconButton(
        `<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`,
        "Save Image as PNG",
        () => {
            closeMenuFn();
            const scale = parseFloat(input.value) || 3;
            performImageExport(targetElement, 'save', scale, utils);
        }
    );

    // 将按钮添加到按钮组
    btnGroup.appendChild(btnCopy);
    btnGroup.appendChild(btnSaveImg);

    // 将各部分组装到工具栏
    toolbar.appendChild(inputGroup);
    toolbar.appendChild(separator); // 插入分割线
    toolbar.appendChild(btnGroup);

    row.appendChild(toolbar);
    return row;
}

// 内部导出逻辑 (保持不变)
const performImageExport = async (targetElement, action, scale, utils) => {
    const loading = utils.createLoading(targetElement, "Loading Lib...");
    
    // 1. 标记开始导出，通知 CSS 禁用 hover
    targetElement.classList.add('aigv-exporting');

    try {
        await loadDomToImageLib();
        utils.updateLoading(loading, "Rendering...");
        await utils.nextFrame();

        const userScale = scale || 3;
        const fullWidth = targetElement.scrollWidth;
        const fullHeight = targetElement.scrollHeight;
        const finalWidth = fullWidth * userScale;
        const finalHeight = fullHeight * userScale;

        const options = {
            bgcolor: '#1e1e1e',
            width: finalWidth,
            height: finalHeight,
            style: {
                transform: `scale(${userScale})`,
                transformOrigin: 'top left',
                width: `${fullWidth}px`,
                height: `${fullHeight}px`,
                overflow: 'hidden', border: 'none', boxSizing: 'border-box'
            },
            filter: (node) => !node.classList?.contains('aigv-loading-overlay')
        };

        if (action === 'copy') {
            const blob = await domtoimage.toBlob(targetElement, options);
            if (!blob) throw new Error("Empty blob");
            await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        } else {
            const dataUrl = await domtoimage.toPng(targetElement, options);
            utils.downloadFile('storyboard_preview.png', dataUrl);
        }
    } catch (err) {
        console.error(err);
        alert("Export Image Failed: " + err.message);
    } finally {
        // 2. 恢复 hover
        targetElement.classList.remove('aigv-exporting');
        loading.remove();
    }
};