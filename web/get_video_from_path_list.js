import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

app.registerExtension({
    name: "PixNodes.VideoPlayer",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "Pix_GetVideoFromPathList") {
            return;
        }

        // 1. 节点创建时：设置回调，防止用户手动输入非法值
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;

            const indexWidget = this.widgets?.find(w => w.name === "index");
            if (indexWidget) {
                // 劫持 callback，一旦值变化（例如用户清空输入框），立即修补
                const originalCallback = indexWidget.callback;
                indexWidget.callback = function(v) {
                    if (v === "" || v === null || v === undefined || isNaN(Number(v))) {
                        this.value = 0; // 强制设为 0
                        // console.log("PixNodes: Fixed invalid index input");
                    }
                    if (originalCallback) {
                        return originalCallback.apply(this, arguments);
                    }
                };
            }
            return r;
        };

        // 2. [核心修复] 节点从存档/刷新恢复配置时：强制检查并修复坏数据
        const onConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function() {
            if (onConfigure) onConfigure.apply(this, arguments);
            
            // 此时 widget 的值已经被 ComfyUI 从存档中恢复了
            // 如果存档里存的是空字符串，现在就是修正它的最佳时机
            const indexWidget = this.widgets?.find(w => w.name === "index");
            if (indexWidget) {
                if (indexWidget.value === "" || indexWidget.value === null || indexWidget.value === undefined) {
                    indexWidget.value = 0;
                    // console.log("PixNodes: Fixed invalid index from save data");
                }
            }
        };

        // --- 以下是原有的预览逻辑，保持不变 ---

        const onExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function(message) {
            onExecuted?.apply(this, arguments);

            if (message && message.video && message.video.length > 0) {
                const videoInfo = message.video[0];
                this.updateVideoWidget(videoInfo);
            }
        };

        // 覆盖 onResize 以处理节点大小变化
        const origOnResize = nodeType.prototype.onResize;
        nodeType.prototype.onResize = function(size) {
            if (origOnResize) {
                origOnResize.apply(this, arguments);
            }
            
            if (this.videoContainer && this.headerHeight) {
                const padding = 8; 
                const availableHeight = size[1] - this.headerHeight - padding;
                
                if (availableHeight > 0) {
                    this.videoContainer.style.height = `${availableHeight}px`;
                }
            }
        };

        nodeType.prototype.updateVideoWidget = function(videoInfo) {
            const params = new URLSearchParams({
                filename: videoInfo.filename,
                type: videoInfo.type,
                subfolder: videoInfo.subfolder || ""
            });
            const videoUrl = api.apiURL("/view?" + params.toString());
            const fps = videoInfo.fps || 30.0;

            let widget = this.widgets?.find(w => w.name === "video_preview");
            
            if (!widget) {
                const container = document.createElement("div");
                this.videoContainer = container;

                Object.assign(container.style, {
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "transparent",
                    position: "relative",
                    overflow: "hidden",
                    marginTop: "2px"
                });

                const video = document.createElement("video");
                Object.assign(video.style, {
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                    pointerEvents: "none" 
                });
                video.loop = true; 
                video.muted = true; 
                
                const progressBg = document.createElement("div");
                Object.assign(progressBg.style, {
                    position: "absolute",
                    bottom: "0",
                    left: "0",
                    width: "100%",
                    height: "4px",
                    backgroundColor: "rgba(255, 255, 255, 0.3)",
                    display: "none", 
                    pointerEvents: "none",
                    zIndex: "10"
                });

                const progressBarFill = document.createElement("div");
                Object.assign(progressBarFill.style, {
                    width: "0%",
                    height: "100%",
                    backgroundColor: "#29b6f6",
                });

                const timeLabel = document.createElement("div");
                Object.assign(timeLabel.style, {
                    position: "absolute",
                    bottom: "6px",
                    right: "4px",
                    color: "rgba(255, 255, 255, 0.9)",
                    fontSize: "10px",
                    fontFamily: "sans-serif",
                    fontWeight: "600",
                    pointerEvents: "none",
                    display: "block", 
                    zIndex: "20",
                    textShadow: "0px 1px 2px rgba(0,0,0,0.8), 0px 0px 4px rgba(0,0,0,0.5)"
                });
                timeLabel.innerText = "00:00:00";

                progressBg.appendChild(progressBarFill);
                container.appendChild(video);
                container.appendChild(progressBg);
                container.appendChild(timeLabel);

                const formatTime = (timeInSeconds) => {
                    const minutes = Math.floor(timeInSeconds / 60);
                    const seconds = Math.floor(timeInSeconds % 60);
                    const frameFrac = timeInSeconds % 1;
                    const frame = Math.floor(frameFrac * fps);
                    const pad = (num) => num.toString().padStart(2, '0');
                    return `${pad(minutes)}:${pad(seconds)}:${pad(frame)}`;
                };

                let rafId = null;
                const updateLoop = () => {
                    if (!video.paused && !video.ended) {
                        if (video.duration) {
                            const pct = (video.currentTime / video.duration) * 100;
                            progressBarFill.style.width = `${pct}%`;
                            timeLabel.innerText = formatTime(video.currentTime);
                        }
                    }
                    rafId = requestAnimationFrame(updateLoop);
                };

                video.onloadedmetadata = () => {
                    widget.computeSize = () => [0, 0];
                    const minSize = this.computeSize(); 
                    this.headerHeight = minSize[1];
                    const nodeWidth = this.size[0];
                    const containerWidth = container.clientWidth > 0 ? container.clientWidth : (nodeWidth - 20);
                    const videoW = video.videoWidth;
                    const videoH = video.videoHeight;
                    
                    if (videoW && videoH) {
                        const aspect = videoW / videoH;
                        let targetHeight;
                        if (aspect < 1) {
                            targetHeight = containerWidth;
                        } else {
                            targetHeight = containerWidth / aspect;
                        }
                        const padding = 8;
                        const requiredHeight = this.headerHeight + targetHeight + padding;
                        container.style.height = `${targetHeight}px`;

                        if (Math.abs(this.size[1] - requiredHeight) > 2) {
                             this.setSize([this.size[0], requiredHeight]);
                        }
                    }

                    if (video.duration) {
                        timeLabel.innerText = formatTime(video.duration);
                    }
                    video.currentTime = 0;
                    video.pause();
                };

                container.onmouseenter = () => {
                    video.play()
                        .then(() => {
                            if (rafId) cancelAnimationFrame(rafId);
                            updateLoop();
                        })
                        .catch(e => console.log("Auto-play prevented", e));
                    progressBg.style.display = "block";
                };

                container.onmouseleave = () => {
                    video.pause();
                    if (rafId) cancelAnimationFrame(rafId);
                    progressBg.style.display = "none";
                    if (video.duration) {
                        timeLabel.innerText = formatTime(video.duration);
                    }
                };

                container.onmousemove = (e) => {
                    if (video.duration) {
                        const rect = container.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const pct = Math.max(0, Math.min(1, x / rect.width));
                        video.currentTime = pct * video.duration;
                        progressBarFill.style.width = `${pct * 100}%`;
                        timeLabel.innerText = formatTime(video.currentTime);
                    }
                };

                widget = this.addDOMWidget("video_preview", "video", container, {
                    serialize: false,
                    hideOnZoom: false
                });
                widget.computeSize = () => [0, 0];
            }

            const videoEl = widget.element.querySelector("video");
            if (videoEl.src !== videoUrl) {
                videoEl.src = videoUrl;
            }
            app.graph.setDirtyCanvas(true, true);
        };
    }
});