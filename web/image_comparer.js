import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// ========================================================
// 第一部分：工具函数区 (不用管细节，照抄即可)
// ========================================================

// 测量文本宽度
function measureText(ctx, str) {
    return ctx.measureText(str).width;
}

// 图片数据转URL
function imageDataToUrl(data) {
    return api.apiURL(`/view?filename=${encodeURIComponent(data.filename)}&type=${data.type}&subfolder=${data.subfolder}${app.getPreviewFormatParam()}${app.getRandParam()}`);
}

// 端口布局配置 (用于支持 Connections Layout)
const LAYOUT_CONFIG = {
    Left:  { dir: LiteGraph.LEFT,  pos: [0, 0.5], offset: [0, 0] },
    Right: { dir: LiteGraph.RIGHT, pos: [1, 0.5], offset: [0, 0] },
    Top:   { dir: LiteGraph.UP,    pos: [0.5, 0], offset: [0, 0] },
    Bottom:{ dir: LiteGraph.DOWN,  pos: [0.5, 1], offset: [0, 0] },
};

// 计算端口坐标的核心数学逻辑
function calcConnectionPos(node, isInput, slotNumber, out) {
    out = out || new Float32Array(2);
    // 默认布局：左进右出
    const layout = (node.properties && node.properties["connections_layout"]) || ["Left", "Right"];
    const side = isInput ? layout[0] : layout[1];
    const config = LAYOUT_CONFIG[side];
    
    if (!config) return out;

    // 设置端口方向（这决定了连线是横着出还是竖着出）
    const slotList = isInput ? node.inputs : node.outputs;
    if (slotList && slotList[slotNumber]) {
        slotList[slotNumber].dir = config.dir;
    }

    // 计算 X, Y 坐标
    if (side === "Left") {
        out[0] = node.pos[0];
        out[1] = node.pos[1] + (slotNumber + 0.7) * LiteGraph.NODE_SLOT_HEIGHT + (node.constructor.slot_start_y || 0);
    } else if (side === "Right") {
        out[0] = node.pos[0] + node.size[0];
        out[1] = node.pos[1] + (slotNumber + 0.7) * LiteGraph.NODE_SLOT_HEIGHT + (node.constructor.slot_start_y || 0);
    } else if (side === "Top") {
        out[0] = node.pos[0] + node.size[0] * 0.5;
        out[1] = node.pos[1];
    } else if (side === "Bottom") {
        out[0] = node.pos[0] + node.size[0] * 0.5;
        out[1] = node.pos[1] + node.size[1];
    }
    return out;
}

// ========================================================
// 第二部分：Widget 交互基类 (处理鼠标点击、拖拽)
// ========================================================

class PixInteractiveWidget {
    constructor(name) {
        this.name = name;
        this.type = "custom";
        this.mouseDowned = null;
        this.hitAreas = {};
    }

    // 检查点击是否在区域内
    isWithin(pos, bounds) {
        const [x, y, w, h] = bounds;
        return pos[0] >= x && pos[0] <= x + w && pos[1] >= y && pos[1] <= y + h;
    }

    // 统一处理 LiteGraph 的鼠标事件
    mouse(event, pos, node) {
        if (event.type === "pointerdown") {
            this.mouseDowned = [...pos];
            // 检查点击了哪个区域
            for (const key in this.hitAreas) {
                const area = this.hitAreas[key];
                if (this.isWithin(pos, area.bounds) && area.onDown) {
                    return area.onDown(event, pos, node, area);
                }
            }
            return this.onMouseDown(event, pos, node);
        }
        
        if (event.type === "pointerup") {
            this.mouseDowned = null;
            return this.onMouseUp(event, pos, node);
        }
        
        if (event.type === "pointermove") {
            return this.onMouseMove(event, pos, node);
        }
        return false;
    }

    // 默认空方法
    onMouseDown(e) {}
    onMouseUp(e) {}
    onMouseMove(e) {}
}

// ========================================================
// 第三部分：Image Comparer 核心逻辑
// ========================================================

class PixImageComparerWidget extends PixInteractiveWidget {
    constructor(name, node) {
        super(name);
        this.node = node;
        this._value = { images: [] }; // 存储图片数据
        this.selected = [];           // 当前选中的两张图片对象 [ImgA, ImgB]
        this.imageCache = new Map();  // 简单的图片缓存
    }

    // 接收 Python 发来的数据
    set value(v) {
        this._value = v;
        // 自动选中前两张图 (F 和 B)
        const images = v.images || [];
        
        // 修改：查找以 F 开头和以 B 开头的图片
        const imgFG = images.find(i => i.name.startsWith("F")) || images[0];
        const imgBG = images.find(i => i.name.startsWith("B")) || images[1];
        
        this.updateSelection([imgFG, imgBG].filter(Boolean));
    }

    get value() { return this._value; }

    // 更新选中图片并预加载
    updateSelection(items) {
        // 标记选中状态供绘制使用
        (this._value.images || []).forEach(i => i.selected = false);
        
        this.selected = items.map(item => {
            item.selected = true;
            // 预加载图片
            if (!item.img) {
                const img = new Image();
                img.src = item.url;
                item.img = img;
            }
            return item;
        });
    }

    draw(ctx, node, width, y) {
        // [调整] 整体向下移动约一个标题的高度 (10px)
        y += 10;

        // 1. 绘制顶部的图片选择器 (如果有多个 Batch)
        const images = this._value.images || [];
        if (images.length > 2) {
            this.drawSelector(ctx, node, y, images);
            y += 20; // 下移内容区
        }

        // 2. 绘制对比区域
        // 获取当前的模式 (Slide 或 Click)
        const mode = node.widgets?.find(w => w.name === "comparer_mode")?.value || "Slide";
        const imgFG = this.selected[0]; // 前景图 (左侧)
        const imgBG = this.selected[1]; // 背景图 (右侧)

        if (!imgFG) return; // 没图不画

        if (mode === "Click") {
            // 点击模式：鼠标按下显示 BG，否则显示 FG
            const showBG = node.isPointerDown && imgBG;
            this.drawImage(ctx, node, showBG ? imgBG : imgFG, y);
        } else {
            // 滑动模式
            
            // 如果鼠标没有放上去，或者没有图片BG，默认显示前景图片 FG。
            if (!node.isPointerOver || !imgBG) {
                this.drawImage(ctx, node, imgFG, y);
            } else {
                // 1. 先画底图 BG (充当右侧内容)
                this.drawImage(ctx, node, imgBG, y);
                
                // 2. 再画上层 FG (充当左侧内容)，并根据鼠标位置裁剪
                const splitX = node.pointerOverPos[0]; 
                this.drawImage(ctx, node, imgFG, y, splitX);
            }
        }
    }

    drawSelector(ctx, node, y, images) {
        ctx.font = "14px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        
        let x = 0;
        const spacing = 10;
        
        // 计算总宽度以居中
        const totalW = images.reduce((acc, img) => acc + measureText(ctx, img.name) + spacing, 0);
        x = (node.size[0] - totalW) / 2;

        images.forEach(img => {
            const w = measureText(ctx, img.name);
            ctx.fillStyle = img.selected ? "#FFF" : "#888";
            ctx.fillText(img.name, x, y);

            // 注册点击区域
            this.hitAreas[img.name] = {
                bounds: [x, y, w, 14],
                onDown: () => {
                    // 简单的切换逻辑：F组点F，B组点B
                    const newSel = [...this.selected];
                    if (img.name.startsWith("F")) newSel[0] = img;
                    else newSel[1] = img;
                    this.updateSelection(newSel);
                    return true; // 标记事件已处理
                }
            };
            x += w + spacing;
        });
    }

    drawImage(ctx, node, imageObj, y, cropX = null) {
        const img = imageObj.img;
        if (!img || !img.complete || img.naturalWidth === 0) return;

        // 计算绘制尺寸 (保持比例，类似 object-fit: contain)
        const areaW = node.size[0];
        const areaH = node.size[1] - y;
        const imgRatio = img.naturalWidth / img.naturalHeight;
        const areaRatio = areaW / areaH;

        let drawW, drawH, drawX, drawY;

        if (imgRatio > areaRatio) {
            drawW = areaW;
            drawH = areaW / imgRatio;
            drawX = 0;
            drawY = y + (areaH - drawH) / 2;
        } else {
            drawH = areaH;
            drawW = areaH * imgRatio;
            drawX = (areaW - drawW) / 2;
            drawY = y;
        }

        ctx.save();
        
        // 处理裁剪 (Slide模式)
        // cropX 是分割线的 X 坐标
        // 这里的逻辑是只保留左侧 [0, cropX] 的内容
        if (cropX !== null) {
            ctx.beginPath();
            ctx.rect(0, y, cropX, areaH); // 只显示左侧
            ctx.clip();
        }

        ctx.drawImage(img, drawX, drawY, drawW, drawH);

        // 绘制分割线
        if (cropX !== null) {
            ctx.beginPath();
            ctx.moveTo(cropX, y);
            ctx.lineTo(cropX, y + areaH);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.restore();
    }
    
    // [补充] 必须实现 computeSize 才能让 LiteGraph 正确计算 Widget 区域
    computeSize(width) {
        return [width, 40]; // 预留一些基础高度
    }
}

// ========================================================
// 第四部分：注册节点扩展
// ========================================================

app.registerExtension({
    name: "Pix.ImageComparer",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "Pix_ImageComparer") {
            
            // 1. 初始化属性默认值
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                if (onNodeCreated) onNodeCreated.apply(this, arguments);
                
                // 默认属性
                this.properties = this.properties || {};
                this.properties["comparer_mode"] = this.properties["comparer_mode"] || "Slide";
                this.properties["connections_layout"] = this.properties["connections_layout"] || ["Left", "Right"];

                // 状态变量
                this.isPointerDown = false;
                this.isPointerOver = false;
                this.pointerOverPos = [0, 0];

                // 添加自定义 Widget
                this.comparerWidget = new PixImageComparerWidget("pix_comparer", this);
                this.addCustomWidget(this.comparerWidget);

                // [调整] 创建时不强制设置大尺寸，让其保持最小默认尺寸
                // this.setSize([400, 400]); 
            };

            // 2. 注入属性访问器 (用于右键 Properties 面板)
            Object.defineProperty(nodeType.prototype, "comparer_mode", {
                get() { return this.properties["comparer_mode"]; },
                set(v) { this.properties["comparer_mode"] = v; }
            });

            // 3. 处理服务器返回数据
            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function(output) {
                if (onExecuted) onExecuted.apply(this, arguments);
                
                const images = [];
                
                // 辅助函数：标准化数据
                // 修改：将前缀改为 F (Foreground) 和 B (Background)
                const addImg = (list, prefix) => {
                    (list || []).forEach((item, i) => {
                        images.push({
                            name: (list.length > 1) ? `${prefix}${i+1}` : prefix,
                            url: imageDataToUrl(item),
                            type: prefix
                        });
                    });
                };

                addImg(output.a_images, "F"); 
                addImg(output.b_images, "B"); 

                // 更新 Widget
                if (this.comparerWidget) {
                    this.comparerWidget.value = { images };
                }

                // [调整] 运行后设置为默认尺寸 400x400
                this.setSize([320, 300]);
            };

            // 4. 鼠标交互事件代理
            const onMouseDown = nodeType.prototype.onMouseDown;
            nodeType.prototype.onMouseDown = function(e, pos) {
                if (onMouseDown) onMouseDown.apply(this, arguments);
                this.isPointerDown = true;
                return false; // 消费事件
            };

            const onMouseUp = nodeType.prototype.onMouseUp;
            nodeType.prototype.onMouseUp = function(e, pos) {
                if (onMouseUp) onMouseUp.apply(this, arguments);
                this.isPointerDown = false;
            };

            const onMouseEnter = nodeType.prototype.onMouseEnter;
            nodeType.prototype.onMouseEnter = function(e) {
                if (onMouseEnter) onMouseEnter.apply(this, arguments);
                this.isPointerOver = true;
            };

            const onMouseLeave = nodeType.prototype.onMouseLeave;
            nodeType.prototype.onMouseLeave = function(e) {
                if (onMouseLeave) onMouseLeave.apply(this, arguments);
                this.isPointerOver = false;
                this.isPointerDown = false;
            };

            const onMouseMove = nodeType.prototype.onMouseMove;
            nodeType.prototype.onMouseMove = function(e, pos) {
                if (onMouseMove) onMouseMove.apply(this, arguments);
                this.pointerOverPos = [...pos];
                // 如果需要持续重绘 (例如 Slide 模式跟随鼠标)
                this.setDirtyCanvas(true, false); 
            };

            // 5. 覆盖端口位置计算 (实现 Connections Layout)
            nodeType.prototype.getConnectionPos = function(isInput, slot, out) {
                return calcConnectionPos(this, isInput, slot, out);
            };

            // 6. 添加右键菜单 (Connections Layout 切换)
            const getExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
            nodeType.prototype.getExtraMenuOptions = function(canvas, options) {
                if (getExtraMenuOptions) getExtraMenuOptions.apply(this, arguments);
                
                options.push(null); // 分隔线
                options.push({
                    content: "Connections Layout",
                    has_submenu: true,
                    callback: (value, opts, e, menu, node) => {
                        const layouts = [
                            ["Left", "Right"], ["Right", "Left"],
                            ["Top", "Bottom"], ["Bottom", "Top"]
                        ];
                        new LiteGraph.ContextMenu(
                            layouts.map(l => ({ content: l.join(" -> ") })),
                            {
                                event: e,
                                parentMenu: menu,
                                callback: (v) => {
                                    node.properties["connections_layout"] = v.content.split(" -> ");
                                    node.setDirtyCanvas(true, true);
                                }
                            }
                        );
                    }
                });
            };
        }
    }
});