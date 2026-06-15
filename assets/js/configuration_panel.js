import {
    DEFAULTS,
    buildDataSourceUrl,
    getApiBaseUrl,
    getDataSourceMode,
    getLocalServerUrl
} from "./local_api.js";

function getElement(id) {
    return document.getElementById(id);
}

function setStatus(message, state = "") {
    const status = getElement("data_source_config_status");
    if (!status) {
        return;
    }
    status.textContent = message;
    status.dataset.state = state;
}

function syncConfigurationForm() {
    const sourceSelect = getElement("config_source_select");
    const localServerInput = getElement("config_local_server_url");
    const apiInput = getElement("config_api_url");

    if (sourceSelect) {
        sourceSelect.value = getDataSourceMode();
    }
    if (localServerInput) {
        localServerInput.value = getLocalServerUrl();
    }
    if (apiInput) {
        apiInput.value = getApiBaseUrl();
    }
}

function applyConfiguration() {
    const source = getElement("config_source_select")?.value || DEFAULTS.source;
    const localServerUrl = getElement("config_local_server_url")?.value || DEFAULTS.localServerUrl;
    const apiBaseUrl = getElement("config_api_url")?.value || DEFAULTS.apiBaseUrl;

    setStatus("Applying configuration...", "ready");
    window.location.assign(buildDataSourceUrl({ source, localServerUrl, apiBaseUrl }));
}

function resetConfiguration() {
    setStatus("Resetting configuration...", "ready");
    window.location.assign(buildDataSourceUrl({
        source: DEFAULTS.source,
        localServerUrl: DEFAULTS.localServerUrl,
        apiBaseUrl: DEFAULTS.apiBaseUrl
    }));
}

function bindConfigurationPanel() {
    syncConfigurationForm();
    getElement("config_apply")?.addEventListener("click", applyConfiguration);
    getElement("config_reset")?.addEventListener("click", resetConfiguration);
    window.addEventListener("configuration-view-opened", syncConfigurationForm);
}

if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", bindConfigurationPanel);
} else {
    bindConfigurationPanel();
}
