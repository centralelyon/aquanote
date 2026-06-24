import {
    DEFAULTS,
    buildDataSourceUrl,
    getApiBaseUrl,
    getDataSourceMode,
    getLocalServerUrl,
    getSportsdataJsonFormatId,
    getSportsdataJsonStrictMode,
    getSportsdataLoadFormatId,
    getSportsdataLoadStrictMode,
    getSportsdataSaveFormatId,
    getSportsdataSaveStrictMode
} from "./local_api.js";
import { SPORTS_DATA_CSV_FORMATS, SPORTS_DATA_JSON_FORMATS } from "./sportsdata.js";

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

function syncFormatSelect(select, value, formats = SPORTS_DATA_CSV_FORMATS) {
    if (!select) {
        return;
    }

    select.replaceChildren(...formats.map((format) => {
        const option = document.createElement("option");
        option.value = format.id;
        option.textContent = format.title;
        return option;
    }));
    select.value = value;
}

function syncConfigurationForm() {
    const sourceSelect = getElement("config_source_select");
    const localServerInput = getElement("config_local_server_url");
    const apiInput = getElement("config_api_url");
    const sportsdataJsonFormatSelect = getElement("config_sportsdata_json_format");
    const sportsdataLoadFormatSelect = getElement("config_sportsdata_load_format");
    const sportsdataSaveFormatSelect = getElement("config_sportsdata_save_format");
    const sportsdataJsonStrictInput = getElement("config_sportsdata_json_strict");
    const sportsdataLoadStrictInput = getElement("config_sportsdata_load_strict");
    const sportsdataSaveStrictInput = getElement("config_sportsdata_save_strict");

    if (sourceSelect) {
        sourceSelect.value = getDataSourceMode();
    }
    if (localServerInput) {
        localServerInput.value = getLocalServerUrl();
    }
    if (apiInput) {
        apiInput.value = getApiBaseUrl();
    }
    syncFormatSelect(sportsdataJsonFormatSelect, getSportsdataJsonFormatId(), SPORTS_DATA_JSON_FORMATS);
    syncFormatSelect(sportsdataLoadFormatSelect, getSportsdataLoadFormatId(), SPORTS_DATA_CSV_FORMATS);
    syncFormatSelect(sportsdataSaveFormatSelect, getSportsdataSaveFormatId(), SPORTS_DATA_CSV_FORMATS);
    if (sportsdataJsonStrictInput) {
        sportsdataJsonStrictInput.checked = getSportsdataJsonStrictMode();
    }
    if (sportsdataLoadStrictInput) {
        sportsdataLoadStrictInput.checked = getSportsdataLoadStrictMode();
    }
    if (sportsdataSaveStrictInput) {
        sportsdataSaveStrictInput.checked = getSportsdataSaveStrictMode();
    }
}

function applyConfiguration() {
    const source = getElement("config_source_select")?.value || DEFAULTS.source;
    const localServerUrl = getElement("config_local_server_url")?.value || DEFAULTS.localServerUrl;
    const apiBaseUrl = getElement("config_api_url")?.value || DEFAULTS.apiBaseUrl;
    const sportsdataJsonFormat = getElement("config_sportsdata_json_format")?.value || DEFAULTS.sportsdataJsonFormat;
    const sportsdataLoadFormat = getElement("config_sportsdata_load_format")?.value || DEFAULTS.sportsdataLoadFormat;
    const sportsdataSaveFormat = getElement("config_sportsdata_save_format")?.value || DEFAULTS.sportsdataSaveFormat;
    const sportsdataJsonStrict = getElement("config_sportsdata_json_strict")?.checked ?? DEFAULTS.sportsdataJsonStrict;
    const sportsdataLoadStrict = getElement("config_sportsdata_load_strict")?.checked ?? DEFAULTS.sportsdataLoadStrict;
    const sportsdataSaveStrict = getElement("config_sportsdata_save_strict")?.checked ?? DEFAULTS.sportsdataSaveStrict;

    setStatus("Applying configuration...", "ready");
    window.location.assign(buildDataSourceUrl({
        source,
        localServerUrl,
        apiBaseUrl,
        sportsdataJsonFormat,
        sportsdataLoadFormat,
        sportsdataSaveFormat,
        sportsdataJsonStrict,
        sportsdataLoadStrict,
        sportsdataSaveStrict
    }));
}

function resetConfiguration() {
    setStatus("Resetting configuration...", "ready");
    window.location.assign(buildDataSourceUrl({
        source: DEFAULTS.source,
        localServerUrl: DEFAULTS.localServerUrl,
        apiBaseUrl: DEFAULTS.apiBaseUrl,
        sportsdataJsonFormat: DEFAULTS.sportsdataJsonFormat,
        sportsdataLoadFormat: DEFAULTS.sportsdataLoadFormat,
        sportsdataSaveFormat: DEFAULTS.sportsdataSaveFormat,
        sportsdataJsonStrict: DEFAULTS.sportsdataJsonStrict,
        sportsdataLoadStrict: DEFAULTS.sportsdataLoadStrict,
        sportsdataSaveStrict: DEFAULTS.sportsdataSaveStrict
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
