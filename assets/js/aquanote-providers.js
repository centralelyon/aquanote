/**
 * @file aquanote-providers.js
 * @brief Site-specific data provider factories for Aquanote.
 *
 * To switch data source, add ?source=api|static|auto to the URL.
 * Default (no param): auto — tries API first, falls back to static.
 *
 * To point to a different API (e.g. production), change API_BASE.
 */

import { makeFallbackProvider, parseCsvText } from "./data-provider.js";

// ── Configuration ──────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:8000/aquanote";
const STATIC_BASE = "courses_demo/";

// ── Static data ────────────────────────────────────────────────────────────────
// Update this when CSV files or competitions are added/removed from the repo.
const staticData = {
    competitions: [
        { name: "2025_courses_demo", type: "directory" }
    ],
    runs: {
        "2025_courses_demo": [
            { name: "2025_courses_demo_translation_carre_100_demifinale", type: "directory" },
            { name: "2025_courses_demo_translation_carre_50_finale", type: "directory" },
            { name: "2025_courses_demo_translation_carre_50_serie", type: "directory" }
        ]
    },
    csvFiles: {
        "2025_courses_demo_translation_carre_100_demifinale": [
            { name: "exemple_annotation_cycle.csv", type: "file" }
        ],
        "2025_courses_demo_translation_carre_50_finale": [
            { name: "exemple_annotation_ligne_5_cycles.csv", type: "file" }
        ],
        "2025_courses_demo_translation_carre_50_serie": []
    }
};

// ── Provider factories ─────────────────────────────────────────────────────────

function makeStaticProvider(data, basePath) {
    return {
        getCompets: async () => data.competitions,
        getRuns: async (comp) => data.runs[comp] ?? [],
        getDatas: async (comp, run) => data.csvFiles[run] ?? [],
        getQuality: async () => [],
        loadRunJson: async (comp, run) => {
            const url = `${basePath}${comp}/${run}/${run}.json`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
            return res.json();
        },
        fetchCsv: async (comp, run, filename) => {
            const url = `${basePath}${comp}/${run}/${filename}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
            return parseCsvText(await res.text());
        },
        getVideoUrl: (comp, run, filename) => `${basePath}${comp}/${run}/${filename}`,
    };
}

function makeApiProvider(baseUrl) {
    async function apiFetch(path) {
        const res = await fetch(`${baseUrl}${path}`);
        if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
        return res.json();
    }
    return {
        getCompets: async () => {
            const data = await apiFetch("/getCompets");
            return Array.isArray(data) ? data : [];
        },
        getRuns: async (comp) => {
            const data = await apiFetch(`/getRuns/${comp}`);
            return Array.isArray(data) ? data.filter(d => d.type === "directory") : [];
        },
        getDatas: async (comp, run) => {
            const data = await apiFetch(`/getDatas/${comp}/${run}`);
            return Array.isArray(data) ? data.filter(d => d.type === "file" && d.name.includes(".csv")) : [];
        },
        getQuality: async (comp, run, side) => {
            const data = await apiFetch(`/getQuality/${comp}/${run}`);
            if (!Array.isArray(data)) return [];
            const key = side === "droite" ? "fixeDroite" : "fixeGauche";
            return data.filter(d => d.type === "file" && d.name.includes(key));
        },
        loadRunJson: async (comp, run) => {
            const res = await fetch(`${baseUrl}/files/${comp}/${run}/${run}.json`);
            if (!res.ok) throw new Error(`API JSON ${res.status}: ${comp}/${run}`);
            return res.json();
        },
        fetchCsv: async (comp, run, filename) => {
            const res = await fetch(`${baseUrl}/files/${comp}/${run}/${filename}`);
            if (!res.ok) throw new Error(`API CSV ${res.status}: ${filename}`);
            return parseCsvText(await res.text());
        },
        getVideoUrl: (comp, run, filename) => `${baseUrl}/files/${comp}/${run}/${filename}`,
    };
}

function makeElectronProvider() {
    const BASE = "courses_demo";
    return {
        getCompets: async () => window.myAPI.getLocalCompetitions(BASE),
        getRuns: async (comp) => window.myAPI.getLocalRuns(BASE, comp),
        getDatas: async (comp, run) => {
            const files = await window.myAPI.getLocalFiles(BASE, comp, run);
            return files.filter(f => f.name && f.name.includes(".csv"));
        },
        getQuality: async (comp, run, side) => {
            const files = await window.myAPI.getLocalFiles(BASE, comp, run);
            const key = side === "droite" ? "fixeDroite" : "fixeGauche";
            return files.filter(f => f.name && f.name.includes(key));
        },
        loadRunJson: async (comp, run) => window.myAPI.readJsonFile(BASE, comp, run, `${run}.json`),
        fetchCsv: async (comp, run, filename) => window.myAPI.readCsvFile(BASE, comp, run, filename),
        getVideoUrl: (comp, run, filename) => `${BASE}/${comp}/${run}/${filename}`,
    };
}

// ── Mode detection & provider selection ───────────────────────────────────────

export function buildProvider() {
    if (window.myAPI !== undefined) {
        return makeElectronProvider();
    }

    const source = new URLSearchParams(window.location.search).get("source");

    if (source === "static") return makeStaticProvider(staticData, STATIC_BASE);
    if (source === "api")    return makeApiProvider(API_BASE);

    // Default: try API first, fall back to static.
    return makeFallbackProvider(
        makeApiProvider(API_BASE),
        makeStaticProvider(staticData, STATIC_BASE),
        { stickyFallback: true }
    );
}

export const dataProvider = buildProvider();
