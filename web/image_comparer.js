import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

function mediaUrl(data) {
    const params = new URLSearchParams({
        filename: data.filename,
        type: data.type,
        subfolder: data.subfolder || "",
    });
    const preview = data.media_type === "video" ? "" : app.getPreviewFormatParam();
    return api.apiURL(`/view?${params}${preview}${app.getRandParam()}`);
}

function calcConnectionPos(node, isInput, slotNumber, out) {
    out = out || new Float32Array(2);
    const layout = node.properties.connections_layout || ["Left", "Right"];
    const side = isInput ? layout[0] : layout[1];
    const directions = { Left: LiteGraph.LEFT, Right: LiteGraph.RIGHT, Top: LiteGraph.UP, Bottom: LiteGraph.DOWN };
    const slots = isInput ? node.inputs : node.outputs;
    if (slots?.[slotNumber]) slots[slotNumber].dir = directions[side];
    if (side === "Left" || side === "Right") {
        out[0] = node.pos[0] + (side === "Right" ? node.size[0] : 0);
        out[1] = node.pos[1] + (slotNumber + 0.7) * LiteGraph.NODE_SLOT_HEIGHT + (node.constructor.slot_start_y || 0);
    } else {
        out[0] = node.pos[0] + node.size[0] * 0.5;
        out[1] = node.pos[1] + (side === "Bottom" ? node.size[1] : 0);
    }
    return out;
}

function installStyles() {
    if (document.getElementById("pix-comparison-styles")) return;
    const style = document.createElement("style");
    style.id = "pix-comparison-styles";
    style.textContent = `
.dom-widget:has(> .pix-comparison) { width:fit-content !important; height:fit-content !important; }
.pix-comparison { position:relative; display:flex; flex-direction:column; width:0; height:0; min-width:0; min-height:0; overflow:hidden; box-sizing:border-box; border-radius:6px; background:transparent; color:#e4e8ec; font:11px system-ui,sans-serif; user-select:none; }
.pix-comparison * { box-sizing:border-box; }
.pix-comparison.is-panning,.pix-comparison.is-panning * { cursor:grabbing !important; }
.pix-comparison [hidden] { display:none !important; }
.pix-comparison button,.pix-comparison input { font:inherit; }
.pix-comparison button { color:inherit; cursor:pointer; }
.pix-comparison-selectors { display:flex; flex-shrink:0; gap:5px; padding:5px 7px; overflow-x:auto; scrollbar-width:thin; }
.pix-comparison-selectors button { flex-shrink:0; padding:2px 7px; border:1px solid #41464d; border-radius:4px; background:#24282d; }
.pix-comparison-selectors button[aria-pressed="true"] { border-color:#fff; color:#fff; background:#ffffff20; }
.pix-comparison-viewport { position:relative; flex:1 1 0; min-width:0; min-height:0; overflow:hidden; cursor:crosshair; }
.pix-comparison-media { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; pointer-events:none; background:transparent; }
.pix-comparison-divider { position:absolute; top:0; bottom:0; width:1px; background:rgba(255,255,255,.85); pointer-events:none; box-shadow:0 0 3px #000; }
.pix-comparison-message { position:absolute; inset:0; display:grid; place-items:center; padding:15px; color:#9aa4af; text-align:center; pointer-events:none; }
.pix-comparison-controls { position:absolute; left:8px; right:8px; bottom:2px; height:30px; display:flex; align-items:center; gap:8px; padding:0 4px; border-radius:4px; background:linear-gradient(transparent,rgba(0,0,0,.85)); opacity:0; pointer-events:none; transition:opacity .15s; cursor:default; }
.pix-comparison:hover .pix-comparison-controls,.pix-comparison:has(.pix-comparison-speed input:focus) .pix-comparison-controls,.pix-comparison:has(.pix-comparison-volume:active) .pix-comparison-controls { opacity:1; pointer-events:auto; }
.pix-comparison-clock { flex:1; min-width:0; padding:0; border:0; background:transparent; text-align:left; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:#d0d0d0; font-variant-numeric:tabular-nums; text-shadow:0 1px 2px #000; cursor:pointer; }
.pix-comparison-clock:hover { color:#fff; }
.pix-comparison-loop-hint { position:absolute; left:12px; bottom:35px; padding:3px 6px; border-radius:3px; background:#0008; color:#eee; font-size:10px; pointer-events:none; }
.pix-comparison-audio { display:flex; align-items:center; gap:0; height:28px; }
.pix-comparison-audio button { display:grid; place-items:center; width:24px; height:26px; padding:3px; border:0; background:transparent; border-radius:4px; }
.pix-comparison-audio:hover button { color:#fff; background:#ffffff12; }
.pix-comparison-audio button:disabled { opacity:.35; cursor:default; }
.pix-comparison-audio svg { width:17px; height:17px; fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; }
.pix-comparison-volume { appearance:none; -webkit-appearance:none; width:0; min-width:0; height:22px; padding:0; margin:0; border:0; outline:0; background:transparent; opacity:0; pointer-events:none; cursor:ew-resize; transition:width .12s,opacity .12s,margin .12s; }
.pix-comparison-volume::-webkit-slider-runnable-track { height:2px; border-radius:2px; background:rgba(255,255,255,.55); }
.pix-comparison-volume::-webkit-slider-thumb { appearance:none; -webkit-appearance:none; width:7px; height:7px; margin-top:-2.5px; border:0; border-radius:50%; background:#fff; }
.pix-comparison-volume::-moz-range-track { height:2px; border:0; border-radius:2px; background:rgba(255,255,255,.55); }
.pix-comparison-volume::-moz-range-thumb { width:7px; height:7px; border:0; border-radius:50%; background:#fff; }
.pix-comparison-audio:hover .pix-comparison-volume,.pix-comparison-volume:active { width:68px; margin-right:6px; opacity:1; pointer-events:auto; }
.pix-comparison-speed { display:flex; align-items:center; height:25px; padding:0 3px; border:1px solid transparent; border-radius:4px; color:#ddd; }
.pix-comparison-speed:hover,.pix-comparison-speed:focus-within { color:#fff; border-color:#fff; background:#ffffff0c; }
.pix-comparison-speed input { width:36px; padding:2px 0; border:0; outline:0; background:transparent; color:inherit; text-align:right; font-variant-numeric:tabular-nums; }
.pix-comparison-speed input:focus { user-select:text; }
.pix-comparison-timeline { position:relative; height:18px; flex-shrink:0; cursor:ew-resize; touch-action:none; }
.pix-comparison-track { position:absolute; left:9px; right:9px; top:7px; height:3px; border-radius:3px; background:#484848; transition:background .12s,box-shadow .12s; }
.pix-comparison-fill { height:100%; width:0; border-radius:inherit; background:#aaa; position:relative; }
.pix-comparison-fill::after { content:""; position:absolute; right:-4px; top:-2.5px; width:8px; height:8px; border-radius:50%; background:#fff; opacity:0; }
.pix-comparison-timeline:hover .pix-comparison-track,.pix-comparison-timeline:active .pix-comparison-track { background:#888; box-shadow:0 0 6px #ffffff33; }
.pix-comparison-timeline:hover .pix-comparison-fill { background:#fff; }
.pix-comparison-timeline:hover .pix-comparison-fill::after { opacity:1; }
`;
    document.head.appendChild(style);
}

function timecode(time, fps) {
    const seconds = Math.max(0, time || 0);
    const hours = Math.floor(seconds / 3600);
    const parts = [Math.floor(seconds / 60) % 60, Math.floor(seconds) % 60, Math.floor((seconds % 1) * fps + 1e-5)];
    if (hours) parts.unshift(hours);
    return parts.map(value => String(value).padStart(2, "0")).join(":");
}

class ComparisonViewer {
    constructor(node) {
        this.node = node;
        this.abort = new AbortController();
        this.mediaAbort = new AbortController();
        this.groups = { F: [], B: [] };
        this.selected = [];
        this.time = 0;
        this.duration = 0;
        this.split = 0.5;
        this.playing = false;
        this.playRequest = 0;
        this.animation = 0;
        this.scrubbing = false;
        this.panPointerId = null;
        this.hintTimer = 0;
        this.wheelRemainders = new Map();
        this.element = document.createElement("div");
        this.element.className = "pix-comparison";
        this.element.innerHTML = `
<div class="pix-comparison-selectors" hidden></div>
<div class="pix-comparison-viewport">
  <div class="pix-comparison-divider" hidden></div>
  <div class="pix-comparison-message">连接图像或视频以开始对比</div>
  <span class="pix-comparison-loop-hint" role="status" aria-live="polite" hidden></span>
  <div class="pix-comparison-controls" hidden>
    <button class="pix-comparison-clock" type="button" data-control="timeline"></button>
    <div class="pix-comparison-audio" data-control="volume">
      <input class="pix-comparison-volume" type="range" min="0" max="1" step="0.01" aria-label="音量">
      <button type="button" aria-label="静音或恢复声音">
        <svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path data-sound d="M17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/><path data-muted d="m17 9 5 6m0-6-5 6"/></svg>
      </button>
    </div>
    <label class="pix-comparison-speed" data-control="speed" title="滚轮调节倍速；点击数字直接输入">
      <input type="text" inputmode="decimal" aria-label="播放速度" value="1.00" spellcheck="false"><span>×</span>
    </label>
  </div>
</div>
<div class="pix-comparison-timeline" data-control="timeline" role="slider" aria-label="播放进度" aria-valuemin="0" title="滚轮：暂停时 1 帧，Shift 10 帧；播放时 0.5 秒，Shift 1 秒；点击或拖动定位" hidden>
  <div class="pix-comparison-track"><div class="pix-comparison-fill"></div></div>
</div>`;
        this.selectors = this.element.querySelector(".pix-comparison-selectors");
        this.viewport = this.element.querySelector(".pix-comparison-viewport");
        this.divider = this.element.querySelector(".pix-comparison-divider");
        this.message = this.element.querySelector(".pix-comparison-message");
        this.controls = this.element.querySelector(".pix-comparison-controls");
        this.clock = this.element.querySelector(".pix-comparison-clock");
        this.loopHint = this.element.querySelector(".pix-comparison-loop-hint");
        this.volume = this.element.querySelector(".pix-comparison-volume");
        this.audioButton = this.element.querySelector(".pix-comparison-audio button");
        this.speedInput = this.element.querySelector(".pix-comparison-speed input");
        this.timeline = this.element.querySelector(".pix-comparison-timeline");
        this.fill = this.element.querySelector(".pix-comparison-fill");
        this.restoreProperties();
        this.bindEvents();
    }

    get videos() { return this.selected.filter(item => item.kind === "video"); }
    get master() { return this.videos[0]; }
    get fps() { return this.master?.fps || 24; }

    listen(element, name, callback, options = {}) {
        element.addEventListener(name, callback, { ...options, signal: this.abort.signal });
    }

    restoreProperties() {
        const props = this.node.properties;
        this.muted = props.comparison_muted ?? true;
        this.loop = props.comparison_loop ?? true;
        props.comparison_loop = this.loop;
        this.volumeValue = Math.min(1, Math.max(0, Number(props.comparison_volume ?? 0.75)));
        this.lastVolume = this.volumeValue || 0.75;
        this.speed = Math.min(16, Math.max(0.0625, Number(props.comparison_speed) || 1));
        this.audioSource = props.comparison_audio_source || "F";
        this.volume.value = this.volumeValue;
        this.speedInput.value = this.speed.toFixed(2);
        this.applyAudio();
        for (const item of this.videos) item.element.playbackRate = this.speed;
        this.updateSplit();
        this.updateTime();
    }

    bindEvents() {
        for (const name of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) {
            this.listen(document, name, event => this.onPanPointer(event), { capture: true });
        }
        this.listen(this.element, "auxclick", event => {
            if (event.button === 1) {
                event.preventDefault();
                event.stopPropagation();
            }
        });
        for (const name of ["pointerdown", "pointerup", "click", "dblclick", "keydown", "keyup"]) {
            this.listen(this.element, name, event => event.stopPropagation());
        }
        this.listen(this.element, "wheel", event => this.onWheel(event), { passive: false, capture: true });
        // Nodes 2.0 forwards wheel events before they reach DOM widgets.
        this.listen(document, "wheel", event => {
            if (this.element.contains(event.target) && this.wheelControl(event)) this.onWheel(event);
        }, { passive: false, capture: true });
        this.listen(this.clock, "click", () => {
            this.loop = !this.loop;
            this.node.properties.comparison_loop = this.loop;
            this.updateTime();
            this.loopHint.textContent = this.loop ? "循环播放" : "单次播放";
            this.loopHint.hidden = false;
            clearTimeout(this.hintTimer);
            this.hintTimer = setTimeout(() => { this.loopHint.hidden = true; }, 1400);
        });
        this.listen(this.viewport, "pointermove", event => {
            if (event.target.closest(".pix-comparison-controls")) return;
            const rect = this.viewport.getBoundingClientRect();
            this.split = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
            this.updateSplit();
        });
        this.listen(this.viewport, "pointerenter", () => this.updateSplit());
        this.listen(this.viewport, "pointerleave", () => {
            this.pressed = null;
            this.imagePressed = false;
            this.updateSplit();
        });
        this.listen(this.viewport, "pointerdown", event => {
            if (event.button !== 0 || event.target.closest(".pix-comparison-controls")) return;
            this.pressed = [event.clientX, event.clientY];
            this.imagePressed = true;
            this.updateSplit();
        });
        this.listen(this.viewport, "pointerup", event => {
            if (event.button !== 0 || event.target.closest(".pix-comparison-controls")) return;
            const pressed = this.pressed;
            this.pressed = null;
            this.imagePressed = false;
            if (pressed && Math.hypot(event.clientX - pressed[0], event.clientY - pressed[1]) < 5 && this.videos.length) {
                this.togglePlayback();
            }
            this.updateSplit();
        });
        this.listen(this.timeline, "pointerdown", event => {
            if (event.button !== 0 || !this.duration) return;
            event.preventDefault();
            this.resumeAfterScrub = this.playing;
            this.pause();
            this.scrubbing = true;
            this.timeline.setPointerCapture(event.pointerId);
            this.seekFromPointer(event);
            this.applyAudio();
        });
        this.listen(this.timeline, "pointermove", event => {
            if (this.scrubbing) this.seekFromPointer(event);
        });
        for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) {
            this.listen(this.timeline, name, () => {
                if (!this.scrubbing) return;
                this.scrubbing = false;
                this.applyAudio();
                if (this.resumeAfterScrub) this.play();
            });
        }
        this.listen(this.audioButton, "click", () => {
            if (!this.audioButton.disabled) {
                this.muted = !this.muted;
                if (!this.muted && this.volumeValue === 0) this.setVolume(this.lastVolume);
                this.applyAudio();
            }
        });
        this.listen(this.volume, "input", () => this.setVolume(Number(this.volume.value)));
        this.listen(this.speedInput, "focus", () => this.speedInput.select());
        this.listen(this.speedInput, "blur", () => this.commitSpeed());
        this.listen(this.speedInput, "keydown", event => {
            if (event.key === "Enter") {
                this.commitSpeed();
                this.speedInput.blur();
            } else if (event.key === "Escape") {
                this.speedInput.value = this.speed.toFixed(2);
                this.speedInput.blur();
            }
        });
    }

    onPanPointer(event) {
        if (event.type === "pointerdown") {
            if (event.button !== 1 || !this.element.contains(event.target)) return;
            this.panPointerId = event.pointerId;
            this.element.classList.add("is-panning");
            this.element.setPointerCapture(event.pointerId);
        }
        if (event.pointerId !== this.panPointerId) return;
        if (event.type === "pointerup" || event.type === "pointercancel") {
            this.panPointerId = null;
            this.element.classList.remove("is-panning");
        }
        const canvas = app.canvas?.canvas;
        if (!canvas || event.target === canvas) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        canvas.dispatchEvent(new PointerEvent(event.type, event));
    }

    setMedia(output) {
        this.fitPending = true;
        this.groups = {
            F: (output.a_images || []).map(item => ({ ...item, side: "F" })),
            B: (output.b_images || []).map(item => ({ ...item, side: "B" })),
        };
        this.selectors.replaceChildren();
        this.selectors.hidden = Object.values(this.groups).every(items => items.length <= 1);
        for (const [side, items] of Object.entries(this.groups)) {
            items.forEach((item, index) => {
                const button = document.createElement("button");
                button.type = "button";
                button.textContent = items.length > 1 ? `${side}${index + 1}` : side;
                button.dataset.side = side;
                button.dataset.index = index;
                button.addEventListener("click", () => this.select(side, index));
                this.selectors.appendChild(button);
            });
        }
        this.indices = { F: 0, B: 0 };
        this.loadSelection();
    }

    select(side, index) {
        this.indices[side] = index;
        this.loadSelection();
    }

    releaseMedia() {
        this.pause();
        clearTimeout(this.hintTimer);
        this.loopHint.hidden = true;
        this.mediaAbort.abort();
        this.mediaAbort = new AbortController();
        for (const item of this.selected) {
            if (item.kind === "video") {
                item.element.removeAttribute("src");
                item.element.load();
            }
            item.element.remove();
        }
        this.selected = [];
    }

    loadSelection() {
        this.releaseMedia();
        this.time = 0;
        this.duration = 0;
        this.scrubbing = false;
        this.message.hidden = false;
        this.message.textContent = "正在加载…";
        for (const side of ["B", "F"]) {
            const data = this.groups[side][this.indices[side]];
            if (!data) continue;
            const kind = data.media_type === "video" ? "video" : "image";
            const element = document.createElement(kind === "video" ? "video" : "img");
            const item = { ...data, kind, element };
            this.selected.push(item);
            element.className = "pix-comparison-media";
            element.draggable = false;
            const options = { signal: this.mediaAbort.signal };
            element.addEventListener("error", () => {
                this.pause();
                this.message.textContent = "预览加载失败，请重新运行节点";
                this.message.hidden = false;
            }, options);
            if (kind === "video") {
                element.preload = "auto";
                element.muted = true;
                element.playsInline = true;
                element.disablePictureInPicture = true;
                element.playbackRate = this.speed;
                element.addEventListener("loadedmetadata", () => this.metadataLoaded(), options);
                element.addEventListener("loadeddata", () => this.mediaReady(), options);
                element.addEventListener("seeked", () => this.mediaReady(), options);
                element.addEventListener("ended", () => {
                    if (element.ended) this.finishPlayback();
                }, options);
            } else {
                element.alt = side === "F" ? "前景" : "背景";
                element.addEventListener("load", () => this.mediaReady(), options);
            }
            element.src = mediaUrl(data);
            this.viewport.insertBefore(element, this.divider);
        }
        // Foreground is the playback clock, even though background is inserted first for layering.
        this.selected.sort((a, b) => a.side.localeCompare(b.side)).reverse();
        if (!this.videos.some(item => item.side === this.audioSource && item.has_audio)) {
            this.audioSource = this.videos.find(item => item.has_audio)?.side || this.master?.side || "F";
        }
        this.controls.hidden = !this.videos.length;
        this.timeline.hidden = !this.videos.length;
        if (!this.selected.length) this.message.textContent = "连接图像或视频以开始对比";
        for (const button of this.selectors.children) {
            button.setAttribute("aria-pressed", String(this.indices[button.dataset.side] === Number(button.dataset.index)));
        }
        this.applyAudio();
        this.updateTime();
        this.updateSplit();
    }

    mediaReady() {
        const ready = this.selected.every(item => item.kind === "video" ? item.element.readyState >= 2 : item.element.complete && item.element.naturalWidth > 0);
        if (ready && this.selected.length) {
            this.message.hidden = true;
            if (this.fitPending) {
                this.fitPending = false;
                this.fitNodeToMedia();
            }
        }
    }

    widgetTop() {
        const widget = this.node.comparerWidget;
        return widget.y || Math.max(0, this.node.computeSize()[1] - widget.options.getMinHeight());
    }

    resize() {
        const widget = this.node.comparerWidget;
        if (!widget) return;
        const margin = widget.margin;
        const width = Math.max(0, Math.floor(this.node.size[0] - margin * 2));
        const height = Math.max(0, Math.floor(this.node.size[1] - this.widgetTop() - margin * 2));
        if (this.width !== width || this.height !== height) {
            this.width = width;
            this.height = height;
            this.element.style.width = `${width}px`;
            this.element.style.height = `${height}px`;
        }
    }

    fitNodeToMedia() {
        const item = this.selected.find(media => media.side === "F") || this.selected[0];
        const width = item.kind === "video" ? item.element.videoWidth : item.element.naturalWidth;
        const height = item.kind === "video" ? item.element.videoHeight : item.element.naturalHeight;
        const scale = Math.min(Math.max(1, 260 / width), 640 / width, 480 / height);
        const mediaWidth = Math.max(260, Math.round(width * scale));
        const mediaHeight = Math.max(120, Math.round(height * scale));
        const margin = this.node.comparerWidget.margin;
        const controlsHeight = (this.selectors.hidden ? 0 : this.selectors.offsetHeight || 30) + (this.timeline.hidden ? 0 : 18);
        this.node.setSize([mediaWidth + margin * 2, this.widgetTop() + mediaHeight + controlsHeight + margin * 2]);
        this.resize();
        this.node.setDirtyCanvas(true, true);
    }

    metadataLoaded() {
        const videos = this.videos;
        if (videos.every(item => Number.isFinite(item.element.duration) && item.element.duration > 0)) {
            this.duration = Math.min(...videos.map(item => item.element.duration));
            this.seekTo(this.time);
            this.timeline.setAttribute("aria-valuemax", String(this.duration));
        }
        this.applyAudio();
    }

    updateSplit() {
        const foreground = this.selected.find(item => item.side === "F");
        const background = this.selected.find(item => item.side === "B");
        this.divider.hidden = !foreground || !background;
        if (!foreground || !background) {
            for (const item of this.selected) item.element.style.clipPath = "";
            return;
        }
        const clickMode = !this.videos.length && this.node.properties.comparer_mode === "Click";
        if (clickMode) {
            foreground.element.style.clipPath = this.imagePressed ? "inset(0 100% 0 0)" : "";
            background.element.style.clipPath = this.imagePressed ? "" : "inset(0 0 0 100%)";
            this.divider.hidden = true;
        } else {
            const split = !this.videos.length && !this.viewport.matches(":hover") ? 1 : this.split;
            foreground.element.style.clipPath = `inset(0 ${(1 - split) * 100}% 0 0)`;
            background.element.style.clipPath = `inset(0 0 0 ${split * 100}%)`;
            this.divider.style.left = `${split * 100}%`;
            this.divider.hidden = split === 1;
        }
    }

    updateTime() {
        this.clock.textContent = `${timecode(this.time, this.fps)} / ${timecode(this.duration, this.fps)}`;
        this.clock.title = `${this.loop ? "循环播放" : "单次播放"}；单击切换；滚轮：暂停时 1 帧，Shift 10 帧；播放时 0.5 秒，Shift 1 秒`;
        this.clock.setAttribute("aria-pressed", String(this.loop));
        this.fill.style.width = `${this.duration ? this.time / this.duration * 100 : 0}%`;
        this.timeline.setAttribute("aria-valuenow", String(this.time));
        this.timeline.setAttribute("aria-valuetext", this.clock.textContent);
    }

    seekTo(seconds, byFrame = false) {
        if (!this.duration) return;
        this.time = Math.min(this.duration, Math.max(0, seconds));
        for (const item of this.videos) {
            let target = this.time;
            if (byFrame) target = (Math.floor(target * item.fps + 1e-5) + 0.5) / item.fps;
            item.element.currentTime = Math.min(target, Math.max(0, item.element.duration - 0.001));
        }
        this.updateTime();
    }

    seekFromPointer(event) {
        const rect = this.timeline.querySelector(".pix-comparison-track").getBoundingClientRect();
        this.seekTo((event.clientX - rect.left) / rect.width * this.duration);
    }

    stepFrames(frames) {
        if (!this.duration) return;
        const resume = this.playing;
        const time = resume ? this.master.element.currentTime : this.time;
        this.pause();
        const lastFrame = Math.max(0, Math.ceil(this.duration * this.fps - 1e-5) - 1);
        const frame = Math.min(lastFrame, Math.max(0, Math.floor(time * this.fps + 1e-5) + frames));
        this.seekTo(frame / this.fps, true);
        if (resume) this.play();
    }

    stepSeconds(seconds) {
        if (!this.duration) return;
        const resume = this.playing;
        const time = resume ? this.master.element.currentTime : this.time;
        if (resume && time + seconds >= this.duration - 0.001) {
            this.seekTo(this.duration);
            this.finishPlayback();
            return;
        }
        this.pause();
        this.seekTo(time + seconds);
        if (resume) this.play();
    }

    togglePlayback() {
        if (this.playing) this.pause();
        else this.play();
    }

    async play() {
        if (!this.duration || !this.videos.length) return;
        if (this.time >= this.duration - 0.001) this.seekTo(0);
        const request = ++this.playRequest;
        this.playing = true;
        this.applyAudio();
        try {
            await Promise.all(this.videos.map(item => item.element.play()));
            if (request === this.playRequest && this.playing) this.tick();
        } catch (error) {
            if (request !== this.playRequest) return;
            this.pause();
            this.message.textContent = `无法播放视频：${error.message}`;
            this.message.hidden = false;
        }
    }

    pause() {
        this.playing = false;
        this.playRequest++;
        cancelAnimationFrame(this.animation);
        this.animation = 0;
        for (const item of this.videos) item.element.pause();
        this.updateTime();
    }

    tick() {
        if (!this.playing) return;
        const master = this.master;
        this.time = Math.min(master.element.currentTime, this.duration);
        if (this.time >= this.duration - 0.001) {
            this.finishPlayback();
            return;
        }
        for (const item of this.videos) {
            if (item !== master && !item.element.seeking && Math.abs(item.element.currentTime - this.time) > Math.max(0.04, 1 / item.fps)) {
                item.element.currentTime = this.time;
            }
        }
        this.updateTime();
        this.animation = requestAnimationFrame(() => this.tick());
    }

    finishPlayback() {
        if (!this.playing) return;
        this.time = this.duration;
        this.pause();
        if (this.loop) {
            this.seekTo(0);
            this.play();
        }
    }

    applyAudio() {
        for (const item of this.videos) {
            item.element.volume = this.volumeValue;
            item.element.muted = this.muted || this.scrubbing || this.volumeValue === 0 || item.side !== this.audioSource;
        }
        const muted = this.muted || this.volumeValue === 0;
        this.audioButton.querySelector("[data-sound]").style.display = muted ? "none" : "";
        this.audioButton.querySelector("[data-muted]").style.display = muted ? "" : "none";
        this.audioButton.disabled = !this.videos.length;
        this.audioButton.setAttribute("aria-pressed", String(muted));
        this.audioButton.title = muted ? "点击恢复声音；悬停或滚轮调节音量" : "点击静音；悬停或滚轮调节音量";
        if (!this.videos.some(item => item.has_audio)) this.audioButton.title = `当前视频无音轨；${this.audioButton.title}`;
        Object.assign(this.node.properties, {
            comparison_volume: this.volumeValue,
            comparison_muted: this.muted,
            comparison_audio_source: this.audioSource,
        });
    }

    setVolume(value) {
        this.volumeValue = Math.min(1, Math.max(0, Math.round(value * 100) / 100));
        if (this.volumeValue > 0) this.lastVolume = this.volumeValue;
        this.muted = this.volumeValue === 0;
        this.volume.value = this.volumeValue;
        this.applyAudio();
    }

    setSpeed(value) {
        if (!Number.isFinite(value) || value <= 0) return;
        this.speed = Math.min(16, Math.max(0.0625, value));
        for (const item of this.videos) item.element.playbackRate = this.speed;
        this.node.properties.comparison_speed = this.speed;
        this.speedInput.value = this.speed.toFixed(2);
    }

    commitSpeed() {
        this.setSpeed(Number(this.speedInput.value.trim().replace(/[×x]$/i, "")));
        this.speedInput.value = this.speed.toFixed(2);
    }

    wheelSteps(event, control) {
        if (event.deltaMode === 0 && Math.abs(event.deltaY) < 40) {
            const delta = (this.wheelRemainders.get(control) || 0) - event.deltaY;
            const steps = Math.trunc(delta / 40);
            this.wheelRemainders.set(control, delta - steps * 40);
            return steps;
        }
        return -Math.sign(event.deltaY) * Math.max(1, Math.round(Math.abs(event.deltaY) / 100));
    }

    wheelControl(event) {
        if (!this.videos.length || event.ctrlKey || event.metaKey) return undefined;
        let control = event.target.closest("[data-control]")?.dataset.control;
        if (!control && event.altKey && this.viewport.contains(event.target)) control = "timeline";
        return control;
    }

    onWheel(event) {
        const control = this.wheelControl(event);
        event.preventDefault();
        event.stopImmediatePropagation();
        if (control) {
            const steps = this.wheelSteps(event, control);
            if (!steps) return;
            if (control === "timeline") {
                if (this.playing) this.stepSeconds(-steps * (event.shiftKey ? 1 : 0.5));
                else this.stepFrames(-steps * (event.shiftKey ? 10 : 1));
            }
            else if (control === "volume") this.setVolume(this.volumeValue + steps * 0.05);
            else if (control === "speed") this.setSpeed(this.speed + steps * 0.25);
            return;
        }
        const canvas = app.canvas?.canvas;
        canvas?.dispatchEvent(new WheelEvent("wheel", {
            deltaX: event.deltaX, deltaY: event.deltaY, deltaZ: event.deltaZ, deltaMode: event.deltaMode,
            clientX: event.clientX, clientY: event.clientY,
            ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, altKey: event.altKey, metaKey: event.metaKey,
            bubbles: true, cancelable: true,
        }));
    }

    dispose() {
        this.releaseMedia();
        this.mediaAbort.abort();
        this.abort.abort();
        this.element.remove();
    }
}

app.registerExtension({
    name: "Pix.ComparisonViewer",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "Pix_ComparisonViewer") return;
        installStyles();
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            onNodeCreated?.apply(this, arguments);
            this.properties ||= {};
            this.properties.comparer_mode ||= "Slide";
            this.properties.connections_layout ||= ["Left", "Right"];
            this.comparisonViewer = new ComparisonViewer(this);
            this.comparerWidget = this.addDOMWidget("pix_comparer", "comparison", this.comparisonViewer.element, {
                serialize: false,
                hideOnZoom: false,
                getMinHeight: () => 180,
                onDraw: () => this.comparisonViewer.resize(),
            });
            this.setSize([Math.max(this.size[0], 320), Math.max(this.size[1], 260)]);
            this.comparisonViewer.resize();
        };
        const onResize = nodeType.prototype.onResize;
        nodeType.prototype.onResize = function () {
            onResize?.apply(this, arguments);
            this.comparisonViewer?.resize();
        };
        const onConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            onConfigure?.apply(this, arguments);
            for (const slot of this.inputs || []) {
                if (slot.name === "foreground_image" || slot.name === "background_image") slot.type = "IMAGE,VIDEO";
            }
            if (["Image Comparer", "Image Comparer (PixNodes)", "图像对比"].includes(this.title)) {
                this.title = this.constructor.title;
            }
            this.comparisonViewer?.restoreProperties();
            this.comparisonViewer?.resize();
        };
        const onExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (output) {
            onExecuted?.apply(this, arguments);
            this.comparisonViewer?.setMedia(output);
        };
        const onRemoved = nodeType.prototype.onRemoved;
        nodeType.prototype.onRemoved = function () {
            this.comparisonViewer?.dispose();
            onRemoved?.apply(this, arguments);
        };
        nodeType.prototype.getConnectionPos = function (isInput, slot, out) {
            return calcConnectionPos(this, isInput, slot, out);
        };
        const getExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
        nodeType.prototype.getExtraMenuOptions = function (canvas, options) {
            getExtraMenuOptions?.apply(this, arguments);
            const viewer = this.comparisonViewer;
            options.push(null);
            if (viewer?.videos.length) {
                options.push({
                    content: "声音来源",
                    has_submenu: true,
                    disabled: !viewer.videos.some(item => item.has_audio),
                    submenu: { options: viewer.videos.filter(item => item.has_audio).map(item => ({
                        content: `${viewer.audioSource === item.side ? "✓ " : ""}${item.side === "F" ? "前景" : "背景"}`,
                        callback: () => { viewer.audioSource = item.side; viewer.applyAudio(); },
                    })) },
                });
            } else {
                options.push({
                    content: "图像对比模式",
                    has_submenu: true,
                    submenu: { options: ["Slide", "Click"].map(mode => ({
                        content: `${this.properties.comparer_mode === mode ? "✓ " : ""}${mode === "Slide" ? "滑动分割" : "按住切换"}`,
                        callback: () => { this.properties.comparer_mode = mode; viewer?.updateSplit(); },
                    })) },
                });
            }
            options.push({
                content: "Connections Layout",
                has_submenu: true,
                submenu: { options: [["Left", "Right"], ["Right", "Left"], ["Top", "Bottom"], ["Bottom", "Top"]].map(layout => ({
                    content: layout.join(" -> "),
                    callback: () => { this.properties.connections_layout = layout; this.setDirtyCanvas(true, true); },
                })) },
            });
        };
    },
});
