const DEFAULT_LOCAL_SERVER_URL = "http://127.0.0.1:8000";
const DEFAULT_API_BASE_URL = "http://localhost:8000/aquanote";
const STORAGE_KEYS = {
    source: "aquanote.source",
    localServerUrl: "aquanote.localServerUrl",
    apiBaseUrl: "aquanote.apiBaseUrl"
};
const SOURCE_ALIASES = {
    server: "local",
    local: "local",
    api: "api",
    static: "static",
    auto: "auto"
};

function isValidPort(value) {
    const port = String(value ?? "").trim();
    if (!/^\d+$/.test(port)) {
        return false;
    }
    const number = Number(port);
    return number >= 1 && number <= 65535;
}

function getParams() {
    if (typeof window === "undefined") {
        return new URLSearchParams();
    }
    return new URLSearchParams(window.location.search);
}

function readStorage(key) {
    try {
        return typeof localStorage === "undefined" ? "" : localStorage.getItem(key) || "";
    } catch {
        return "";
    }
}

function normalizeBaseUrl(value, fallback) {
    const raw = String(value || "").trim();
    if (!raw) {
        return fallback;
    }

    try {
        const url = new URL(raw);
        return url.href.replace(/\/+$/, "");
    } catch {
        return fallback;
    }
}

function normalizeSource(value, fallback = "auto") {
    return SOURCE_ALIASES[String(value || "").trim().toLowerCase()] || fallback;
}

function legacyLocalServerUrlFromPort(params) {
    const apiPort = params.get("apiPort");
    return isValidPort(apiPort)
        ? `http://127.0.0.1:${Number(apiPort)}`
        : "";
}

export function getDataSourceMode() {
    const params = getParams();
    return normalizeSource(
        params.get("source") || readStorage(STORAGE_KEYS.source),
        "auto"
    );
}

export function getLocalServerUrl() {
    const params = getParams();
    return normalizeBaseUrl(
        params.get("localServerUrl")
            || legacyLocalServerUrlFromPort(params)
            || readStorage(STORAGE_KEYS.localServerUrl),
        DEFAULT_LOCAL_SERVER_URL
    );
}

export function getApiBaseUrl() {
    const params = getParams();
    return normalizeBaseUrl(
        params.get("apiUrl") || readStorage(STORAGE_KEYS.apiBaseUrl),
        DEFAULT_API_BASE_URL
    );
}

export function getActiveServerUrl() {
    return getDataSourceMode() === "api" ? getApiBaseUrl() : getLocalServerUrl();
}

export function getLocalApiPort() {
    try {
        return new URL(getLocalServerUrl()).port || "80";
    } catch {
        return "8000";
    }
}

export function hasCustomLocalApiPort() {
    return getLocalServerUrl() !== DEFAULT_LOCAL_SERVER_URL;
}

export function getLocalApiOrigin() {
    return getActiveServerUrl();
}

export function getLocalApiUrl(path = "") {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${getActiveServerUrl()}${normalizedPath}`;
}

export function getLocalFilesRoot() {
    return getLocalApiUrl("/files/");
}

export function isStaticDataSource() {
    return getDataSourceMode() === "static";
}

export function canWriteMetadata() {
    return !isStaticDataSource();
}

export function buildDataSourceUrl({ source, localServerUrl, apiBaseUrl }) {
    const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
    const nextSource = normalizeSource(source, getDataSourceMode());
    const nextLocalServerUrl = normalizeBaseUrl(localServerUrl, DEFAULT_LOCAL_SERVER_URL);
    const nextApiBaseUrl = normalizeBaseUrl(apiBaseUrl, DEFAULT_API_BASE_URL);

    params.set("source", nextSource);
    params.delete("apiPort");

    if (nextLocalServerUrl === DEFAULT_LOCAL_SERVER_URL) {
        params.delete("localServerUrl");
    } else {
        params.set("localServerUrl", nextLocalServerUrl);
    }

    if (nextApiBaseUrl === DEFAULT_API_BASE_URL) {
        params.delete("apiUrl");
    } else {
        params.set("apiUrl", nextApiBaseUrl);
    }

    try {
        localStorage.setItem(STORAGE_KEYS.source, nextSource);
        localStorage.setItem(STORAGE_KEYS.localServerUrl, nextLocalServerUrl);
        localStorage.setItem(STORAGE_KEYS.apiBaseUrl, nextApiBaseUrl);
    } catch {
        // URL parameters remain the source of truth if localStorage is unavailable.
    }

    return `${window.location.pathname}?${params.toString()}`;
}

export const DEFAULTS = {
    source: "auto",
    localServerUrl: DEFAULT_LOCAL_SERVER_URL,
    apiBaseUrl: DEFAULT_API_BASE_URL
};
