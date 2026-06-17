export const catalogPaths = {
    swimming: {
        distances: "models/catalogs/swimming/distances.json",
        strokes: "models/catalogs/swimming/strokes.json",
        rounds: "models/catalogs/swimming/rounds.json"
    }
};

const DEFAULT_SPORTSDATA_BASE_URL = new URL("../sportsdata/", import.meta.url).href;

export const SPORTS_DATA_CSV_FORMATS = [
    {
        id: "formats.csv.swimming-tracking",
        title: "Swimming tracking CSV",
        rulesId: "rules.swimming.tracking-csv"
    },
    {
        id: "formats.csv.swimming-basic-tracking",
        title: "Swimming basic tracking CSV",
        rulesId: "rules.swimming.basic-tracking-csv"
    }
];

export const DEFAULT_SPORTSDATA_CSV_FORMAT = SPORTS_DATA_CSV_FORMATS[0].id;

export function normalizeSportsdataCsvFormatId(value, fallback = DEFAULT_SPORTSDATA_CSV_FORMAT) {
    const id = String(value || "").trim();
    return SPORTS_DATA_CSV_FORMATS.some((format) => format.id === id) ? id : fallback;
}

export async function fetchCatalog(path, baseUrl = "") {
    const url = new URL(path, baseUrl || import.meta.url);
    const response = await fetch(url.href);
    if (!response.ok) {
        throw new Error(`Unable to load catalog ${path}: ${response.status}`);
    }
    return response.json();
}

export function toSelectOptions(catalog) {
    const values = Array.isArray(catalog?.values) ? catalog.values : [];
    return values.map((item) => ({
        value: String(item.id),
        label: item.label ? String(item.label) : String(item.id)
    }));
}

function csvFormatDeclarationPath(formatId) {
    if (formatId === "formats.csv.swimming-tracking" || formatId === "swimming-tracking-csv") {
        return "models/formats/csv/swimming-tracking.table-schema.json";
    }
    if (formatId === "formats.csv.swimming-basic-tracking" || formatId === "swimming-basic-tracking-csv") {
        return "models/formats/csv/swimming-basic-tracking.table-schema.json";
    }
    if (formatId.startsWith("formats.csv.")) {
        return `models/formats/csv/${formatId.replace("formats.csv.", "")}.table-schema.json`;
    }
    throw new Error(`Unknown CSV format ${formatId}`);
}

function parseCsvHeaderLine(line, delimiter = ",") {
    const headers = [];
    let value = "";
    let inQuotes = false;

    for (let index = 0; index < line.length; index++) {
        const char = line[index];
        const next = line[index + 1];
        if (char === "\"" && inQuotes && next === "\"") {
            value += "\"";
            index++;
        } else if (char === "\"") {
            inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
            headers.push(value);
            value = "";
        } else {
            value += char;
        }
    }
    headers.push(value);
    return headers.map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, "") : header));
}

function firstCsvRecord(text) {
    const normalized = String(text ?? "").replace(/^\uFEFF/, "");
    let inQuotes = false;
    for (let index = 0; index < normalized.length; index++) {
        const char = normalized[index];
        const next = normalized[index + 1];
        if (char === "\"" && inQuotes && next === "\"") {
            index++;
        } else if (char === "\"") {
            inQuotes = !inQuotes;
        } else if ((char === "\n" || char === "\r") && !inQuotes) {
            return normalized.slice(0, index);
        }
    }
    return normalized;
}

export async function fetchCsvRules(formatId = "formats.csv.swimming-tracking", baseUrl = DEFAULT_SPORTSDATA_BASE_URL) {
    const declarationUrl = new URL(csvFormatDeclarationPath(formatId), baseUrl);
    const declarationResponse = await fetch(declarationUrl.href);
    if (!declarationResponse.ok) {
        throw new Error(`Unable to load CSV format ${formatId}: ${declarationResponse.status}`);
    }
    const declaration = await declarationResponse.json();
    const rulesPath = declaration.rules;
    if (!rulesPath) {
        throw new Error(`CSV format ${formatId} does not define rules`);
    }

    const rulesUrl = new URL(rulesPath, baseUrl);
    const rulesResponse = await fetch(rulesUrl.href);
    if (!rulesResponse.ok) {
        throw new Error(`Unable to load CSV rules ${rulesPath}: ${rulesResponse.status}`);
    }
    return rulesResponse.json();
}

export function validateCsvHeaders(headers, rules) {
    const issues = [];
    const columnRules = new Map((rules?.columns || [])
        .filter((column) => column?.name)
        .map((column) => [String(column.name), column]));
    const counts = new Map();

    for (const header of headers) {
        counts.set(header, (counts.get(header) || 0) + 1);
    }
    for (const [header, count] of counts) {
        if (count > 1) {
            issues.push({ path: "$", message: `duplicate header '${header}'`, severity: "error" });
        }
    }

    for (const column of rules?.columns || []) {
        const name = String(column?.name ?? "");
        if (column?.required && !headers.includes(name)) {
            issues.push({ path: "$", message: `missing required column '${name}'`, severity: "error" });
        }
    }

    if (rules?.allowExtraColumns === false) {
        for (const header of headers) {
            if (!columnRules.has(header)) {
                issues.push({ path: "$", message: `unknown column '${header}'`, severity: "error" });
            }
        }
    }

    return issues;
}

export function validateCsvTextHeaders(text, rules) {
    const delimiter = String(rules?.delimiter || ",");
    const headers = parseCsvHeaderLine(firstCsvRecord(text), delimiter);
    return {
        headers,
        issues: validateCsvHeaders(headers, rules)
    };
}

export async function validateCsvUrlHeaders(url, options = {}) {
    const formatId = options.formatId || "formats.csv.swimming-tracking";
    const rules = await fetchCsvRules(formatId, options.baseUrl || DEFAULT_SPORTSDATA_BASE_URL);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Unable to load CSV ${url}: ${response.status}`);
    }
    const text = await response.text();
    return {
        text,
        rules,
        ...validateCsvTextHeaders(text, rules)
    };
}

export function formatValidationIssue(issue) {
    const prefix = issue?.path ? `${issue.path}: ` : "";
    const severity = issue?.severity && issue.severity !== "error" ? `[${issue.severity}] ` : "";
    return `${prefix}${severity}${issue?.message || "validation issue"}`;
}
