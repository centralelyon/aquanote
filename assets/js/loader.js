/**
 * @file loader.js
 * @brief fichier d'initialisation et de chargement des courses et de leurs données, la plupart des variables globales originent de ce fichier.
 */
//It fetches some JSON data from a URL and processes it to make it usable.
//It fetches competition data and populates a dropdown list (<select>) with the retrieved data.
//It fetches run data based on the selected competition and populates another dropdown list with the retrieved run data.
//It gets data for a selected competition and run combination.
//It loads the selected run with the selected data.
//It sets up event listeners and initializes some elements.

import { make_flat_usable,vide_last_added_data, find_end, curate_data } from "./data_handler.js";
import { getUrlVars} from "./utils.js";
import { sec_to_timestr, edit_temp_start, video_volume, temp_start, edit_vue_du_dessus, clampSelectedSwim } from "./refactor-script.js";
import { curate_annotate_data, getAvg } from "./data_handler.js";
import { update_cycle_rapide } from "./cycles_handler.js";
import { construct_time_entry, set_placeholder_of_time_entry } from "./side_views.js";
import { vidStart,vidDrag } from "./videoHandler.js";
import { refreshVideoSurface } from "./video_surface.js";
import {
    buildStaticDataFromManifest,
    createEmptyStaticData,
    normalizeFlatManifest,
    resolveRunAlias,
} from "./demo_manifest.js";
import { demoDataRoot, displaySwimmers, setGrad } from "./main.js"
import { detectSportsdataCsvFormatId, detectSportsdataJsonFormatId, formatValidationIssue, validateCsvUrlHeaders } from "./sportsdata.js";
import { dataProvider, setStaticProviderData } from "./aquanote-providers.js";
import { getSportsdataJsonFormatId, getSportsdataLoadFormatId } from "./local_api.js";

let flat;
let flatManifest = null;
let staticData = createEmptyStaticData();

/**
 * @brief contient le nom de la compétition sélectionnée.
 */
export let selected_comp = '';

let ncycle = 20;
const queryString = getUrlVars(); // Lecture des paramètres URL

/**
 *   @brief Dimensions de la piscine
 */
export let pool_size= [50,20];

export let compets={};
export let selected_run = '';
/**@brief contient les noms des annotations déjà réalisées */
export let datas = [];
export let vidName;
/**
 * @brief contient le nombre d'images par secondes de la vidéo.
 */
export let frame_rate = 50;

/**
 * @brief = [t,r] avec t le dictionnaire de la méta de la course (distance, nageurs, vidéos, ...) et r un csv si data contient automatique, [] sinon Initialisé dans load_run()
 */
export let megaData = [];
/**@brief Dictionnaire associant un id_swimmer avec un array de data, ex : {0:[], 1:[{frameId:252, event:"cycle", ...}, {}, ...], ...}*/
export let curr_swims = {};
/**@brief Liste des checkpoints utilisé, last_checkpoint prendra une valeur parmis celles-là*/
export let meters_checkpoints = [0,25,50,75,100,125,150,175,200];
/**@brief Liste des distances où des virages peuvent survenir pour la course chargée (pas opti).*/ 
export let turn_distances = [0,50,100,150,200,250,300,350,400];
/**@brief Dictionnaire associant id_nageur à un dictionnaire associant distance (0 (reaction), 50, 100, 150 et 200m) à un Temps (float, secondes)*/
export let turn_times = { 0:{} ,1:{},2:{},3:{ 0: 1.02, 50: 10.00, 100: 20.00 },4:{},5:{},6:{},7:{}} 
/**@brief le moment où la vidéo se termine */
export let temp_end = -1;
export let inter = 100;
/**
 * @brief nombre de caméra disponible pour la course.
 */
export let n_camera = 2;

const AUTO_SPORTSDATA_CSV_FORMAT = "formats.csv.auto";
const DEFAULT_VIDEO_WIDTH = 1920;
const DEFAULT_VIDEO_HEIGHT = 1080;



window.curr_swims = curr_swims; // Pour que curr_swims soit accessible au html
window.selected_comp = selected_comp; // Pour que selected_comp soit accessible au html

function syncLoaderGlobals() {
    if (typeof window === "undefined") {
        return;
    }
    window.curr_swims = curr_swims;
    window.selected_comp = selected_comp;
    window.megaData = megaData;
    window.frame_rate = frame_rate;
    window.temp_end = temp_end;
}

syncLoaderGlobals();

function extractLaneNumber(laneKey) {
    const match = String(laneKey).match(/\d+/);
    return match ? parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER;
}

export function getLaneKeysFromRaceMetadata(metadata = megaData[0]) {
    const laneMap = metadata?.lignes || {};
    return Object.keys(laneMap).sort((left, right) => {
        const leftNumber = extractLaneNumber(left);
        const rightNumber = extractLaneNumber(right);
        if (leftNumber !== rightNumber) {
            return leftNumber - rightNumber;
        }
        return left.localeCompare(right);
    });
}

export function getLaneCount(metadata = megaData[0]) {
    const laneKeys = getLaneKeysFromRaceMetadata(metadata);
    if (laneKeys.length > 0) {
        return laneKeys.length;
    }
    return Math.max(1, Math.round(pool_size[1] / 2));
}

export function getLaneSpan(metadata = megaData[0]) {
    return pool_size[1] / getLaneCount(metadata);
}

export function isOneIsUp(metaLike = megaData[0]?.videos?.[0] ?? megaData[0]) {
    const value = metaLike?.one_is_up ?? metaLike;
    if (typeof value === "string") {
        return value.toLowerCase() === "true";
    }
    return value === true;
}

export function getLaneYPosition(swimmerIndex, metaLike = megaData[0]?.videos?.[0] ?? megaData[0]) {
    const laneSpan = getLaneSpan(megaData[0] ?? metaLike);
    return (getDisplayLaneIndex(swimmerIndex, metaLike) + 0.5) * laneSpan;
}

export function videoMatchesType(video, typeVideo) {
    const expected = String(typeVideo || "").toLowerCase();
    if (!expected || !video) {
        return false;
    }
    const type = String(video.type_video || "").toLowerCase();
    const name = String(video.name || "").toLowerCase();
    const aliases = expected === "dessus" || expected === "from_above"
        ? ["dessus", "from_above"]
        : [expected];
    return aliases.some((alias) => type === alias || name.includes(alias));
}

export function findVideoByType(videos = megaData[0]?.videos, typeVideo) {
    return Array.isArray(videos)
        ? videos.find((video) => videoMatchesType(video, typeVideo))
        : undefined;
}

function buildFromAboveVideoEntry(metadata, filename) {
    const videos = Array.isArray(metadata?.videos) ? metadata.videos : [];
    const allDestPoints = videos.flatMap((video) => Array.isArray(video.destPts) ? video.destPts : []);
    const xs = allDestPoints.map((point) => Number(point?.[0])).filter(Number.isFinite);
    const ys = allDestPoints.map((point) => Number(point?.[1])).filter(Number.isFinite);
    const width = Math.max(1, Math.round(xs.length ? Math.max(...xs) : 900));
    const height = Math.max(1, Math.round(ys.length ? Math.max(...ys) : 361));
    const sideVideo = videos.find((video) => videoMatchesType(video, "fixeGauche") || videoMatchesType(video, "fixeDroite"))
        || videos[0]
        || {};
    const flashSide = String(metadata?.flash?.side || "").toLowerCase();
    const sideAliases = {
        left: ["left", "gauche"],
        gauche: ["left", "gauche"],
        right: ["right", "droite"],
        droite: ["right", "droite"]
    }[flashSide] || (flashSide ? [flashSide] : []);
    const flashVideo = videos.find((video) => video.start_flash !== undefined)
        || videos.find((video) => sideAliases.some((alias) =>
            `${video?.type_video || ""} ${video?.name || ""}`.toLowerCase().includes(alias)
        ))
        || sideVideo;
    const points = [[0, height], [width, height], [width, 0], [0, 0]];
    return {
        name: filename,
        type_video: "from_above",
        fps: sideVideo.fps || 50,
        width,
        height,
        start_moment: get_temp_start(flashVideo),
        start_side: metadata?.start_side || sideVideo.start_side || "left",
        one_is_up: metadata?.one_is_up ?? sideVideo.one_is_up ?? false,
        srcPts: points,
        destPts: points
    };
}

function videoSelectLabel(video, index) {
    if (videoMatchesType(video, "fixeGauche")) {
        return "gauche";
    }
    if (videoMatchesType(video, "fixeDroite")) {
        return "droite";
    }
    if (videoMatchesType(video, "from_above") || videoMatchesType(video, "dessus")) {
        return "dessus";
    }
    return video.type_video || video.name || `video ${index + 1}`;
}

function syncAnnotationVideoSelect(metadata, activeVideo) {
    const container = document.getElementById("annotation_video_buttons");
    const videos = Array.isArray(metadata?.videos) ? metadata.videos : [];
    if (!container) {
        return;
    }
    const legacySwitch = document.getElementById("vidsw");
    if (legacySwitch) {
        legacySwitch.hidden = videos.length > 0;
    }
    container.replaceChildren(...videos.map((video, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "annotation-video-button";
        button.dataset.videoName = video.name || "";
        button.dataset.videoIndex = String(index);
        button.textContent = videoSelectLabel(video, index);
        button.dataset.active = video.name === activeVideo?.name ? "true" : "false";
        return button;
    }));
    container.hidden = videos.length === 0;
}

async function ensureGeneratedFromAboveVideoEntry(metadata, comp, run) {
    if (!metadata || typeof metadata !== "object") {
        return;
    }
    const videos = Array.isArray(metadata.videos) ? metadata.videos : [];
    metadata.videos = videos;
    const outputName = `${run}_from_above.mp4`;
    const alreadyListed = videos.some((video) => video.name === outputName || videoMatchesType(video, "from_above"));
    if (alreadyListed) {
        return;
    }

    try {
        const url = dataProvider.getVideoUrl(comp, run, outputName);
        let response = await fetch(url, { method: "HEAD" });
        if (response.status === 405 || response.status === 501) {
            response = await fetch(url, { headers: { Range: "bytes=0-0" } });
        }
        if (!response.ok && response.status !== 206) {
            return;
        }
        videos.push(buildFromAboveVideoEntry(metadata, outputName));
        metadata.ncamera = videos.length;
    } catch {
        // File discovery is best-effort; explicit metadata entries remain authoritative.
    }
}

export function getDisplayLaneIndex(swimmerIndex, metaLike = megaData[0]?.videos?.[0] ?? megaData[0]) {
    const laneCount = getLaneCount(megaData[0] ?? metaLike);
    const clampedIndex = Math.max(0, Math.min(swimmerIndex, laneCount - 1));
    return isOneIsUp(metaLike) ? clampedIndex : laneCount - clampedIndex - 1;
}

export function resolveRunName(runName) {
    return resolveRunAlias(runName, staticData.aliases);
}

export function getRunDisplayParts(runName, competitionName = selected_comp) {
    const normalizedRunName = resolveRunName(runName);
    if (!normalizedRunName) {
        return ["", "", "", ""];
    }
    const runEntry = (compets[competitionName] || []).find((run) => run?.name === normalizedRunName);
    const metadataParts = [
        runEntry?.nage,
        runEntry?.sexe,
        runEntry?.distance,
        runEntry?.epreuve,
    ].map((value) => String(value ?? "").trim());
    if (metadataParts.some(Boolean)) {
        return metadataParts;
    }

    const prefix = competitionName ? `${competitionName}_` : "";
    let runWithoutCompetition = prefix && normalizedRunName.startsWith(prefix)
        ? normalizedRunName.slice(prefix.length)
        : normalizedRunName;

    const rawParts = runWithoutCompetition.split("_").filter(Boolean);
    if (prefix && rawParts[0] && /^\d{4}$/.test(rawParts[0])) {
        runWithoutCompetition = rawParts.slice(1).join("_");
    }

    const parts = runWithoutCompetition.split("_").filter(Boolean);
    return [
        parts[0] || "",
        parts[1] || "",
        parts[2] || "",
        parts.slice(3).join("_") || "",
    ];
}

function getRunEntry(runName, competitionName = selected_comp) {
    const normalizedRunName = resolveRunName(runName);
    return (compets[competitionName] || []).find((run) => run?.name === normalizedRunName) || null;
}

function getRunParts(runEntryOrName, competitionName = selected_comp) {
    if (runEntryOrName && typeof runEntryOrName === "object") {
        const metadataParts = [
            runEntryOrName.nage,
            runEntryOrName.sexe,
            runEntryOrName.distance,
            runEntryOrName.epreuve,
        ].map((value) => String(value ?? "").trim());
        if (metadataParts.some(Boolean)) {
            return metadataParts;
        }
        return getRunDisplayParts(runEntryOrName.name, competitionName);
    }
    const entry = getRunEntry(runEntryOrName, competitionName);
    if (entry) {
        return getRunParts(entry, competitionName);
    }
    return getRunDisplayParts(runEntryOrName, competitionName);
}

function formatRunDisplayName(runEntryOrName, competitionName = selected_comp) {
    const parts = getRunParts(runEntryOrName, competitionName).filter(Boolean);
    return parts.length > 0 ? parts.join("_") : String(runEntryOrName?.name || runEntryOrName || "");
}

async function enrichRunsWithMetadata(comp, runs) {
    return Promise.all((runs || []).map(async (run) => {
        try {
            const metadata = await dataProvider.loadRunJson(comp, run.name);
            return {
                ...run,
                ...(metadata?.nage ? { nage: metadata.nage } : {}),
                ...(metadata?.sexe ? { sexe: metadata.sexe } : {}),
                ...(metadata?.distance ? { distance: metadata.distance } : {}),
                ...(metadata?.epreuve ? { epreuve: metadata.epreuve } : {}),
            };
        } catch {
            return run;
        }
    }));
}

function addRunPartsToSets(runEntryOrName, competitionName, type_nage, sexe_nageurs, distance, étape_compétition) {
    const [part1, part2, part3, part4] = getRunParts(runEntryOrName, competitionName);
    if (part1) type_nage.add(part1);
    if (part2) sexe_nageurs.add(part2);
    if (part3) distance.add(part3);
    if (part4) étape_compétition.add(part4);
}

function getDemoAssetUrl(relativePath) {
    return new URL(relativePath, demoDataRoot).href;
}

async function populateStaticDataFromManifest(loadVideos = false) {
    staticData = await buildStaticDataFromManifest(
        flatManifest,
        loadVideos
            ? async (competitionName, runName) => {
                  try {
                      const metadataPath = getDemoAssetUrl(`${competitionName}/${runName}/${runName}.json`);
                      return await d3.json(metadataPath);
                  } catch (error) {
                      console.error(`Could not load metadata for ${runName}:`, error);
                      return { videos: [] };
                  }
              }
            : null
    );
    setStaticProviderData(staticData);
}

async function loadStaticDataFromFlat() {
    const rawFlat = await d3.json(getDemoAssetUrl("flat.json"));
    flatManifest = normalizeFlatManifest(rawFlat, make_flat_usable(rawFlat));
    flat = flatManifest.entries;
    await populateStaticDataFromManifest(true);
}







/**
 * @brief init permet d'initialiser la page en chargeant les données nécessaires.
 * Elle récupère les données JSON, les vidéos des courses ainsi que les annotations déjà réalisées sur cette course.
 */
export async function init() {
  try {
    // Gérer différemment selon l'environnement
    if (isGitHubMode()) {
      await loadStaticDataFromFlat();
    } else {
      const rawFlat = await d3.json(getDemoAssetUrl("flat.json"));
      flatManifest = normalizeFlatManifest(rawFlat, make_flat_usable(rawFlat));
      flat = flatManifest.entries;
      await populateStaticDataFromManifest(true);
    }
      
      await getCompets();
      await getRuns(selected_comp);
      
      if (compets[selected_comp]) {
        processRunData(compets[selected_comp]);
      } else {
        console.error("compets[selected_comp] n'existe pas! selected_comp =", selected_comp);
      }
      
      let selected_run1 = resolveRunName(queryString["course"]);
      if (!selected_run1) {
        selected_run1 = selected_run || compets[selected_comp]?.[0]?.name || "";
      }
      
      // Only proceed with loading run if we have a valid run selected
      if (selected_run1) {
        syncRunSelectorsFromRunName(selected_run1, selected_comp);
        await getDatas(selected_comp, selected_run1);
        if (queryString["data"] && datas.includes(queryString["data"])) {
            $("#temp").val(queryString["data"]);
        }
        await load_run(selected_run1, $("#temp").val());
      }

  } catch (error) {
      console.error("Error in init:", error);
      console.error("Stack trace:", error.stack);
  }
}

/**
 * @brief Traite les données des courses pour remplir les listes déroulantes de sélection avec les options de catégories de nage, sexe des nageurs, distance et étape de compétition.
 * @param {Array} runs - Tableau contenant les noms des courses.
 * @returns {void}
 */

function processRunData(runs) {
  // Initialiser les listes pour chaque position
  const type_nage = new Set();
  const sexe_nageurs = new Set();
  const distance = new Set();
  const étape_compétition = new Set();

  // Parcourir les noms des courses
  runs.forEach(run => {
      addRunPartsToSets(run, selected_comp, type_nage, sexe_nageurs, distance, étape_compétition);
  });
  const sortedDistance = Array.from(distance).sort((a, b) => parseInt(a) - parseInt(b));

  fillDropdown("run_part1", Array.from(type_nage));
  fillDropdown("run_part2", Array.from(sexe_nageurs));
  fillDropdown("run_part3", Array.from(sortedDistance));
  fillDropdown("run_part4", Array.from(étape_compétition));
}

function syncRunSelectorsFromRunName(runName, competitionName = selected_comp) {
    if (!runName || !competitionName) {
        return;
    }

    const normalizedRunName = resolveRunName(runName);
    const [part1, part2, part3, part4] = getRunParts(normalizedRunName, competitionName);

    if (part1) {
        $("#run_part1").val(part1);
    }
    if (part2) {
        $("#run_part2").val(part2);
    }
    if (part3) {
        $("#run_part3").val(part3);
    }
    if (part4) {
        $("#run_part4").val(part4);
    }
}


/**
 * @brief charge les annotations de la course sélectionnée.
 * @param {*} comp 
 * @param {*} run 
 * @returns 
 */
export async function getDatas(comp, run) {
    run = resolveRunName(run);
    datas = [];

    const c = await collectRunCsvEntries(comp, run);

    let select = $("#temp");
    select.empty();

    let csvFiles = await filterSportsdataCsvFiles(comp, run, c);
    for (let i = 0; i < csvFiles.length; i++) {
        select.append("<option value='" + csvFiles[i].name + "'>" + csvFiles[i].name + "</option>");
        datas.push(csvFiles[i].name);
    }
    select.append("<option value='new_data'>new_data</option>");
}

async function dataExistsForRun(comp, run, data) {
    if (!data || data === "new_data") {
        return true;
    }
    if (datas.includes(data)) {
        return true;
    }
    const entries = await collectRunCsvEntries(comp, run);
    const validEntries = await filterSportsdataCsvFiles(comp, run, entries);
    return validEntries.some(entry => entry.name === data);
}

/**
 * @brief permet de récupérer les compétitions disponibles sur le serveur.
 */
export async function getCompets() {
    const queryString = getUrlVars();
    const competitionParam = queryString["competition"];

    $("#competition").empty();

    const data = await dataProvider.getCompets();
    const c = data.filter(d => d.type == "directory");

    let select = $("#competition");
    for (let i = 0; i < c.length; i++) {
        if (c[i].name === competitionParam) {
            selected_comp = c[i].name;
        }
        select.append("<option value='" + c[i].name + "'>" + c[i].name + "</option>");
    }
    if (selected_comp === "" && c.length > 0) {
        selected_comp = c[0].name;
    }
    $("#competition").val(selected_comp);
    c.map(d => compets[d.name] = []);
    syncLoaderGlobals();
}

/**
 * @brief Définit le dictionnaire des compétitions disponibles
 * Met à jour la variable globale compets avec les compétitions fournies
 * 
 * @param {array} c Tableau des compétitions à définir
 */
export function setcompets(c){
  c.map(d => compets[d.name] = []);
}
/**
 * @brief permet de récupérer les options de qualité disponibles pour une compétition et une course spécifiques.
 * @param {*} comp 
 * @param {*} run 
 * @param {*} actual_side 
 * @returns {void}
 */
export async function get_quality(comp, run, actual_side) {
    const c = await dataProvider.getQuality(comp, run, actual_side);

    let select = $("#quality");
    select.empty();
    select.append('<option value="">change quality</option>');

    for (let i = 0; i < c.length; i++) {
        let optionName = c[i].name.split("_");
        optionName = optionName[optionName.length - 1].split(".")[0];
        let regTest = new RegExp("\\d+(p|P|k|K)");
        if (!(regTest.test(optionName))) {
            optionName = "Origine";
        }
        select.append("<option click='getValue(" + c[i].name + ");' value='" + c[i].name + "'>" + optionName + "</option>");
    }
}

/**
 * @brief retourne les courses disponibles pour une compétition spécifique et remplit les listes déroulantes avec les options de nage, sexe des nageurs, distance et étape de compétition.
 * @param {*} comp 
 * @returns 
 */
export async function getRuns(comp) {
  const queryString = getUrlVars();
  const requestedRun = resolveRunName(queryString["course"]);
  
  // Initialiser compets[comp] s'il n'existe pas
  if (!compets[comp]) {
    compets[comp] = [];
  }
  
  if (!compets[comp] || compets[comp].length === 0) {
    const runs = await enrichRunsWithMetadata(comp, await dataProvider.getRuns(comp));
    compets[comp] = runs;
    selected_run = runs[0]?.name || "";

    let select = $("#run");
    select.empty();

    const type_nage = new Set();
    const sexe_nageurs = new Set();
    const distance = new Set();
    const étape_compétition = new Set();
    for (let i = 0; i < runs.length; i++) {
        if (runs[i].name === requestedRun) {
            selected_run = runs[i].name;
        }
        let tclass = "data_missing";
        if (flat && flat[runs[i].name] && "espadon" in flat[runs[i].name]) {
            if (flat[runs[i].name]["espadon"] || flat[runs[i].name]["espadonModifie"]) {
                tclass = "data_unchecked";
            }
        }
        if (flat && flat[runs[i].name] && "data_checked" in flat[runs[i].name]) {
            if (flat[runs[i].name]["data_checked"]) {
                tclass = "data_checked";
            }
        }
        let nomAffiche = formatRunDisplayName(runs[i], comp);
        select.append("<option value='" + runs[i].name + "' class='" + tclass + "'>" + nomAffiche + "</option>");
        addRunPartsToSets(runs[i], comp, type_nage, sexe_nageurs, distance, étape_compétition);
    }
    const sortedDistance = Array.from(distance).sort((a, b) => parseInt(a) - parseInt(b));
    fillDropdown("run_part1", Array.from(type_nage));
    fillDropdown("run_part2", Array.from(sexe_nageurs));
    fillDropdown("run_part3", Array.from(sortedDistance));
    fillDropdown("run_part4", Array.from(étape_compétition));
    $("#run").val(selected_run);
    syncRunSelectorsFromRunName(selected_run, comp);
    await getDatas(comp, selected_run);
    return runs;
  } else {
      const type_nage = new Set();
      const sexe_nageurs = new Set();
      const distance = new Set();
      const étape_compétition = new Set();
      let select = $("#run");
      select.empty();
      if (!selected_run || !compets[comp].some(run => run.name === selected_run)) {
          selected_run = compets[comp][0]?.name || "";
      }
      for (let i = 0; i < compets[comp].length; i++) {
          if (compets[comp][i].name === requestedRun) {
              selected_run = compets[comp][i].name;
          }
          select.append("<option value='" + compets[comp][i].name + "'>" + formatRunDisplayName(compets[comp][i], comp) + "</option>");
          addRunPartsToSets(compets[comp][i], comp, type_nage, sexe_nageurs, distance, étape_compétition);
          }
        const sortedDistance = Array.from(distance).sort((a, b) => parseInt(a) - parseInt(b));
        fillDropdown("run_part1", Array.from(type_nage));
        fillDropdown("run_part2", Array.from(sexe_nageurs));
        fillDropdown("run_part3", Array.from(sortedDistance));
        fillDropdown("run_part4", Array.from(étape_compétition));
        $("#run").val(selected_run);
        syncRunSelectorsFromRunName(selected_run || compets[comp][0]?.name, comp);
        await getDatas(comp, selected_run);
  }
  return compets[comp];
}

/**
 * @brief fonction qui remplit un élément <select> avec des options.
 * @param {string} dropdownId 
 * @param {object} options tableau d'options à ajouter au dropdown. 
 */
function fillDropdown(dropdownId, options) {
  const dropdown = document.getElementById(dropdownId);
  dropdown.innerHTML = ""; // Vider les options existantes

  // Ajouter les nouvelles options
  options.forEach(optionText => {
      const option = document.createElement("option");
      option.value = optionText;
      option.textContent = optionText;
      dropdown.appendChild(option);
  });

  if (options.length > 0) {
      dropdown.value = options[0];
  }

}
/**
 * @brief permet de récupérer le temps de départ d'une course à partir des métadonnées.
 * @param {*} meta 
 * @returns 
 */
export function get_temp_start(meta) {
  let temp_start_temp;
    if (meta?.start_flash !== undefined) {
        temp_start_temp = meta.start_flash
    } else if (meta?.start_synchro_flash !== undefined) {
        temp_start_temp = meta.start_synchro_flash
    } else {
        temp_start_temp = meta?.start_moment
    }
    if (isNaN(temp_start_temp)) {
        temp_start_temp = 0;
    }
    if(temp_start_temp === undefined){
        temp_start_temp = 0;
    }

    return temp_start_temp
}

/**
 * @brief permet de charger une course spécifique avec ses données associées.
 * @param {*} run 
 * @param {*} data 
 * @param {*} starTime 
 */
export async function load_run(run, data, starTime = null) {
  run = resolveRunName(run);
  edit_vue_du_dessus(false); // Réinitialise la vue du dessus
  const errors = []; // Liste des erreurs rencontrées

  try {
    selected_comp = $("#competition").val();

    if (data && data !== "new_data") {
      const existsForRun = await dataExistsForRun(selected_comp, run, data);
      if (!existsForRun) {
        console.warn(`Ignoring stale data selection "${data}" for run "${run}".`);
        data = "";
      }
    }

    let t;

    try {
      t = await loadRunMetadata(selected_comp, run);
    } catch (e) {
      console.error("Erreur lors du chargement des métadonnées:", e);
      errors.push(`Metadonnees JSON ou sportsdata introuvables pour ${run}:\n${errorMessage(e)}`);
      throw e;
    }
    await ensureGeneratedFromAboveVideoEntry(t, selected_comp, run);

    let meta = null;
    vidName = "";
    $("#vidsw").show();
    n_camera = 2; // Valeur par défaut, peut être modifiée par le JSON
    if (Array.isArray(t.videos)) {
      n_camera = t.videos.length;
    } else if (t.ncamera){
      n_camera = t.ncamera;
    }
    if (n_camera === 1) {
      $("#vidsw").hide();
    }
    try {
      if (t.videos && t.videos.length > 0) {
        if (n_camera > 1) {
          meta = findVideoByType(t.videos, "fixeDroite");

          if ((meta?.start_side || t.start_side) === "left") {
            meta = findVideoByType(t.videos, "fixeGauche");
          }
          meta = meta || t.videos[0];
        }
        else if (n_camera === 1) {
          meta = t.videos[0];
        }

        if (!meta) {
          errors.push("Vidéo 'fixeDroite' ou 'fixeGauche' introuvable.");
        } else {
          vidName = meta.name;
        }
      } else {
        errors.push("Aucune vidéo référencée dans le JSON.");
      }
    } catch  {
      errors.push("Erreur lors de la lecture des métadonnées vidéo.");
    }
    if (t.taille_piscine){
      pool_size=t.taille_piscine;
    }
    else{
      pool_size=[50,20];// utile pour la rétrocompatibilité vis a vis des courses déjà annotées qui n'ont pas de taile_piscine dans le json
    }
    const laneCount = getLaneCount(t);
    frame_rate = (meta && !isNaN(parseInt(meta.fps))) ? parseInt(meta.fps) : 50;
    let validatedAnnotationRows = null;
    
    if (data !== "new_data" && data && data.trim() !== "") {
      let r = [];
      try {
        
        const csvUrl = dataProvider.getVideoUrl(selected_comp, run, data);

        if (shouldValidateSwimmingTrackingCsv(data)) {
          const parsedCsv = await validateAndParseSportsdataCsv(csvUrl, data);
	          validatedAnnotationRows = normalizeSportsdataRows(
	            parsedCsv.rows,
	            t,
              parsedCsv.formatId
	          );
          r = validatedAnnotationRows;
        } else {
          r = await dataProvider.fetchCsv(selected_comp, run, data);
        }

        if (!Array.isArray(r)) r = [];
        if (r.length > 0 && r[0]['startTimeEdit'] != null && starTime == null) {
          edit_temp_start(r[0]['startTimeEdit']);
        } else {
          edit_temp_start(starTime == null ? get_temp_start(meta) : parseFloat((starTime.toString()).split(':')[1]));
        }
      } catch (e) {
        if (shouldValidateSwimmingTrackingCsv(data)) {
          alert(`Impossible de charger le CSV sportsdata "${data}":\n\n${errorMessage(e)}`);
          throw e;
        }
        errors.push(`Fichier CSV '${data}' introuvable ou invalide: ${errorMessage(e)}`);
        edit_temp_start(get_temp_start(meta));
      }
    } else {
      edit_temp_start(get_temp_start(meta));
    }
      $('#editStartTime').attr('value', sec_to_timestr(temp_start));
      selected_run = run;
  
      if (t.temps) {
        let tmax = -Infinity;
        let keys = Object.keys(t.temps);
        for (let i = 0; i < keys.length; i++) {
          if (t.temps[keys[i]] === "None") continue;
  
          let tem = ("" + t.temps[keys[i]]).split(":");
          let ttem = (parseInt(tem[0]) * 60) + parseFloat(tem[1]);
  
          if (ttem > tmax) tmax = ttem;
        }
        temp_end = tmax;
      }
      if (data && data.includes("automatique")) {

        let r = await dataProvider.fetchCsv(selected_comp, run, data);
        megaData = [t, r];
        let maxFrame = Math.max(...megaData[1].map(d => d.frame_number));
  
        let temp = getAvg(megaData[0]);
  
        if (temp) {
          temp_end = temp;
        } else {
          find_end(megaData[1], parseInt(megaData[0]["distance"]));
        }
        
        inter = parseInt(maxFrame / ncycle);
  
        for (let i = 0; i < laneCount; i++) {
          curr_swims[i] = curate_data(megaData[1].filter(d => d.swimmer == i), t);
        }
      } else if (data === "new_data" || !data || !datas.includes(data)) {
        megaData = [t, []];
        for (let i = 0; i < laneCount; i++) {
          curr_swims[i] = [];
        }
      } else {
        megaData = [t, []];
        let time_dif;

        const csvUrl = dataProvider.getVideoUrl(selected_comp, run, data);
        const parsedCsv = validatedAnnotationRows
          ? null
          : await validateAndParseSportsdataCsv(csvUrl, data);
	        let r = validatedAnnotationRows ?? normalizeSportsdataRows(
	          parsedCsv.rows,
	          t,
            parsedCsv.formatId
	        );

        if (r[0]['startTimeEdit'] != null) {
          time_dif = temp_start - r[0]['startTimeEdit'];
        } else {
          time_dif = temp_start - get_temp_start(meta);
        }
        let frameId_dif = frame_rate * time_dif;
  
        for (let i = 0; i < r.length; i++) {
          if (temp_start) r[i].frameId = parseFloat((r[i].frameId + frameId_dif));
        }
  
        r = curate_annotate_data(r);
  
        for (let i = 0; i < laneCount; i++) {
          curr_swims[i] = r.filter(d => d.swimmerId == i);
        }
      }
      if (!isNaN(megaData[0].distance)) {
        meters_checkpoints = [];
        turn_distances = [];
        for (let i = 0; i <= megaData[0].distance; i += 25) {
          meters_checkpoints.push(i);
        }
        for (let i = 0; i <= megaData[0].distance; i += pool_size[0]) {
          turn_distances.push(i);
        }
      } else {
        const regex_dist = "_[0-9]+[x]*[0-9]+[._]";
        let resultats = run.match(regex_dist);
        if (resultats != null) {
          resultats = resultats[0].slice(1, -1);
          resultats = resultats.split("x");
          if (resultats.length > 1) {
            resultats = parseInt(resultats[0]) * parseInt(resultats[1]);
          } else {
            resultats = resultats[0];
          }
  
          meters_checkpoints = [];
          turn_distances = [];
          for (let i = 0; i <= resultats; i += 25) {
            meters_checkpoints.push(i);
          }
          for (let i = 0; i <= resultats; i += pool_size[0]) {
            turn_distances.push(i);
          }
        }
      }
      for (let i = 0; i < laneCount; i++) {
        turn_times[i] = {};
        let all_turn_data = curr_swims[i].filter(annotation => (annotation.mode == "turn" || annotation.mode == "finish" || annotation.mode == "reaction"));
        for (let turn_data of all_turn_data) {
          if (turn_distances.includes(turn_data.cumul)) {
            turn_times[i][turn_data.cumul] = (turn_data.frameId) / frame_rate;
          } else if ([0].includes(turn_data.cumul)) {
            turn_times[i][turn_data.cumul] = (turn_data.frameId) / frame_rate;
          }
          
        }
      }
      syncLoaderGlobals();
      $("#swim_switch").html("");
      clampSelectedSwim(laneCount);
      displaySwimmers(t["lignes"]);
      $("#vid").attr("crossorigin", "anonymous");
      
      if (meta?.name) {
        $("#vid").attr("src", dataProvider.getVideoUrl(selected_comp, run, meta.name));
      }
      syncAnnotationVideoSelect(t, meta);
      vide_last_added_data();
      update_cycle_rapide();
      construct_time_entry();
      set_placeholder_of_time_entry();
      d3.selectAll("#video").call(d3.drag().on("start", vidStart).on("drag", vidDrag));
      refreshVideoSurface(meta);
      document.getElementById("vid").currentTime = temp_start;
      document.getElementById('vid').volume = video_volume;
      setGrad(temp_start);
    
  } catch (e) {
    console.error("Erreur principale :", e);
    if (errors.length > 0) {
      alert("Erreurs détectées pendant le chargement :\n\n" + errors.join("\n"));
    }
  }
  
  let is_dessus=megaData[0].videos.filter(d => videoMatchesType(d, "dessus") || videoMatchesType(d, "from_above"));
  if (is_dessus.length > 0) {
    $(".vid_dessus").show();
  } else {
    $(".vid_dessus").hide();
  }
}

// des setters pour les variables globales

/**
 * @brief Modifie le temps de fin de la course
 * Setter pour la variable globale temp_end
 * 
 * @param {number} x Nouveau temps de fin
 */
export function edit_temp_end(x) {
    temp_end=x;
}

/**
 * @brief Modifie le nom de la vidéo chargée
 * Setter pour la variable globale vidName
 * 
 * @param {string} x Nouveau nom de vidéo
 */
export function edit_vidName(x) {
    vidName=x;
}

/**
 * @brief Vérifie si on est en mode GitHub Pages (sans API locale).
 * @returns {boolean} true si on est sur GitHub, false sinon
 */
function isGitHubMode() {
    return (
        window.location.hostname.includes('github.io') ||
        window.location.hostname.includes('githubusercontent.com') ||
        window.location.pathname.includes('/annotation/')
    );
}

function parseCsvText(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length === 0) return [];
    const headers = lines[0].split(',');
    return lines.slice(1).map(line => {
        const values = line.split(',');
        let row = {};
        headers.forEach((header, i) => {
            let v = values[i] !== undefined ? values[i] : "";
            if (v === "") {
                row[header] = v;
            } else if (!isNaN(Number(v)) && v.trim() !== "") {
                row[header] = Number(v);
            } else if (v.toLowerCase() === "true") {
                row[header] = true;
            } else if (v.toLowerCase() === "false") {
                row[header] = false;
            } else {
                row[header] = v;
            }
        });
        return row;
    });
}

function sportsdataCsvHeadersFromRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return [];
    }
    return Object.keys(rows[0] || {});
}

function supportedVideoFile(entry) {
    const name = String(entry?.name || "");
    return /\.(mp4|mov|m4v|webm)$/i.test(name);
}

function guessDistanceFromName(run, rows = []) {
    const runMatch = String(run || "").match(/(?:^|[-_])(\d{2,4})m?(?:[-_]|$)/i);
    if (runMatch) {
        return String(parseInt(runMatch[1], 10));
    }
    const maxDistance = Math.max(
        0,
        ...rows.map((row) => Number(row.distanceSwam)).filter(Number.isFinite),
        ...rows.map((row) => Number(row.distance)).filter(Number.isFinite)
    );
    if (maxDistance > 0) {
        return String(Math.round(maxDistance));
    }
    return "50";
}

function guessStrokeFromName(run) {
    const normalized = String(run || "").toLowerCase();
    if (normalized.includes("back") || normalized.includes("dos")) return "backstroke";
    if (normalized.includes("breast") || normalized.includes("brasse")) return "breaststroke";
    if (normalized.includes("fly") || normalized.includes("papillon")) return "butterfly";
    if (normalized.includes("free") || normalized.includes("crawl")) return "freestyle";
    return "freestyle";
}

function guessSexFromName(run) {
    const normalized = String(run || "").toLowerCase();
    if (normalized.includes("women") || normalized.includes("femme")) return "femmes";
    if (normalized.includes("men") || normalized.includes("homme")) return "hommes";
    if (normalized.includes("mixed") || normalized.includes("mixte")) return "mixte";
    return "hommes";
}

function guessRoundFromName(run) {
    const normalized = String(run || "").toLowerCase();
    if (normalized.includes("semi") || normalized.includes("demi")) return "demifinale";
    if (normalized.includes("serie") || normalized.includes("heat")) return "serie";
    if (normalized.includes("final")) return "finale";
    return "finale";
}

function numericSwimmerIdsFromRows(rows) {
    return [...new Set((rows || [])
        .map((row) => Number(row.swimmerId))
        .filter(Number.isFinite))]
        .sort((left, right) => left - right);
}

function buildLaneMapFromRows(rows) {
    const ids = numericSwimmerIdsFromRows(rows);
    const laneMap = {};
    for (const swimmerId of ids) {
        const rowWithName = rows.find((row) => Number(row.swimmerId) === swimmerId && String(row.name || row.swimmerName || "").trim());
        const name = String(rowWithName?.name || rowWithName?.swimmerName || "").trim();
        laneMap[`ligne${swimmerId + 1}`] = name || `Swimmer ${swimmerId + 1}`;
    }
    if (Object.keys(laneMap).length === 0) {
        for (let index = 0; index < 8; index += 1) {
            laneMap[`ligne${index + 1}`] = `Swimmer ${index + 1}`;
        }
    }
    return laneMap;
}

function defaultVideoEntry(filename, metadata = {}) {
    const width = Number(metadata.width) || DEFAULT_VIDEO_WIDTH;
    const height = Number(metadata.height) || DEFAULT_VIDEO_HEIGHT;
    const corners = [[0, height], [width, height], [width, 0], [0, 0]];
    return {
        name: filename,
        type_video: "from_above",
        fps: Number(metadata.fps) || 50,
        width,
        height,
        start_moment: Number(metadata.start_moment) || 0,
        start_side: metadata.start_side || "left",
        one_is_up: Boolean(metadata.one_is_up),
        srcPts: corners,
        destPts: corners
    };
}

function entryExists(entries, filename) {
    const expected = String(filename || "").split("/").pop();
    return Boolean(expected) && (entries || []).some((entry) => entry?.name === expected);
}

function firstMatchingEntryName(entries, predicate) {
    return (entries || []).find(predicate)?.name || "";
}

function chooseRunCsvName(rawMetadata, entries, parsedCsv) {
    const explicitCsv = String(rawMetadata?.dataCSV || rawMetadata?.sourceSportsdata?.csv || "").split("/").pop();
    if (entryExists(entries, explicitCsv)) {
        return explicitCsv;
    }
    if (parsedCsv?.name) {
        return parsedCsv.name;
    }
    return firstMatchingEntryName(entries, (entry) => entry?.name?.toLowerCase().endsWith(".csv"));
}

function chooseRunVideoName(rawMetadata, run, entries) {
    const explicitVideo = String(rawMetadata?.video || rawMetadata?.videoName || "").split("/").pop();
    if (entryExists(entries, explicitVideo)) {
        return explicitVideo;
    }
    const runLower = String(run || "").toLowerCase();
    return firstMatchingEntryName(entries, (entry) =>
        supportedVideoFile(entry) && String(entry.name || "").toLowerCase().includes(runLower)
    ) || firstMatchingEntryName(entries, supportedVideoFile);
}

function swimflowGenderToAquanote(value, run = "") {
    const gender = String(value || "").toLowerCase();
    if (gender === "women") return "femmes";
    if (gender === "men") return "hommes";
    if (gender === "mixed") return "mixte";
    return guessSexFromName(run);
}

function swimflowStyleToAquanote(value, run = "") {
    const style = String(value || "").toLowerCase();
    if (style.includes("back")) return "backstroke";
    if (style.includes("breast")) return "breaststroke";
    if (style.includes("butterfly") || style.includes("fly")) return "butterfly";
    if (style.includes("free")) return "freestyle";
    return guessStrokeFromName(run);
}

function buildLaneMapFromSwimmersInfo(swimmersInfo) {
    const rows = Array.isArray(swimmersInfo)
        ? swimmersInfo.map((swimmer) => ({
            swimmerId: swimmer?.swimmerId,
            name: swimmer?.name
        }))
        : [];
    return buildLaneMapFromRows(rows);
}

function swimflowMetadataToAquanote(rawMetadata, comp, run, entries = [], parsedCsv = null) {
    const rows = parsedCsv?.rows || [];
    const laneMap = rows.length > 0
        ? buildLaneMapFromRows(rows)
        : buildLaneMapFromSwimmersInfo(rawMetadata?.swimmersInfo);
    const csvName = chooseRunCsvName(rawMetadata, entries, parsedCsv);
    const videoName = chooseRunVideoName(rawMetadata, run, entries);
    const distance = Number(rawMetadata?.distance) || Number(guessDistanceFromName(run, rows)) || 50;
    const poolLength = Number(rawMetadata?.poolLapLength) || 50;
    const fps = Number(rawMetadata?.framerate) || 50;
    const startMoment = Number(rawMetadata?.raceStartTime) || 0;
    const videos = videoName
        ? [defaultVideoEntry(videoName, { fps, start_moment: startMoment })]
        : [];

    return {
        name: run,
        city: comp,
        cup: rawMetadata?.level || comp,
        distance: String(distance),
        epreuve: guessRoundFromName(run),
        lignes: laneMap,
        nage: swimflowStyleToAquanote(rawMetadata?.style, run),
        sexe: swimflowGenderToAquanote(rawMetadata?.gender, run),
        one_is_up: false,
        start_side: "left",
        taille_piscine: [poolLength, Math.max(1, Object.keys(laneMap).length) * 2.5],
        csvFiles: csvName ? [csvName] : [],
        temps: {},
        sourceSportsdata: {
            format: detectSportsdataJsonFormatId(rawMetadata) || "formats.json.swimflow",
            selectedJsonFormat: getSportsdataJsonFormatId(),
            csv: csvName || rawMetadata?.dataCSV || "",
            originalName: rawMetadata?.name || "",
            defaultsSuggested: true,
            missingMetadataFilled: ["city", "cup", "epreuve", "lignes", "videos", "taille_piscine"]
        },
        videos,
        ncamera: videos.length
    };
}

function normalizeRunMetadata(rawMetadata, comp, run, entries = [], parsedCsv = null) {
    const detectedFormat = detectSportsdataJsonFormatId(rawMetadata);
    const selectedFormat = getSportsdataJsonFormatId();
    if (
        detectedFormat === "formats.json.swimflow" ||
        detectedFormat === "formats.json.swimflow-metadata" ||
        (
            selectedFormat !== "formats.json.swimming-event-config" &&
            rawMetadata?.dataCSV &&
            Array.isArray(rawMetadata?.swimmersInfo)
        )
    ) {
        return swimflowMetadataToAquanote(rawMetadata, comp, run, entries, parsedCsv);
    }
    return rawMetadata;
}

function errorMessage(error) {
    if (!error) {
        return "Unknown error";
    }
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return String(error);
}

function formatCsvFailures(failures = []) {
    if (!failures.length) {
        return "No CSV file was available to try.";
    }
    return failures.map((failure) => {
        const reasons = (failure.reasons || []).length
            ? failure.reasons.join("; ")
            : "No validation details returned.";
        return `${failure.name}: ${reasons}`;
    }).join("\n");
}

async function readFirstSupportedSportsdataCsv(comp, run, entries, diagnostics = null) {
    const csvEntries = (entries || []).filter((entry) => entry?.name && entry.name.toLowerCase().endsWith(".csv"));
    if (diagnostics) {
        diagnostics.csvFiles = csvEntries.map((entry) => entry.name);
        diagnostics.csvFailures = diagnostics.csvFailures || [];
    }
    for (const entry of csvEntries) {
        try {
            const csvUrl = dataProvider.getVideoUrl(comp, run, entry.name);
            const parsed = await validateAndParseSportsdataCsv(csvUrl, entry.name);
            return {
                ...parsed,
                name: entry.name
            };
        } catch (error) {
            console.warn(`Could not use ${entry.name} as sportsdata CSV for ${comp}/${run}:`, error);
            diagnostics?.csvFailures?.push({
                name: entry.name,
                reasons: [errorMessage(error)]
            });
        }
    }
    return null;
}

async function buildFallbackRunMetadata(comp, run, originalError) {
    const entries = await dataProvider.getDatas(comp, run);
    const diagnostics = { csvFiles: [], csvFailures: [] };
    const parsedCsv = await readFirstSupportedSportsdataCsv(comp, run, entries, diagnostics);
    const rows = parsedCsv?.rows || [];
    const videoEntry = (entries || []).find(supportedVideoFile);

    if (!videoEntry && !parsedCsv) {
        throw new Error([
            `Could not load metadata for ${comp}/${run}.`,
            `JSON metadata failed: ${errorMessage(originalError)}`,
            `Run files found: ${(entries || []).map((entry) => entry?.name).filter(Boolean).join(", ") || "none"}`,
            `Sportsdata CSV failed:\n${formatCsvFailures(diagnostics.csvFailures)}`
        ].join("\n"));
    }

    const laneMap = buildLaneMapFromRows(rows);
    const distance = guessDistanceFromName(run, rows);
    const metadata = {
        name: run,
        city: comp,
        cup: comp,
        distance,
        epreuve: guessRoundFromName(run),
        lignes: laneMap,
        nage: guessStrokeFromName(run),
        sexe: guessSexFromName(run),
        one_is_up: false,
        start_side: "left",
        taille_piscine: [50, 20],
        csvFiles: parsedCsv ? [parsedCsv.name] : [],
        sourceSportsdata: parsedCsv ? {
            format: parsedCsv.formatId,
            csv: parsedCsv.name,
            defaultsSuggested: true,
            missingMetadataFilled: ["city", "cup", "distance", "epreuve", "lignes", "nage", "sexe", "videos"],
            loadDiagnostics: diagnostics
        } : {
            defaultsSuggested: true,
            missingMetadataFilled: ["city", "cup", "distance", "epreuve", "lignes", "nage", "sexe", "videos"],
            loadDiagnostics: diagnostics
        },
        videos: videoEntry ? [defaultVideoEntry(videoEntry.name)] : [],
    };
    metadata.ncamera = metadata.videos.length;
    console.info(`Built default Aquanote metadata for ${comp}/${run}`, metadata);
    return metadata;
}

async function loadRunMetadata(comp, run) {
    try {
        const rawMetadata = await dataProvider.loadRunJson(comp, run);
        const entries = await dataProvider.getDatas(comp, run).catch(() => []);
        const jsonFormatId = detectSportsdataJsonFormatId(rawMetadata);
        const diagnostics = { csvFiles: [], csvFailures: [] };
        const parsedCsv = (jsonFormatId === "formats.json.swimflow" || jsonFormatId === "formats.json.swimflow-metadata")
            ? await readFirstSupportedSportsdataCsv(comp, run, entries, diagnostics)
            : null;
        const metadata = normalizeRunMetadata(rawMetadata, comp, run, entries, parsedCsv);
        if (metadata?.sourceSportsdata && diagnostics.csvFiles.length) {
            metadata.sourceSportsdata.loadDiagnostics = diagnostics;
        }
        return metadata;
    } catch (error) {
        console.warn(`Run JSON missing or invalid for ${comp}/${run}; trying sportsdata fallback metadata.`, error);
        return buildFallbackRunMetadata(comp, run, error);
    }
}

function csvEntry(name) {
    return { name, type: "file" };
}

function addUniqueCsvEntry(entries, seen, name) {
    const csvName = String(name || "").trim();
    if (!csvName || !csvName.toLowerCase().endsWith(".csv") || seen.has(csvName)) {
        return;
    }
    seen.add(csvName);
    entries.push(csvEntry(csvName));
}

async function collectRunCsvEntries(comp, run) {
    const entries = [];
    const seen = new Set();

    try {
        const providerEntries = await dataProvider.getDatas(comp, run);
        for (const entry of providerEntries || []) {
            addUniqueCsvEntry(entries, seen, entry?.name);
        }
    } catch (error) {
        console.warn(`Could not list CSV files for ${comp}/${run}:`, error);
    }

    try {
        const metadata = await loadRunMetadata(comp, run);
        for (const csvName of metadata?.csvFiles || []) {
            addUniqueCsvEntry(entries, seen, csvName);
        }
        for (const csvName of metadata?.annotations || []) {
            addUniqueCsvEntry(entries, seen, csvName);
        }
        addUniqueCsvEntry(entries, seen, metadata?.sourceSportsdata?.csv);
    } catch (error) {
        console.warn(`Could not inspect run metadata for CSV files in ${comp}/${run}:`, error);
    }

    return entries;
}

async function filterSportsdataCsvFiles(comp, run, entries) {
    const csvFiles = (entries || []).filter((entry) => entry?.name && entry.name.toLowerCase().endsWith(".csv"));
    console.info(`[Sportsdata CSV] Found ${csvFiles.length} CSV file(s) for ${comp}/${run}`, csvFiles.map((entry) => entry.name));
    const validationResults = await Promise.all(csvFiles.map(async (entry) => {
        const csvUrl = dataProvider.getVideoUrl(comp, run, entry.name);
        try {
            const result = await inspectSportsdataCsv(csvUrl);
            if (result.ok) {
                console.info(`[Sportsdata CSV] Accepted ${entry.name}`, {
                    format: result.formatId,
                    headers: result.headers,
                    warnings: result.warnings
                });
                return entry;
            }
            console.warn(`[Sportsdata CSV] Rejected ${entry.name}`, {
                url: csvUrl,
                headers: result.headers,
                reasons: result.reasons
            });
            return null;
        } catch (error) {
            console.warn(`[Sportsdata CSV] Rejected ${entry.name}`, {
                url: csvUrl,
                reasons: [error?.message || String(error)]
            });
            return null;
        }
    }));

    return validationResults.filter(Boolean);
}

function shouldValidateSwimmingTrackingCsv(data) {
    return Boolean(data && data !== "new_data" && !String(data).includes("automatique"));
}

async function inspectSportsdataCsv(csvUrl) {
    const preferredFormatId = getSportsdataLoadFormatId();
    const formatIds = [...new Set([preferredFormatId, AUTO_SPORTSDATA_CSV_FORMAT])];
    const failures = [];

    for (const formatId of formatIds) {
        try {
            const result = await validateCsvUrlHeaders(csvUrl, { formatId });
            const errors = result.issues.filter((issue) => (issue.severity || "error") === "error");
            const warnings = result.issues
                .filter((issue) => (issue.severity || "error") !== "error")
                .map(formatValidationIssue);
            if (errors.length === 0) {
                return {
                    ok: true,
                    result,
                    text: result.text,
                    rows: parseCsvText(result.text),
                    headers: result.headers,
                    formatId: result.formatId || formatId,
                    warnings
                };
            }
            failures.push({
                formatId: result.formatId || formatId,
                headers: result.headers,
                reasons: errors.map(formatValidationIssue)
            });
        } catch (error) {
            failures.push({
                formatId,
                headers: [],
                reasons: [error?.message || String(error)]
            });
        }
    }

    const firstFailure = failures[0] || {};
    return {
        ok: false,
        headers: firstFailure.headers || [],
        formatFailures: failures,
        reasons: failures.flatMap((failure) =>
            (failure.reasons || []).map((reason) => `${failure.formatId}: ${reason}`)
        )
    };
}

async function validateAndParseSportsdataCsv(csvUrl, data) {
    const result = await inspectSportsdataCsv(csvUrl);
    if (!result.ok) {
        const message = [
            `Sportsdata CSV validation failed for ${data}.`,
            `URL: ${csvUrl}`,
            `Detected headers: ${(result.headers || []).join(", ") || "none"}`,
            `Reasons:\n${result.reasons.join("\n") || "No detailed reason returned."}`
        ].join("\n");
        console.error(message);
        throw new Error(message);
    }

    console.log(`Sportsdata CSV header validation ok for ${data}`, {
        format: result.formatId,
        headers: result.headers,
        warnings: result.warnings
    });
    return {
        rows: result.rows,
        formatId: result.formatId
    };
}

function formatSportsdataNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function normalizeBasicTrackingRows(rows, metadata) {
    const poolLength = Number(metadata?.taille_piscine?.[0]) || 50;
    const poolWidth = Number(metadata?.taille_piscine?.[1]) || 20;
    const laneKeys = getLaneKeysFromRaceMetadata(metadata);
    const laneCount = Math.max(1, laneKeys.length);
    const sourceLane = metadata?.sourceSportsdata?.lane;
    const defaultLaneIndex = Math.max(0, laneKeys.indexOf(sourceLane));
    const swimmers = metadata?.lignes || {};
    const startSide = String(metadata?.start_side || metadata?.videos?.[0]?.start_side || "left");
    const swimmerIds = [...new Set(rows
        .map((row) => Number(row.swimmerId))
        .filter(Number.isFinite))]
        .sort((left, right) => left - right);
    const swimmerIdToLaneIndex = new Map(swimmerIds.map((swimmerId, index) => [swimmerId, index]));

    return rows.map((row) => {
        const rawSwimmerId = Number(row.swimmerId);
        const swimmerId = swimmerIdToLaneIndex.has(rawSwimmerId)
            ? swimmerIdToLaneIndex.get(rawSwimmerId)
            : defaultLaneIndex;
        const laneIndex = Math.max(0, Math.min(laneCount - 1, swimmerId));
        const lane = laneKeys[laneIndex] || `ligne${laneIndex + 1}`;
        const distance = formatSportsdataNumber(row.distance);
        const time = formatSportsdataNumber(row.time);
        const eventX = startSide === "left"
            ? Math.max(0, Math.min(poolLength, poolLength - distance))
            : Math.max(0, Math.min(poolLength, distance));
        const eventY = (laneIndex + 0.5) * (poolWidth / laneCount);

        return {
            frameId: Number(row.frameId),
            swimmerId,
            swimmerName: swimmers[lane] || `Swimmer ${swimmerId + 1}`,
            lane,
            cumul: distance,
            eventId: row.eventId,
            eventX,
            eventY,
            event: row.eventId,
            "TempsVideo (s)": time,
            "Temps (s)": time,
            "distance (m)": distance,
            "tempo (s)": "",
            "frequence (cylce/min)": "",
            "amplitude (m)": "",
            "vitesse (m/s)": ""
        };
    });
}

function normalizeSwimflowEventName(value) {
    const event = String(value || "").trim();
    if (!event) return "cycle";
    if (event === "end") return "finish";
    return event;
}

function normalizeSwimflowRows(rows, metadata) {
    const poolLength = Number(metadata?.taille_piscine?.[0]) || 50;
    const poolWidth = Number(metadata?.taille_piscine?.[1]) || 20;
    const laneKeys = getLaneKeysFromRaceMetadata(metadata);
    const laneCount = Math.max(1, laneKeys.length);
    const swimmers = metadata?.lignes || {};
    const swimmerIds = numericSwimmerIdsFromRows(rows);
    const swimmerIdToLaneIndex = new Map(swimmerIds.map((swimmerId, index) => [swimmerId, index]));

    return rows.map((row) => {
        const rawSwimmerId = Number(row.swimmerId);
        const rawLaneIndex = laneKeys.indexOf(`ligne${rawSwimmerId + 1}`);
        const swimmerId = rawLaneIndex >= 0
            ? rawLaneIndex
            : swimmerIdToLaneIndex.get(rawSwimmerId) ?? 0;
        const laneIndex = Math.max(0, Math.min(laneCount - 1, swimmerId));
        const lane = laneKeys[laneIndex] || `ligne${laneIndex + 1}`;
        const distanceSwam = formatSportsdataNumber(row.distanceSwam);
        const xMiddle = Number(row.x_middle);
        const eventX = Number.isFinite(xMiddle)
            ? Math.max(0, Math.min(poolLength, xMiddle))
            : Math.max(0, Math.min(poolLength, distanceSwam % poolLength));
        const eventY = (laneIndex + 0.5) * (poolWidth / laneCount);
        const elapsed = formatSportsdataNumber(row.elapsed);
        const event = normalizeSwimflowEventName(row.event);
        const swimmerName = String(row.name || swimmers[lane] || `Swimmer ${laneIndex + 1}`).trim();

        return {
            ...row,
            frameId: Number(row.frameId),
            swimmerId,
            swimmerName,
            lane,
            cumul: distanceSwam,
            eventId: event,
            eventX,
            eventY,
            event,
            "TempsVideo (s)": elapsed,
            "Temps (s)": elapsed,
            "distance (m)": distanceSwam,
            "tempo (s)": row.elapsed || "",
            "frequence (cylce/min)": "",
            "amplitude (m)": row.strokeDistance || "",
            "vitesse (m/s)": row.speed || ""
        };
    });
}

function normalizeSportsdataRows(rows, metadata, formatId = getSportsdataLoadFormatId()) {
    const resolvedFormatId = formatId || detectSportsdataCsvFormatId(sportsdataCsvHeadersFromRows(rows));
    if (resolvedFormatId === "formats.csv.swimming-basic-tracking") {
        return normalizeBasicTrackingRows(rows, metadata);
    }
    if (resolvedFormatId === "formats.csv.swimflow") {
        return normalizeSwimflowRows(rows, metadata);
    }
    return rows;
}
