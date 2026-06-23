function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function clamp01(value) {
    return Math.max(0, Math.min(1, finiteNumber(value)));
}

function firstFourPoints(points) {
    return Array.isArray(points) && points.length >= 4
        ? points.slice(0, 4).map((point) => [finiteNumber(point[0]), finiteNumber(point[1])])
        : null;
}

function referenceQuadBounds(quad) {
    if (!quad) {
        return null;
    }
    const xs = quad.map((point) => point[0]).filter(Number.isFinite);
    const ys = quad.map((point) => point[1]).filter(Number.isFinite);
    if (!xs.length || !ys.length) {
        return null;
    }
    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys)
    };
}

function quadFromBounds(bounds) {
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
        return null;
    }
    return [
        [bounds.minX, bounds.maxY],
        [bounds.maxX, bounds.maxY],
        [bounds.maxX, bounds.minY],
        [bounds.minX, bounds.minY]
    ];
}

function raceReferenceQuad(meta) {
    const currentQuad = firstFourPoints(meta?.destPts);
    const videos = globalThis?.megaData?.[0]?.videos;
    if (!currentQuad || !Array.isArray(videos)) {
        return currentQuad;
    }

    const allPoints = videos
        .flatMap((video) => firstFourPoints(video?.destPts) || [])
        .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
    const raceBounds = referenceQuadBounds(allPoints);
    const currentBounds = referenceQuadBounds(currentQuad);
    if (!raceBounds || !currentBounds) {
        return currentQuad;
    }

    const raceIsWider = raceBounds.width > currentBounds.width * 1.25;
    return raceIsWider ? (quadFromBounds(raceBounds) || currentQuad) : currentQuad;
}

function lerpPoint(a, b, t) {
    return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t
    ];
}

function bilerp(bottomLeft, bottomRight, topRight, topLeft, u, v) {
    const bottomPoint = lerpPoint(bottomLeft, bottomRight, u);
    const topPoint = lerpPoint(topLeft, topRight, u);
    return lerpPoint(bottomPoint, topPoint, v);
}

function solveQuadUv(point, quad) {
    if (!point || !quad) {
        return null;
    }

    let u = 0.5;
    let v = 0.5;
    const [bottomLeft, bottomRight, topRight, topLeft] = quad;

    for (let index = 0; index < 12; index += 1) {
        const projected = bilerp(bottomLeft, bottomRight, topRight, topLeft, u, v);
        const errorX = projected[0] - point[0];
        const errorY = projected[1] - point[1];
        if (Math.hypot(errorX, errorY) < 0.01) {
            break;
        }

        const du = [
            (1 - v) * (bottomRight[0] - bottomLeft[0]) + v * (topRight[0] - topLeft[0]),
            (1 - v) * (bottomRight[1] - bottomLeft[1]) + v * (topRight[1] - topLeft[1])
        ];
        const dv = [
            (1 - u) * (topLeft[0] - bottomLeft[0]) + u * (topRight[0] - bottomRight[0]),
            (1 - u) * (topLeft[1] - bottomLeft[1]) + u * (topRight[1] - bottomRight[1])
        ];
        const determinant = du[0] * dv[1] - dv[0] * du[1];
        if (Math.abs(determinant) < 1e-9) {
            return null;
        }

        const deltaU = (errorX * dv[1] - dv[0] * errorY) / determinant;
        const deltaV = (du[0] * errorY - errorX * du[1]) / determinant;
        u -= deltaU;
        v -= deltaV;
    }

    return { u, v };
}

export function poolPointToReferencePoint(point, poolSize, destPts) {
    const quad = firstFourPoints(destPts);
    if (!quad) {
        return null;
    }

    const poolLength = Math.max(1, finiteNumber(poolSize?.[0], 50));
    const poolWidth = Math.max(1, finiteNumber(poolSize?.[1], 20));
    const xRatio = 1 - clamp01(finiteNumber(point?.[0]) / poolLength);
    const yRatio = clamp01(finiteNumber(point?.[1]) / poolWidth);
    const [bottomLeft, bottomRight, topRight, topLeft] = quad;

    return bilerp(bottomLeft, bottomRight, topRight, topLeft, xRatio, yRatio);
}

export function referencePointToVideoPoint(point, meta, TransformCtor = window.PerspT) {
    const sourceQuad = firstFourPoints(meta?.srcPts);
    const destinationQuad = firstFourPoints(meta?.destPts);
    if (!sourceQuad || !destinationQuad || !TransformCtor || !point) {
        return null;
    }

    const transform = new TransformCtor(destinationQuad.flat(), sourceQuad.flat());
    const projected = transform.transform(point[0], point[1]);
    return [projected[0], projected[1]];
}

export function videoPointToReferencePoint(point, meta, TransformCtor = window.PerspT) {
    const sourceQuad = firstFourPoints(meta?.srcPts);
    const destinationQuad = firstFourPoints(meta?.destPts);
    if (!sourceQuad || !destinationQuad || !TransformCtor || !point) {
        return null;
    }

    const transform = new TransformCtor(sourceQuad.flat(), destinationQuad.flat());
    const projected = transform.transform(point[0], point[1]);
    return [projected[0], projected[1]];
}

export function referencePointToPoolPoint(point, poolSize, destPts) {
    const quad = firstFourPoints(destPts);
    const uv = solveQuadUv(point, quad);
    if (!uv) {
        return null;
    }

    const poolLength = Math.max(1, finiteNumber(poolSize?.[0], 50));
    const poolWidth = Math.max(1, finiteNumber(poolSize?.[1], 20));
    return [
        (1 - uv.u) * poolLength,
        uv.v * poolWidth
    ];
}

export function videoPointToPoolPoint(point, poolSize, meta, TransformCtor = window.PerspT) {
    const referencePoint = videoPointToReferencePoint(point, meta, TransformCtor);
    return referencePointToPoolPoint(referencePoint, poolSize, raceReferenceQuad(meta));
}

export function poolPointToVideoPoint(point, poolSize, meta, TransformCtor = window.PerspT) {
    const referencePoint = poolPointToReferencePoint(point, poolSize, raceReferenceQuad(meta));
    return referencePointToVideoPoint(referencePoint, meta, TransformCtor);
}

export function getPoolLaneSegment(xPosition, laneIndex, laneCount, poolSize, meta, TransformCtor = window.PerspT) {
    const safeLaneCount = Math.max(1, Math.round(finiteNumber(laneCount, 1)));
    const safeLaneIndex = Math.max(0, Math.min(Math.round(finiteNumber(laneIndex, 0)), safeLaneCount - 1));
    const poolWidth = Math.max(1, finiteNumber(poolSize?.[1], 20));
    const laneHeight = poolWidth / safeLaneCount;
    const laneBottom = safeLaneIndex * laneHeight;
    const laneTop = (safeLaneIndex + 1) * laneHeight;

    return [
        poolPointToVideoPoint([xPosition, laneBottom], poolSize, meta, TransformCtor),
        poolPointToVideoPoint([xPosition, laneTop], poolSize, meta, TransformCtor)
    ];
}
