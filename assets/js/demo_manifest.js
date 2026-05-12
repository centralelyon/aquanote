/**
 * @file demo_manifest.js
 * @brief Helpers to normalize demo manifests and derive static loader data.
 */

export function createEmptyStaticData() {
    return {
        competitions: [],
        runs: {},
        csvFiles: {},
        videos: {},
        aliases: {},
    };
}

export function normalizeDirectoryEntry(entry) {
    if (typeof entry === "string") {
        return { name: entry, type: "directory" };
    }
    return {
        ...entry,
        type: entry?.type ?? "directory",
    };
}

export function normalizeFileEntry(entry) {
    if (typeof entry === "string") {
        return { name: entry, type: "file" };
    }
    return {
        ...entry,
        type: entry?.type ?? "file",
    };
}

export function normalizeFlatManifest(rawFlat, arrayEntries = {}) {
    if (Array.isArray(rawFlat)) {
        return {
            competitions: [],
            runs: {},
            entries: arrayEntries,
        };
    }

    if (!rawFlat || typeof rawFlat !== "object") {
        return {
            competitions: [],
            runs: {},
            entries: {},
        };
    }

    if ("entries" in rawFlat || "competitions" in rawFlat || "runs" in rawFlat) {
        return {
            competitions: Array.isArray(rawFlat.competitions) ? rawFlat.competitions : [],
            runs: rawFlat.runs && typeof rawFlat.runs === "object" ? rawFlat.runs : {},
            entries: rawFlat.entries && typeof rawFlat.entries === "object" ? rawFlat.entries : {},
        };
    }

    return {
        competitions: [],
        runs: {},
        entries: rawFlat,
    };
}

export function resolveRunAlias(runName, aliases = {}) {
    if (!runName) {
        return runName;
    }
    return aliases[runName] || runName;
}

export async function buildStaticDataFromManifest(flatManifest, loadMetadata = null) {
    const dynamicData = createEmptyStaticData();
    dynamicData.competitions = flatManifest.competitions.map((competition) => ({
        ...competition,
        type: competition.type ?? "directory",
    }));

    const runsByCompetition = flatManifest.runs || {};
    for (const [competitionName, runEntries] of Object.entries(runsByCompetition)) {
        dynamicData.runs[competitionName] = (runEntries || []).map(normalizeDirectoryEntry);

        for (const rawRunEntry of runEntries || []) {
            const runEntry = normalizeDirectoryEntry(rawRunEntry);
            const runName = runEntry.name;
            const manifestEntry = flatManifest.entries[runName] || {};
            const aliases = [
                ...(Array.isArray(runEntry.aliases) ? runEntry.aliases : []),
                ...(Array.isArray(manifestEntry.aliases) ? manifestEntry.aliases : []),
            ];

            dynamicData.aliases[runName] = runName;
            aliases.forEach((alias) => {
                if (alias) {
                    dynamicData.aliases[alias] = runName;
                }
            });

            const csvEntries = runEntry.csvFiles ?? manifestEntry.csvFiles ?? [];
            dynamicData.csvFiles[runName] = csvEntries.map(normalizeFileEntry);

            if (loadMetadata) {
                const metadata = await loadMetadata(competitionName, runName);
                dynamicData.videos[runName] = (metadata?.videos || []).map((video) =>
                    normalizeFileEntry(video.name)
                );
            } else {
                dynamicData.videos[runName] = [];
            }
        }
    }

    return dynamicData;
}
