import ImgCtrlPts from "../../node_modules/imgctrlpts/packages/javascript/ImgCtrlPts.js";

const SURFACE_ID = "imgctrlpts-video-surface";
const MAX_ZOOM = 6.8;

let control = null;
let currentMeta = null;
let transparentImage = null;
let poolControlsVisible = false;
let resizeObserver = null;
let scaleZoom = 1;
let panLeft = 0;
let panTop = 0;

function positiveNumber(...values) {
    for (const value of values) {
        const number = Number(value);
        if (Number.isFinite(number) && number > 0) {
            return number;
        }
    }
    return NaN;
}

function getContainer() {
    return document.getElementById("video");
}

function getVideoElement() {
    return document.getElementById("vid");
}

function resolveSourceSize(meta = currentMeta, videoElement = getVideoElement()) {
    return {
        width: positiveNumber(meta?.width, videoElement?.videoWidth, videoElement?.width, videoElement?.offsetWidth),
        height: positiveNumber(meta?.height, videoElement?.videoHeight, videoElement?.height, videoElement?.offsetHeight)
    };
}

function resolveViewSize(container = getContainer()) {
    return {
        width: positiveNumber(container?.clientWidth, container?.offsetWidth),
        height: positiveNumber(container?.clientHeight, container?.offsetHeight)
    };
}

function canUseVideoImage(meta = currentMeta, videoElement = getVideoElement()) {
    const source = videoElement?.currentSrc || videoElement?.getAttribute("src") || "";
    return Boolean(
        videoElement &&
        videoElement.readyState >= 2 &&
        (!meta?.name || source.includes(meta.name)) &&
        positiveNumber(videoElement.videoWidth, videoElement.width) > 0 &&
        positiveNumber(videoElement.videoHeight, videoElement.height) > 0
    );
}

function ensureTransparentImage(size) {
    if (
        transparentImage &&
        transparentImage.width === Math.round(size.width) &&
        transparentImage.height === Math.round(size.height)
    ) {
        return transparentImage;
    }

    transparentImage = document.createElement("canvas");
    transparentImage.width = Math.max(1, Math.round(size.width));
    transparentImage.height = Math.max(1, Math.round(size.height));
    return transparentImage;
}

function getPoolControlPoints(meta = currentMeta) {
    const size = resolveSourceSize(meta);
    if (!meta?.srcPts || meta.srcPts.length === 0 || !Number.isFinite(size.width) || !Number.isFinite(size.height)) {
        return [];
    }

    return meta.srcPts.map(([x, y]) => ({
        x: (Number(x) / size.width) * 100,
        y: (Number(y) / size.height) * 100
    }));
}

export function getVideoDisplayTransform(meta = currentMeta) {
    const videoElement = getVideoElement();
    const size = resolveSourceSize(meta, videoElement);

    if (!videoElement || !Number.isFinite(size.width) || !Number.isFinite(size.height)) {
        return null;
    }

    const displayWidth = positiveNumber(videoElement.clientWidth, videoElement.offsetWidth);
    const displayHeight = positiveNumber(videoElement.clientHeight, videoElement.offsetHeight);

    if (displayWidth <= 0 || displayHeight <= 0) {
        return null;
    }

    const sourceRatio = size.width / size.height;
    const displayRatio = displayWidth / displayHeight;
    let contentWidth = displayWidth;
    let contentHeight = displayHeight;
    let contentLeft = Number(videoElement.offsetLeft || 0);
    let contentTop = Number(videoElement.offsetTop || 0);

    if (displayRatio > sourceRatio) {
        contentWidth = displayHeight * sourceRatio;
        contentLeft += (displayWidth - contentWidth) / 2;
    } else if (displayRatio < sourceRatio) {
        contentHeight = displayWidth / sourceRatio;
        contentTop += (displayHeight - contentHeight) / 2;
    }

    return {
        k: contentWidth / size.width,
        x: contentLeft,
        y: contentTop
    };
}

function syncPoolSurfaceTransform() {
    if (!control) {
        return;
    }

    const transform = getVideoDisplayTransform();
    if (transform) {
        control.setTransform(transform, { silent: true });
    } else {
        control.redraw();
    }
}

function applyContainerTransform() {
    const container = getContainer();
    if (!container) {
        return;
    }

    container.style.left = `${panLeft}px`;
    container.style.top = `${panTop}px`;
    container.style.transform = `scale(${scaleZoom})`;
    syncPoolSurfaceTransform();
}

function createPoolSurface(meta = currentMeta) {
    const container = getContainer();
    const sourceSize = resolveSourceSize(meta);
    const viewSize = resolveViewSize(container);

    if (
        !container ||
        !meta ||
        !Number.isFinite(sourceSize.width) ||
        !Number.isFinite(sourceSize.height) ||
        !Number.isFinite(viewSize.width) ||
        !Number.isFinite(viewSize.height)
    ) {
        return null;
    }

    currentMeta = meta;

    if (control) {
        control.stopAnimation?.();
        control.remove();
        control = null;
    }

    const videoElement = getVideoElement();
    const useVideoBackground = poolControlsVisible && canUseVideoImage(meta, videoElement);

    control = ImgCtrlPts.createImageControlPoints({
        image: useVideoBackground ? videoElement : ensureTransparentImage(sourceSize),
        width: viewSize.width,
        height: viewSize.height,
        value: poolControlsVisible ? getPoolControlPoints(meta) : [],
        zoom: false,
        animate: useVideoBackground,
        label: false,
        polygon: true,
        mask: false,
        background: useVideoBackground,
        padding: 0,
        radius: 7,
        hitRadius: 11,
        minPoints: 0,
        maxPoints: 4,
        clampToImage: false,
        addPointOnDoubleClick: false,
        ariaLabel: "Video pool boundary surface",
        theme: {
            polygon: "rgba(46, 163, 221, 0.95)",
            point: "rgba(46, 163, 221, 0.95)",
            selectedPoint: "rgba(249, 56, 56, 0.95)",
            background: null,
            grid: "rgba(46, 163, 221, 0)"
        }
    });

    control.id = SURFACE_ID;
    control.dataset.videoBackground = String(useVideoBackground);
    control.classList.add("imgctrlpts-pool-surface");
    control.style.position = "absolute";
    control.style.inset = "0";
    control.style.width = "100%";
    control.style.height = "100%";
    control.style.zIndex = "998";
    control.style.pointerEvents = "none";
    container.classList.add("imgctrlpts-pool-enabled");
    container.append(control);

    syncPoolSurfaceTransform();

    if (!resizeObserver && typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
            if (!currentMeta) {
                return;
            }
            if (typeof requestAnimationFrame === "function") {
                requestAnimationFrame(() => refreshVideoSurface(currentMeta));
            } else {
                refreshVideoSurface(currentMeta);
            }
        });
        resizeObserver.observe(container);
    }

    return control;
}

export function refreshVideoSurface(meta = currentMeta) {
    currentMeta = meta ?? currentMeta;
    return createPoolSurface(currentMeta);
}

export function redrawVideoSurface() {
    if (
        poolControlsVisible &&
        currentMeta &&
        control?.dataset.videoBackground !== "true" &&
        canUseVideoImage(currentMeta)
    ) {
        createPoolSurface(currentMeta);
        return;
    }
    syncPoolSurfaceTransform();
    control?.redraw();
}

export function setPoolControlsVisible(visible, meta = currentMeta) {
    poolControlsVisible = Boolean(visible);
    currentMeta = meta ?? currentMeta;

    createPoolSurface(currentMeta);

    if (!control) {
        return;
    }

    control.setValue(poolControlsVisible ? getPoolControlPoints(currentMeta) : [], { silent: true });
    syncPoolSurfaceTransform();
}

export function moveVideoSurfaceTo(x, y) {
    panLeft = Number.isFinite(Number(x)) ? Number(x) : panLeft;
    panTop = Number.isFinite(Number(y)) ? Number(y) : panTop;
    applyContainerTransform();
}

export function zoomVideoSurface(deltaZoom, center = null) {
    const nextScaleZoom = Math.min(Math.max(1, scaleZoom + Number(deltaZoom || 0)), MAX_ZOOM);
    const container = getContainer();

    if (center && container) {
        panLeft -= Number(center.x || 0) * (1 - scaleZoom / nextScaleZoom);
        panTop -= Number(center.y || 0) * (1 - scaleZoom / nextScaleZoom);
    }

    scaleZoom = nextScaleZoom;
    applyContainerTransform();
    return scaleZoom;
}

export function resetVideoSurfaceTransform() {
    panLeft = 0;
    panTop = 0;
    scaleZoom = 1;
    applyContainerTransform();
}

export function getVideoSurfaceZoomRatio() {
    return scaleZoom;
}
