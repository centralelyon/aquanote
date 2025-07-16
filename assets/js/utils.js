/**
 * @file utils.js
 * @brief gère principalement l'url et donne la taille de la vidéo???
 */

import { megaData, selected_comp, n_camera } from './loader.js';
import { get_run_selected,  selected_data, vue_du_dessus } from './refactor-script.js';

/**
 * @brief Récupère les métadonnées de la caméra active
 * Détermine quelle caméra (droite/gauche) est actuellement affichée et retourne ses métadonnées
 * 
 * @return {object} Métadonnées de la caméra active (calibration, dimensions, etc.)
 */
export function getMeta() {
    let vid = document.getElementById("vid");
    if (vue_du_dessus) {
        return megaData[0].videos.filter(d => d.name.includes("dessus"))[0];
    }
    if (n_camera > 1) {
        let side = vid.getAttribute("src").includes("fixeDroite") ;
        return megaData[0].videos.filter(d => (side ? d.name.includes("fixeDroite") : d.name.includes("fixeGauche")))[0];
    }
    else {
        return megaData[0].videos[0];
    }
}

/**
 * Cette fonction renvoie les dimensions de la vidéo.
 * @param {array} meta 
 * @returns {[twidth, theight]} - Dimensions de la vidéo.
 */
export function getSize(meta) {
    let twidth = 2704;
    let theight = 1520;
    if (meta.width && meta.height) {
        twidth = meta.width;
        theight = meta.height;
    } else {
        let teMax = Math.max(...meta.srcPts.flat());
        if (teMax > 2704) {
            twidth = 4096;
            theight = 2160;
        }
    }

    return [twidth, theight];
}

/**
 * @brief Met à jour l'URL du navigateur avec les paramètres de sélection actuels
 * Ajoute ou modifie les paramètres d'URL pour la compétition, course et données sélectionnées
 * Permet le partage d'état via URL et la navigation dans l'historique
 */
export function update_url() {
    let mess = "?competition=" + selected_comp;

    if (get_run_selected() !== '') {
        mess += "&course=" + get_run_selected();
    }

    if (selected_data !== '') {
        mess += "&data=" + selected_data;
    }
    history.pushState({}, null, mess);
}

/**
 * @brief Génère un identifiant unique basé sur l'horodatage et un nombre aléatoire
 * Crée un UID court et lisible pour identifier des éléments de façon unique
 * 
 * @return {string} Identifiant unique en base 36
 */
export function uid() {
    return (Date.now().toString(36) + Math.random().toString(36)).replace(/\./g, "");
}

/**
 * @brief Parse les paramètres GET de l'URL actuelle
 * Extrait tous les paramètres de requête de l'URL et les retourne sous forme d'objet
 * 
 * @return {object} Objet contenant tous les paramètres d'URL (clé: valeur)
 */
export function getUrlVars() {
    let vars = {};
    window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function (m, key, value) {
        vars[key] = value;
    });
    return vars;
}
