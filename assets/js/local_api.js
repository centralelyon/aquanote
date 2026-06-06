const DEFAULT_LOCAL_API_PORT = "8001";
const LOCAL_API_HOST = "127.0.0.1";

function isValidPort(value) {
    const port = String(value ?? "").trim();
    if (!/^\d+$/.test(port)) {
        return false;
    }
    const number = Number(port);
    return number >= 1 && number <= 65535;
}

function initialLocalApiPort() {
    if (typeof window === "undefined") {
        return DEFAULT_LOCAL_API_PORT;
    }

    const params = new URLSearchParams(window.location.search);
    const apiPort = params.get("apiPort");
    return isValidPort(apiPort) ? String(Number(apiPort)) : DEFAULT_LOCAL_API_PORT;
}

const localApiPort = initialLocalApiPort();

export function getLocalApiPort() {
    return localApiPort;
}

export function hasCustomLocalApiPort() {
    return localApiPort !== DEFAULT_LOCAL_API_PORT;
}

export function getLocalApiOrigin() {
    return `http://${LOCAL_API_HOST}:${localApiPort}`;
}

export function getLocalApiUrl(path = "") {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${getLocalApiOrigin()}${normalizedPath}`;
}

export function getLocalFilesRoot() {
    return getLocalApiUrl("/files/");
}
