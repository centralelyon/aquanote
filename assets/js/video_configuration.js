import ImgCtrlPts from "../../node_modules/imgctrlpts/packages/javascript/ImgCtrlPts.js";
import { megaData, selected_comp, selected_run } from "./loader.js";
import { getMeta } from "./utils.js";
import { refreshVideoSurface } from "./video_surface.js";

const POOL_REFERENCE_IMAGE_URL = new URL("../../courses_demo/Swimming_pool_50m_above.png", import.meta.url).href;
const JSON_POOL_SIZE = { width: 900, height: 361 };
const CONTROL_WIDTH = 280;
const scheduleFrame = typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : (callback) => setTimeout(callback, 0);

let workspace = null;
let activeMeta = null;
let activeSourceImage = null;
let activeReferenceImage = null;
let activeReferenceSize = null;
let referenceImagePromise = null;
let updateFrame = null;

function positiveNumber(...values) {
    for (const value of values) {
        const number = Number(value);
        if (Number.isFinite(number) && number > 0) {
            return number;
        }
    }
    return NaN;
}

function getElement(id) {
    return document.getElementById(id);
}

function setStatus(message, state = "") {
    const status = getElement("config_status");
    if (!status) {
        return;
    }
    status.textContent = message;
    status.dataset.state = state;
}

function getSourceSize(meta) {
    const video = getElement("vid");
    const width = positiveNumber(meta?.width, video?.videoWidth, video?.width, 1920);
    const height = positiveNumber(meta?.height, video?.videoHeight, video?.height, 1080);
    return { width, height };
}

function sourcePointToPct(point, size) {
    return {
        x: Number(point?.[0] ?? point?.x ?? 0) * 100 / size.width,
        y: Number(point?.[1] ?? point?.y ?? 0) * 100 / size.height
    };
}

function getImageSize(image) {
    return {
        width: positiveNumber(image?.naturalWidth, image?.videoWidth, image?.width, JSON_POOL_SIZE.width),
        height: positiveNumber(image?.naturalHeight, image?.videoHeight, image?.height, JSON_POOL_SIZE.height)
    };
}

function destinationPointToReferencePx(point, referenceSize = activeReferenceSize ?? JSON_POOL_SIZE) {
    return {
        x: Number(point?.[0] ?? point?.x ?? 0) * referenceSize.width / JSON_POOL_SIZE.width,
        y: Number(point?.[1] ?? point?.y ?? 0) * referenceSize.height / JSON_POOL_SIZE.height
    };
}

function referencePointToJson(point, referenceSize = activeReferenceSize ?? JSON_POOL_SIZE) {
    return [
        roundCoordinate(Number(point.x) * JSON_POOL_SIZE.width / referenceSize.width),
        roundCoordinate(Number(point.y) * JSON_POOL_SIZE.height / referenceSize.height)
    ];
}

function referencePointToPct(point, referenceSize = activeReferenceSize ?? JSON_POOL_SIZE) {
    return {
        x: point.x * 100 / referenceSize.width,
        y: point.y * 100 / referenceSize.height
    };
}

function roundCoordinate(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    const rounded = Number(value.toFixed(2));
    return Number.isInteger(rounded) ? Math.trunc(rounded) : rounded;
}

function pointsToArrays(points) {
    return points.map((point) => [
        roundCoordinate(point.x),
        roundCoordinate(point.y)
    ]);
}

function currentVideoMatches(meta) {
    const src = getElement("vid")?.currentSrc || getElement("vid")?.getAttribute("src") || "";
    return Boolean(meta?.name && src.includes(meta.name));
}

function drawPolygon(context, points, color = "rgba(46, 163, 221, 0.9)") {
    if (!Array.isArray(points) || points.length < 2) {
        return;
    }

    context.save();
    context.strokeStyle = color;
    context.fillStyle = "rgba(46, 163, 221, 0.14)";
    context.lineWidth = 4;
    context.beginPath();
    points.forEach((point, index) => {
        const x = Number(point?.[0] ?? point?.x ?? 0);
        const y = Number(point?.[1] ?? point?.y ?? 0);
        if (index === 0) {
            context.moveTo(x, y);
        } else {
            context.lineTo(x, y);
        }
    });
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
}

function drawCenteredText(context, text, width, height) {
    context.save();
    context.fillStyle = "rgba(255, 255, 255, 0.84)";
    context.font = `${Math.max(28, Math.round(width / 46))}px Raleway, system-ui, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, width / 2, height / 2);
    context.restore();
}

function isCanvasReadable(canvas) {
    try {
        canvas.getContext("2d")?.getImageData(0, 0, 1, 1);
        return true;
    } catch {
        return false;
    }
}

function drawSnapshotFallback(context, meta, width, height) {
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#111827";
    context.fillRect(0, 0, width, height);
    drawCenteredText(context, meta?.name || "video", width, height);
}

function createFallbackSnapshot(meta, size) {
    const fallback = document.createElement("canvas");
    fallback.width = Math.max(1, Math.round(size.width));
    fallback.height = Math.max(1, Math.round(size.height));
    const context = fallback.getContext("2d", { willReadFrequently: true });
    drawSnapshotFallback(context, meta, fallback.width, fallback.height);
    drawPolygon(context, meta?.srcPts ?? []);
    return fallback;
}

function createVideoSnapshot(meta) {
    const size = getSourceSize(meta);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(size.width));
    canvas.height = Math.max(1, Math.round(size.height));

    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.fillStyle = "#111827";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const video = getElement("vid");
    const canDrawVideo = video && video.readyState >= 2 && currentVideoMatches(meta);
    if (canDrawVideo) {
        try {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            if (!isCanvasReadable(canvas)) {
                setStatus("La frame video n'est pas lisible par le canvas; rechargez la course pour activer l'apercu video CORS.", "error");
                return createFallbackSnapshot(meta, size);
            }
        } catch {
            return createFallbackSnapshot(meta, size);
        }
    } else {
        drawSnapshotFallback(context, meta, canvas.width, canvas.height);
    }

    drawPolygon(context, meta?.srcPts ?? []);
    return canvas;
}

function getPoolReferenceImage() {
    if (referenceImagePromise) {
        return referenceImagePromise;
    }

    referenceImagePromise = new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => {
            referenceImagePromise = null;
            reject(new Error("Impossible de charger Swimming_pool_50m_above.png."));
        };
        image.src = POOL_REFERENCE_IMAGE_URL;
    });

    return referenceImagePromise;
}

function averagePoint(points) {
    if (!Array.isArray(points) || points.length === 0) {
        return { x: 50, y: 50 };
    }
    return {
        x: points.reduce((sum, point) => sum + Number(point.x || 0), 0) / points.length,
        y: points.reduce((sum, point) => sum + Number(point.y || 0), 0) / points.length
    };
}

function applyPoolLabels() {
    if (!workspace?.controls) {
        return;
    }
    const sourceCenter = averagePoint(workspace.value?.sourcePoints ?? []);
    const destinationCenter = averagePoint(workspace.value?.destinationPoints ?? []);
    const annotation = {
        label: "piscine",
        radius: 5,
        color: "#2ea3dd",
        background: "rgba(35, 33, 87, 0.88)"
    };
    workspace.controls.source.setAnnotations([{ ...annotation, ...sourceCenter }], { silent: true });
    workspace.controls.destination.setAnnotations([{ ...annotation, ...destinationCenter }], { silent: true });
}

function getActiveMetaFromPage() {
    try {
        return getMeta();
    } catch {
        return null;
    }
}

function getActiveVideoIndex(videos) {
    const currentMeta = getActiveMetaFromPage();
    const byName = videos.findIndex((video) => video === currentMeta || video.name === currentMeta?.name);
    if (byName >= 0) {
        return byName;
    }

    const currentSrc = getElement("vid")?.currentSrc || getElement("vid")?.getAttribute("src") || "";
    const bySource = videos.findIndex((video) => video.name && currentSrc.includes(video.name));
    return bySource >= 0 ? bySource : 0;
}

function syncVideoSelect(videos) {
    const select = getElement("config_video_select");
    if (!select) {
        return 0;
    }

    const hasPrevious = select.options.length > 0 && select.value !== "";
    const previous = Number(select.value);
    select.replaceChildren(...videos.map((video, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = video.name || `video ${index + 1}`;
        return option;
    }));

    if (hasPrevious && Number.isInteger(previous) && previous >= 0 && previous < videos.length) {
        select.value = String(previous);
        return previous;
    }

    const activeIndex = getActiveVideoIndex(videos);
    select.value = String(activeIndex);
    return activeIndex;
}

function selectedVideoIndex(videos) {
    const select = getElement("config_video_select");
    const index = Number(select?.value);
    if (Number.isInteger(index) && index >= 0 && index < videos.length) {
        return index;
    }
    return syncVideoSelect(videos);
}

function extractCalibrationValue() {
    const value = workspace?.value;
    if (!value) {
        return null;
    }

    const pointCount = Math.min(value.sourcePointsPx.length, value.destinationPointsPx.length);
    return {
        pointCount,
        srcPts: pointsToArrays(value.sourcePointsPx.slice(0, pointCount)),
        destPts: value.destinationPointsPx.slice(0, pointCount).map((point) => referencePointToJson(point, activeReferenceSize)),
        homography: value.homography?.map((row) => row.map((number) => roundCoordinate(number))) ?? null
    };
}

function renderWarpResult() {
    const canvas = getElement("config_warp_result");
    const value = workspace?.value;
    if (!canvas || !value || !activeSourceImage || !activeReferenceImage) {
        return;
    }

    const referenceSize = activeReferenceSize ?? getImageSize(activeReferenceImage);
    const pointCount = Math.min(value.sourcePointsPx.length, value.destinationPointsPx.length);
    if (pointCount < 4) {
        const context = canvas.getContext("2d");
        canvas.width = referenceSize.width;
        canvas.height = referenceSize.height;
        context.drawImage(activeReferenceImage, 0, 0, canvas.width, canvas.height);
        return;
    }

    try {
        ImgCtrlPts.warpImageToCanvas({
            sourceImage: activeSourceImage,
            referenceImage: activeReferenceImage,
            destinationSize: referenceSize,
            sourcePoints: value.sourcePointsPx.slice(0, pointCount),
            destinationPoints: value.destinationPointsPx.slice(0, pointCount),
            canvas,
            width: CONTROL_WIDTH,
            alpha: 0.6,
            optimize: true,
            sampling: "nearest"
        });
    } catch (error) {
        setStatus(`Warping indisponible: ${error.message}`, "error");
    }
}

function updatePreview() {
    const preview = getElement("config_json_preview");
    const calibration = extractCalibrationValue();
    if (!preview || !calibration || !activeMeta) {
        return;
    }

    preview.textContent = JSON.stringify({
        video: activeMeta.name,
        srcPts: calibration.srcPts,
        destPts: calibration.destPts,
        homography: calibration.homography
    }, null, 2);

    applyPoolLabels();
    renderWarpResult();
}

function schedulePreviewUpdate() {
    if (updateFrame != null) {
        return;
    }
    updateFrame = scheduleFrame(() => {
        updateFrame = null;
        updatePreview();
    });
}

async function renderConfiguration() {
    const container = getElement("config_warp_workspace");
    if (!container) {
        return;
    }

    const metadata = megaData?.[0];
    const videos = Array.isArray(metadata?.videos) ? metadata.videos : [];
    if (!metadata || videos.length === 0) {
        container.replaceChildren();
        const preview = getElement("config_json_preview");
        if (preview) {
            preview.textContent = "";
        }
        setStatus("Chargez une course pour afficher la configuration video.", "empty");
        return;
    }

    syncVideoSelect(videos);
    activeMeta = videos[selectedVideoIndex(videos)];
    if (!activeMeta?.srcPts || !activeMeta?.destPts) {
        container.replaceChildren();
        const preview = getElement("config_json_preview");
        if (preview) {
            preview.textContent = "";
        }
        setStatus("Cette video ne contient pas de points de calibration.", "error");
        return;
    }

    setStatus("Chargement de l'image piscine de reference...", "ready");

    try {
        activeReferenceImage = await getPoolReferenceImage();
        activeReferenceSize = getImageSize(activeReferenceImage);
    } catch (error) {
        container.replaceChildren();
        setStatus(error.message, "error");
        return;
    }

    activeSourceImage = createVideoSnapshot(activeMeta);

    const sourceSize = getSourceSize(activeMeta);
    const sourcePoints = activeMeta.srcPts.map((point) => sourcePointToPct(point, sourceSize));
    const destinationPoints = activeMeta.destPts
        .map((point) => destinationPointToReferencePx(point, activeReferenceSize))
        .map((point) => referencePointToPct(point, activeReferenceSize));

    workspace?.remove();
    workspace = ImgCtrlPts.createWarpingWorkspace({
        sourceImage: activeSourceImage,
        referenceImage: activeReferenceImage,
        width: CONTROL_WIDTH,
        columns: "repeat(3, minmax(250px, 1fr))",
        gap: "12px",
        sourcePoints,
        destinationPoints,
        alpha: 0.64,
        background: true,
        optimize: true,
        minPoints: 4,
        maxPoints: 8,
        label: true,
        theme: {
            polygon: "rgba(46, 163, 221, 0.95)",
            point: "rgba(46, 163, 221, 0.95)",
            selectedPoint: "rgba(249, 56, 56, 0.95)",
            grid: "rgba(46, 163, 221, 0.22)"
        }
    });
    workspace.addEventListener("input", schedulePreviewUpdate);
    workspace.addEventListener("change", schedulePreviewUpdate);
    container.replaceChildren(workspace);

    setStatus(currentVideoMatches(activeMeta)
        ? "Image video courante utilisee pour la calibration."
        : "La video selectionnee n'est pas l'image courante; les points restent modifiables.",
    "ready");
    updatePreview();
}

async function saveConfiguration() {
    if (!workspace || !activeMeta) {
        await renderConfiguration();
    }

    const calibration = extractCalibrationValue();
    if (!calibration || calibration.pointCount < 4 || !activeMeta) {
        setStatus("Au moins 4 paires de points sont necessaires.", "error");
        return;
    }

    activeMeta.srcPts = calibration.srcPts;
    activeMeta.destPts = calibration.destPts;
    updatePreview();
    refreshVideoSurface(getActiveMetaFromPage());

    try {
        const response = await fetch("http://127.0.0.1:8001/saveMetadata", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                competition: selected_comp,
                run: selected_run,
                metadata: megaData[0]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `HTTP ${response.status}`);
        }

        const payload = await response.json();
        setStatus(`Coordonnees enregistrees: ${payload.path}`, "saved");
    } catch (error) {
        setStatus(`Coordonnees mises a jour en memoire, ecriture JSON impossible: ${error.message}`, "error");
    }
}

function bindControls() {
    getElement("config_refresh")?.addEventListener("click", renderConfiguration);
    getElement("config_save")?.addEventListener("click", saveConfiguration);
    getElement("config_video_select")?.addEventListener("change", renderConfiguration);
    window.addEventListener("calibration-view-opened", renderConfiguration);
}

if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", bindControls);
} else {
    bindControls();
}
