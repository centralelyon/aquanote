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

import {base,displaySwimmers, local_bool, setGrad} from "./main.js"
let flat;

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

import { make_flat_usable,vide_last_added_data, find_end, curate_data } from "./data_handler.js";
import { getUrlVars} from "./utils.js";
import { sec_to_timestr, edit_temp_start, video_volume, temp_start, edit_vue_du_dessus } from "./refactor-script.js";
import { curate_annotate_data, getAvg } from "./data_handler.js";
import { update_cycle_rapide } from "./cycles_handler.js";
import { construct_time_entry, set_placeholder_of_time_entry } from "./side_views.js";
import { vidStart,vidDrag } from "./videoHandler.js";



window.curr_swims = curr_swims; // Pour que curr_swims soit accessible au html
window.selected_comp = selected_comp; // Pour que selected_comp soit accessible au html







/**
 * @brief init permet d'initialiser la page en chargeant les données nécessaires.
 * Elle récupère les données JSON, les vidéos des courses ainsi que les annotations déjà réalisées sur cette course.
 */
export async function init() {
  try {
    // Gérer différemment selon l'environnement
    if (isGitHubMode()) {
      // En mode GitHub, utiliser directement le fichier flat.json comme objet
      flat = await d3.json("courses_demo/flat.json");
    } else {
      // En mode local/serveur, utiliser le fichier flat.json comme tableau
      let temp = await d3.json("courses_demo/flat.json");
      flat = make_flat_usable(temp);
    }
      
      await getCompets();
      await getRuns(selected_comp);
      
      if (compets[selected_comp]) {
        processRunData(compets[selected_comp].map(run => run.name));
      } else {
        console.error("compets[selected_comp] n'existe pas! selected_comp =", selected_comp);
      }
      
      let selected_run1 = queryString["course"];
      
      // Only proceed with loading run if we have a valid run selected
      if (selected_run1) {
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
      const parts = run.split("_"); // Séparer le nom par "_"
      
      // Ajouter les éléments dans les listes correspondantes
      if (parts[3]) type_nage.add(parts[3]);
      if (parts[4]) sexe_nageurs.add(parts[4]);
      if (parts[5]) distance.add(parts[5]);
      if (parts[6]) étape_compétition.add(parts[6]);
  });
  const sortedDistance = Array.from(distance).sort((a, b) => parseInt(a) - parseInt(b));

  fillDropdown("run_part1", Array.from(type_nage));
  fillDropdown("run_part2", Array.from(sexe_nageurs));
  fillDropdown("run_part3", Array.from(sortedDistance));
  fillDropdown("run_part4", Array.from(étape_compétition));
}


/**
 * @brief charge les annotations de la course sélectionnée.
 * @param {*} comp 
 * @param {*} run 
 * @returns 
 */
export async function getDatas(comp, run) {
    datas = [];
    let c = [];

    if (window.myAPI && window.myAPI.getLocalFiles) {
        try {
            c = await window.myAPI.getLocalFiles("courses_demo", comp, run);
        } catch (e) {
            console.error("Erreur lors de la lecture locale :", e);
            c = [];
        }
    } else if (isGitHubMode()) {
        // Mode GitHub - utiliser les données statiques
        c = staticData.csvFiles[run] || [];
    } else {
        // Mode local - utilisation serveur distant 
        const url = (local_bool && !isGitHubMode()) 
            ? "http://localhost:8001/getDatas/" + comp + "/" + run
            : getDataPath() + comp + "/" + run;
        
        await $.ajax({
            type: "GET",
            url: url,
            processData: false,
            contentType: false,
            crossDomain: true,
            crossOrigin: true,
            success: function (d) {
                // Vérifier si d est un tableau, sinon essayer de le convertir
                let data = d;
                if (typeof d === 'string') {
                    try {
                        data = JSON.parse(d);
                    } catch (e) {
                        console.error("Erreur lors du parsing JSON:", e);
                        data = [];
                    }
                }
                
                if (!Array.isArray(data)) {
                    console.error("Les données reçues ne sont pas un tableau:", data);
                    data = [];
                }
                
                c = data.filter(d => d.type === "file" && d.name.includes(".csv"));
            },
            error: function(xhr, status, error) {
                console.error("getDatas: Error callback:", status, error, xhr);
                console.error("getDatas: Response text:", xhr.responseText);
            }
        });
    }

    // Remplissage du select
    let select = $("#temp");
    select.empty();

    let csvFiles = c.filter(d => d.name && d.name.includes(".csv"));
    for (let i = 0; i < csvFiles.length; i++) {
        select.append("<option value='" + csvFiles[i].name + "'>" + csvFiles[i].name + "</option>");
        datas.push(csvFiles[i].name);
    }
    select.append("<option value='new_data'>new_data</option>");
}

/**
 * @brief permet de récupérer les compétitions disponibles sur le serveur.
 */
export async function getCompets() {
    const queryString = getUrlVars();
    const competitionParam = queryString["competition"];
    
    $("#competition").empty();
    
    if (window.myAPI && window.myAPI.getLocalCompetitions) {
        // Mode Electron - utiliser les APIs locales
        try {
            // En mode Electron, on veut utiliser courses_demo comme base
            const electronBase = "courses_demo";
            let c = await window.myAPI.getLocalCompetitions(electronBase);
            
            let select = $("#competition");
            // Filtrer les compétitions qui commencent par "2"
            c = c.filter(d => d.name[0] == "2");

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
            return Promise.resolve();
        } catch (e) {
            console.error("Erreur lors de la lecture des compétitions locales :", e);
            // Initialiser compets même en cas d'erreur pour éviter des erreurs undefined
            if (selected_comp) {
                compets[selected_comp] = [];
            }
            return Promise.reject(e);
        }
    } else if (isGitHubMode()) {
        // Mode GitHub - utiliser les données statiques
        let select = $("#competition");
        let c = staticData.competitions.filter(d => d.type == "directory" && d.name[0] == "2");

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
        return Promise.resolve();
    } else {
        // Mode local avec serveur Python - utiliser AJAX
        const url = (local_bool && !isGitHubMode())
            ? "http://localhost:8001/getCompets"
            : getDataPath();
        
        return await $.ajax({
            type: 'GET',
            url: url,
            cache: false,
            async: true,
            success: function (d) {
                // Vérifier si d est un tableau, sinon essayer de le convertir
                let data = d;
                if (typeof d === 'string') {
                    try {
                        data = JSON.parse(d);
                    } catch (e) {
                        console.error("Erreur lors du parsing JSON:", e);
                        data = [];
                    }
                }
                
                if (!Array.isArray(data)) {
                    console.error("Les données reçues ne sont pas un tableau:", data);
                    data = [];
                }
                
                let select = $("#competition");
                let c = data.filter(d => d.type == "directory" && d.name[0] == "2");

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
            },
            error: function(xhr, status, error) {
                console.error("getCompets: Error callback:", status, error, xhr);
            }
        });
    }
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
    let c = [];

    if (window.myAPI && window.myAPI.getLocalFiles) {
        try {
            c = await window.myAPI.getLocalFiles("courses_demo", comp, run);
        } catch (e) {
            console.error("Erreur lors de la lecture locale :", e);
            c = [];
        }
    } else if (isGitHubMode()) {
        // Mode GitHub - pas de fichiers de qualité dans la démo
        c = [];
    } else {
        // Mode local - utilisation serveur distant
        const url = (local_bool && !isGitHubMode())
            ? "http://localhost:8001/getQuality/" + comp + "/" + run
            : getDataPath() + comp + "/" + run;
        
        await $.ajax({
            type: 'GET',
            url: url,
            cache: false,
            async: true,
            success: function (d) {
                // Vérifier si d est un tableau, sinon essayer de le convertir
                let data = d;
                if (typeof d === 'string') {
                    try {
                        data = JSON.parse(d);
                    } catch (e) {
                        console.error("Erreur lors du parsing JSON:", e);
                        data = [];
                    }
                }
                
                if (!Array.isArray(data)) {
                    console.error("Les données reçues ne sont pas un tableau:", data);
                    data = [];
                }
                
                c = data.filter(d => d.type == "file" && d.name.includes("fixeGauche"));
                if (actual_side == "droite") {
                    c = data.filter(d => d.type == "file" && d.name.includes("fixeDroite"));
                }
            },
            error: function(xhr, status, error) {
                console.error("getQuality: Error callback:", status, error, xhr);
                console.error("getQuality: Response text:", xhr.responseText);
            }
        });
    }

    // Remplissage du select
    let select = $("#quality");
    select.empty();
    select.append('<option value="">change quality</option>');

    // Filtrage côté local (pour garder le même comportement)
    if (local_bool && c.length > 0) {
        if (actual_side == "droite") {
            c = c.filter(d => d.name.includes("fixeDroite"));
        } else {
            c = c.filter(d => d.name.includes("fixeGauche"));
        }
    }

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
  
  // Initialiser compets[comp] s'il n'existe pas
  if (!compets[comp]) {
    compets[comp] = [];
  }
  
  if (!compets[comp] || compets[comp].length === 0) {
      if (window.myAPI && window.myAPI.getLocalRuns) {
    // Utilisation locale via preload (mode Electron)
    let runs = [];
    try {
        runs = await window.myAPI.getLocalRuns("courses_demo", comp);
    } catch (e) {
        console.error("Erreur lors de la lecture locale des runs :", e);
        runs = [];
    }
    let select = $("#run");
    compets[comp] = runs;
    selected_run = runs[0]?.name || "";
    select.empty();

    const type_nage = new Set();
    const sexe_nageurs = new Set();
    const distance = new Set();
    const étape_compétition = new Set();
    for (let i = 0; i < runs.length; i++) {
        if (runs[i].name === queryString["course"]) {
            selected_run = runs[i].name;
        }
        if (runs[i].name[0] !== "2") {
            continue;
        }
        let tclass = "data_missing";
        let nomAffiche = runs[i].name.replace(comp + "_", '');
        select.append("<option value='" + runs[i].name + "' class='" + tclass + "'>" + nomAffiche + "</option>");
        const parts = runs[i].name.split("_");
        if (parts[3]) type_nage.add(parts[3]);
        if (parts[4]) sexe_nageurs.add(parts[4]);
        if (parts[5]) distance.add(parts[5]);
        if (parts[6]) étape_compétition.add(parts[6]);
    }
    const sortedDistance = Array.from(distance).sort((a, b) => parseInt(a) - parseInt(b));
    fillDropdown("run_part1", Array.from(type_nage));
    fillDropdown("run_part2", Array.from(sexe_nageurs));
    fillDropdown("run_part3", Array.from(sortedDistance));
    fillDropdown("run_part4", Array.from(étape_compétition));
    getDatas(comp, selected_run);
    return runs;
} else if (isGitHubMode()) {
    // Mode GitHub - utiliser les données statiques
    let select = $("#run");
    let runs = staticData.runs[comp] || [];
    compets[comp] = runs;
    selected_run = runs[0]?.name || "";
    select.empty();

    const type_nage = new Set();
    const sexe_nageurs = new Set();
    const distance = new Set();
    const étape_compétition = new Set();
    for (let i = 0; i < runs.length; i++) {
        if (runs[i].name === queryString["course"]) {
            selected_run = runs[i].name;
        }
        if (runs[i].name[0] !== "2") {
            continue;
        }
        let tclass = "data_missing";
        let nomAffiche = runs[i].name.replace(comp + "_", '');
        select.append("<option value='" + runs[i].name + "' class='" + tclass + "'>" + nomAffiche + "</option>");
        const parts = runs[i].name.split("_");
        if (parts[3]) type_nage.add(parts[3]);
        if (parts[4]) sexe_nageurs.add(parts[4]);
        if (parts[5]) distance.add(parts[5]);
        if (parts[6]) étape_compétition.add(parts[6]);
    }
    const sortedDistance = Array.from(distance).sort((a, b) => parseInt(a) - parseInt(b));
    fillDropdown("run_part1", Array.from(type_nage));
    fillDropdown("run_part2", Array.from(sexe_nageurs));
    fillDropdown("run_part3", Array.from(sortedDistance));
    fillDropdown("run_part4", Array.from(étape_compétition));
    getDatas(comp, selected_run);
    return runs;
} else {
    // Mode local - utilisation serveur distant
    const url = (local_bool && !isGitHubMode())
        ? "http://localhost:8001/getRuns/" + comp
        : getDataPath() + comp;
    
    await $.ajax({
        type: "GET",
        url: url,
        processData: false,
        contentType: false,
        crossDomain: true,
        crossOrigin: 'anonymous',
        success: function (d) {
            // Vérifier si d est un tableau, sinon essayer de le convertir
            let data = d;
            if (typeof d === 'string') {
                try {
                    data = JSON.parse(d);
                } catch (e) {
                    console.error("Erreur lors du parsing JSON:", e);
                    data = [];
                }
            }
            
            if (!Array.isArray(data)) {
                console.error("Les données reçues ne sont pas un tableau:", data);
                data = [];
            }
            
            let select = $("#run");
            let runs = data.filter(d => d.type == "directory");
            compets[comp] = runs;
            selected_run = runs[0]?.name || "";
            select.empty();

            const type_nage = new Set();
            const sexe_nageurs = new Set();
            const distance = new Set();
            const étape_compétition = new Set();
            for (let i = 0; i < runs.length; i++) {
                if (runs[i].name === queryString["course"]) {
                    selected_run = runs[i].name;
                }
                if (runs[i].name[0] !== "2") {
                    continue;
                }
                let tclass = "data_missing";
                if ((flat[runs[i].name] && "espadon" in flat[runs[i].name])) {
                    if (flat[runs[i].name]["espadon"] || flat[runs[i].name]["espadonModifie"]) {
                        tclass = "data_unchecked";
                    }
                }
                if (flat[runs[i].name] && "data_checked" in flat[runs[i].name]) {
                    if (flat[runs[i].name]["data_checked"]) {
                        tclass = "data_checked";
                    }
                }
                let nomAffiche = runs[i].name.replace(comp + "_", '');
                select.append("<option value='" + runs[i].name + "' class='" + tclass + "'>" + nomAffiche + "</option>");
                const parts = runs[i].name.split("_");
                if (parts[3]) type_nage.add(parts[3]);
                if (parts[4]) sexe_nageurs.add(parts[4]);
                if (parts[5]) distance.add(parts[5]);
                if (parts[6]) étape_compétition.add(parts[6]);
            }
            const sortedDistance = Array.from(distance).sort((a, b) => parseInt(a) - parseInt(b));
            fillDropdown("run_part1", Array.from(type_nage));
            fillDropdown("run_part2", Array.from(sexe_nageurs));
            fillDropdown("run_part3", Array.from(sortedDistance));
            fillDropdown("run_part4", Array.from(étape_compétition));
            getDatas(comp, selected_run);
            return runs;
        },
        error: function(xhr, status, error) {
            console.error("getRuns: Error callback:", status, error, xhr);
            console.error("getRuns: Response text:", xhr.responseText);
        }
    });
}
  } else {
      const type_nage = new Set();
      const sexe_nageurs = new Set();
      const distance = new Set();
      const étape_compétition = new Set();
      let select = $("#run");
      select.empty();
      for (let i = 0; i < compets[comp].length; i++) {
          if (compets[comp][i].name === queryString["course"]) {
              selected_run = compets[comp][i].name;
          }
          select.append("<option value='" + compets[comp][i].name + "'>" + compets[comp][i].name + "</option>");
          const parts = compets[comp][i].name.split("_");
          if (parts[3]) type_nage.add(parts[3]);
          if (parts[4]) sexe_nageurs.add(parts[4]);
          if (parts[5]) distance.add(parts[5]);
          if (parts[6]) étape_compétition.add(parts[6]);
          }
        const sortedDistance = Array.from(distance).sort((a, b) => parseInt(a) - parseInt(b));
        fillDropdown("run_part1", Array.from(type_nage));
        fillDropdown("run_part2", Array.from(sexe_nageurs));
        fillDropdown("run_part3", Array.from(sortedDistance));
        fillDropdown("run_part4", Array.from(étape_compétition));
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

  // Ajouter une option par défaut
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Sélectionnez une option";
  dropdown.appendChild(defaultOption);

  // Ajouter les nouvelles options
  options.forEach(optionText => {
      const option = document.createElement("option");
      option.value = optionText;
      option.textContent = optionText;
      dropdown.appendChild(option);
  });


}
/**
 * @brief permet de récupérer le temps de départ d'une course à partir des métadonnées.
 * @param {*} meta 
 * @returns 
 */
export function get_temp_start(meta) {
  let temp_start_temp;
    if (meta.start_flash) {
        temp_start_temp = meta.start_flash
    } else if (meta.start_synchro_flash) {
        temp_start_temp = meta.start_synchro_flash
    } else {
        temp_start_temp = meta.start_moment
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
  edit_vue_du_dessus(false); // Réinitialise la vue du dessus
  const errors = []; // Liste des erreurs rencontrées

  try {
    selected_comp = $("#competition").val();

    let t;
    if (window.myAPI && window.myAPI.readJsonFile) {
      // Lecture locale du JSON
      try {
        t = await window.myAPI.readJsonFile("courses_demo", selected_comp, run, run + '.json');
      } catch (e) {
        console.error("Erreur lecture Electron:", e);
        errors.push("Fichier JSON non trouvé ou invalide : " + run + '.json');
        throw e;
      }
    } else {
      // Lecture distante du JSON
      const jsonUrl = (local_bool && !isGitHubMode()) 
        ? "http://localhost:8001/files/" + selected_comp + "/" + run + "/" + run + '.json'
        : getDataPath() + selected_comp + "/" + run + "/" + run + '.json';
      
      try {
        t = await d3.json(jsonUrl, d3.autoType);
      } catch (e) {
        console.error("Erreur lors du chargement du fichier JSON:", e);
        console.error("URL tentée:", jsonUrl);
        errors.push("Fichier JSON non trouvé ou invalide : " + run + '.json');
        throw e;
      }
    }
    let meta = null;
    vidName = "";
    $("#vidsw").show();
    n_camera = 2; // Valeur par défaut, peut être modifiée par le JSON
    if (t.ncamera){
      n_camera = t.ncamera;
      if (n_camera === 1) {
          $("#vidsw").hide();
      }
    }
    try {
      if (t.videos && t.videos.length > 0) {
        if (n_camera > 1) {
          meta = t.videos.find(d => d.name.includes("fixeDroite"));
          vidName = run + "_fixeDroite.mp4";

          if (meta && meta["start_side"] === "left") {
            meta = t.videos.find(d => d.name.includes("fixeGauche"));
            vidName = run + "_fixeGauche.mp4";
          }}
        else if (n_camera === 1) {
          meta = t.videos[0];
          vidName = meta.name;
        }

        if (!meta) {
          errors.push("Vidéo 'fixeDroite' ou 'fixeGauche' introuvable.");
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
    frame_rate = (meta && !isNaN(parseInt(meta.fps))) ? parseInt(meta.fps) : 50;
    
    if (data !== "new_data" && data && data.trim() !== "") {
      let r = [];
      if (window.myAPI && window.myAPI.readCsvFile) {
        try {
          r = await window.myAPI.readCsvFile("courses_demo", selected_comp, run, data);
          if (!Array.isArray(r)) r = [];
          if (r.length > 0 && r[0]['startTimeEdit'] != null && starTime == null) {
            edit_temp_start(r[0]['startTimeEdit']);
          } else {
            edit_temp_start(starTime == null ? get_temp_start(meta) : parseFloat((starTime.toString()).split(':')[1]));
          }
        } catch (e) {
          errors.push("Fichier CSV '" + data + "' introuvable ou invalide.");
          edit_temp_start(get_temp_start(meta));
        }
      } else {
        try {
          const csvUrl = (local_bool && !isGitHubMode())
            ? "http://localhost:8001/files/" + selected_comp + "/" + run + "/" + data
            : getDataPath() + selected_comp + "/" + run + "/" + data;
          // Utilise d3.csv si disponible, sinon fallback fetchAndParseCsv
          if (typeof d3 !== "undefined" && d3.csv) {
            r = await d3.csv(csvUrl, d3.autoType);
          } else {
            r = await fetchAndParseCsv(csvUrl);
          }
          if (!Array.isArray(r)) r = [];
          if (r.length > 0 && r[0]['startTimeEdit'] != null && starTime == null) {
            edit_temp_start(r[0]['startTimeEdit']);
          } else {
            edit_temp_start(starTime == null ? get_temp_start(meta) : parseFloat((starTime.toString()).split(':')[1]));
          }
        } catch (e) {
          errors.push("Fichier CSV '" + data + "' introuvable ou invalide.");
          edit_temp_start(get_temp_start(meta));
        }
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
        const csvUrl = (local_bool && !isGitHubMode())
          ? "http://localhost:8001/files/" + selected_comp + "/" + run + "/" + data
          : getDataPath() + selected_comp + "/" + run + "/" + data;
        let r = await d3.csv(csvUrl, d3.autoType);
        megaData = [t, r];
        let maxFrame = Math.max(...megaData[1].map(d => d.frame_number));
  
        let temp = getAvg(megaData[0]);
  
        if (temp) {
          temp_end = temp;
        } else {
          find_end(megaData[1], parseInt(megaData[0]["distance"]));
        }
        
        inter = parseInt(maxFrame / ncycle);
  
        for (let i = 0; i < 8; i++) {
          curr_swims[i] = curate_data(megaData[1].filter(d => d.swimmer == i) + 1, t);
        }
      } else if (data === "new_data" || !data || !datas.includes(data)) {
        megaData = [t, []];
        for (let i = 0; i < 8; i++) {
          curr_swims[i] = [];
        }
      } else {
        megaData = [t, []];
        let time_dif;
        const csvUrl = (local_bool && !isGitHubMode())
          ? "http://localhost:8001/files/" + selected_comp + "/" + run + "/" + data
          : getDataPath() + selected_comp + "/" + run + "/" + data;
        let r = await fetchAndParseCsv(csvUrl);
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
  
        for (let i = 0; i < 8; i++) {
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
      for (let i = 0; i < 8; i++) {
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
      $("#swim_switch").html("");
      displaySwimmers(t["lignes"]);
      
      if (n_camera > 1) {
      if (meta && meta["start_side"] === "right") {
        if (window.myAPI) {
          $("#vid").attr("src", "courses_demo/" + selected_comp + "/" + run + "/" + run + '_fixeDroite.mp4');
        } else if (local_bool) {
          $("#vid").attr("src", "http://localhost:8001/files/" + selected_comp + "/" + run + "/" + run + '_fixeDroite.mp4');
        } else {
          $("#vid").attr("src", getDataPath() + selected_comp + "/" + run + "/" + run + '_fixeDroite.mp4');
        }
      } else {
        if (window.myAPI) {
          $("#vid").attr("src", "courses_demo/" + selected_comp + "/" + run + "/" + run + '_fixeGauche.mp4');
        } else if (local_bool) {
          $("#vid").attr("src", "http://localhost:8001/files/" + selected_comp + "/" + run + "/" + run + '_fixeGauche.mp4');
        } else {
          $("#vid").attr("src", getDataPath() + selected_comp + "/" + run + "/" + run + '_fixeGauche.mp4');
        }
      }}
      else{
        if (window.myAPI) {
          $("#vid").attr("src", "courses_demo/" + selected_comp + "/" + run + "/" + meta.name);
        } else if (local_bool) {
          $("#vid").attr("src", "http://localhost:8001/files/" + selected_comp + "/" + run + "/" + meta.name);
        } else {
          $("#vid").attr("src", getDataPath() + selected_comp + "/" + run + "/" + meta.name);
        }
      }
      vide_last_added_data();
      update_cycle_rapide();
      construct_time_entry();
      set_placeholder_of_time_entry();
      d3.selectAll("#video").call(d3.drag().on("start", vidStart).on("drag", vidDrag));
      document.getElementById("vid").currentTime = temp_start;
      document.getElementById('vid').volume = video_volume;
      setGrad(temp_start);
    
  } catch (e) {
    console.error("Erreur principale :", e);
    if (errors.length > 0) {
      alert("Erreurs détectées pendant le chargement :\n\n" + errors.join("\n"));
    }
  }
  
  let is_dessus=megaData[0].videos.filter(d => d.name.includes("dessus"));
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
 * @brief Retourne le chemin vers les données selon l'environnement (local, GitHub ou Electron)
 * @returns {string} Le chemin vers les données
 */
function getDataPath() {
    // Détection de l'environnement
    const isElectron = window.myAPI !== undefined;
    const isGitHub = !isElectron && (
        window.location.hostname.includes('github.io') || 
        window.location.hostname.includes('githubusercontent.com') ||
        window.location.pathname.includes('/annotation/')
    );
    
    if (isGitHub) {
        // En production sur GitHub, utiliser courses_demo
        return "courses_demo/";
    } else {
        // En développement local ou Electron, utiliser base
        return base;
    }
}

/**
 * @brief Vérifie si on est en mode GitHub (sans serveur backend)
 * @returns {boolean} true si on est sur GitHub, false sinon
 */
function isGitHubMode() {
    const isElectron = window.myAPI !== undefined;
    return !isElectron && (
        window.location.hostname.includes('github.io') || 
        window.location.hostname.includes('githubusercontent.com') ||
        window.location.pathname.includes('/annotation/')
    );
}

/**
 * @brief Données statiques pour le mode GitHub
 * Remplace les appels AJAX quand on ne peut pas lister les dossiers
 */
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
        "2025_courses_demo_translation_carre_100_demifinale": [],
        "2025_courses_demo_translation_carre_50_finale": [],
        "2025_courses_demo_translation_carre_50_serie": []
    }
};

// Fonction utilitaire pour parser un CSV en JS (compatible CSP stricte)
async function fetchAndParseCsv(url) {
    const response = await fetch(url);
    const text = await response.text();
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


