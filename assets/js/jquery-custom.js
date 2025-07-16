/**
 * @file jquery-custom.js
 * @brief 
 */

import {  load_run} from './loader.js';













let  dialogStartTime, dialogReport, form
let allFields = $("#prefixName, #finalName, #prefixNameEdition, #finalNameEdition");
export let nageurs=["ligne1","ligne2","ligne3","ligne4","ligne5","ligne6","ligne 7","ligne8"]
export let shortcut_enabled = true;// Les raccourcis sont-ils activés ? (les raccourcis doivent être désactivé pour par exemple, l'entrée de données au clavier)

$("#fiches").selectmenu();



/**
 * @brief Gestionnaire de clic pour ouvrir le dialogue de rapport de nageur
 */
$("#btn-report-swimmer").on('click', () => dialogReport.dialog("open"))



/**
 * @brief Configuration du dialogue d'édition du temps de départ
 * Dialogue modal pour modifier le temps de départ de la course
 */
dialogStartTime = $("#dialog-startTime").dialog({
    autoOpen: false,
    height: 250,
    width: 450,
    modal: true,
    buttons: {
        Ok: function () {
            dialogStartTime.dialog("close");
        }
    },

    close: function () {
        form[0].reset();
        allFields.removeClass("ui-state-error");
    }
});





















/**
 * @brief Gestionnaire de clic sur le bouton d'édition du temps de départ
 * Ouvre le dialogue permettant de modifier le temps de départ de la course
 */
$('#editStartTime').on('click', function () {
    dialogStartTime.dialog("open")
})


/**
 * @brief Gestionnaire de perte de focus sur le champ d'édition du temps de départ
 * Recharge la course avec le nouveau temps de départ modifié
 */
$('#editStartTime').on('focusout', function () {
    let selectedRun = $("#run").val()
    let temp = $("#temp").val()
    let editedStartTime = $('#editStartTime').val()
    load_run(selectedRun, temp, editedStartTime)
})


document.addEventListener("DOMContentLoaded", function () {
    const searchInput = document.getElementById("search-input");
    const nageursList = document.getElementById("searchable-select");
    const swimSwitch = document.getElementById("swim_switch");
    // Charger le fichier JSON contenant les nageurs
    if (typeof window !== "undefined" && !window.__TEST__) {
    fetch("assets/nageurs_formatted.json")
        .then(response => response.json())
        .then(data => {
            const nageurs = data.map(nageur => nageur.nom); // Extraire les noms des nageurs

            // Fonction pour remplir la liste déroulante
            function fillDropdown(options) {
                nageursList.innerHTML = ""; // Vider les options existantes
                options.forEach(option => {
                    const opt = document.createElement("option");
                    opt.value = option;
                    opt.textContent = option;
                    nageursList.appendChild(opt);
                });
            }

            // Remplir la liste avec tous les nageurs au chargement
            fillDropdown(nageurs);

            // Ajouter un gestionnaire d'événement pour filtrer les options
            searchInput.addEventListener("input", function () {
                const filter = searchInput.value.toLowerCase(); // Récupérer la saisie en minuscules
                const filteredNageurs = nageurs.filter(nageur =>
                    nageur.toLowerCase().includes(filter) // Filtrer les nageurs contenant la saisie
                );
                fillDropdown(filteredNageurs); // Mettre à jour la liste déroulante
            });
        })
        .catch(error => console.error("Erreur lors du chargement du fichier JSON :", error));
    }
    // Compléter le texte dans le champ de recherche lorsque l'utilisateur sélectionne une option
    nageursList.addEventListener("change", function () {
        const selectedValue = nageursList.value;
        if (!selectedValue) {
            console.warn("Aucune valeur sélectionnée dans la liste des nageurs.");
            return;
        }
        searchInput.value = selectedValue;
        const swimSwitchValue = swimSwitch.value; // Récupérer la valeur de swimSwitch
    const match = swimSwitchValue.match(/(\d+)/); // Extraire le numéro avec une regex

    if (match) {
        const i = parseInt(match[1], 10) - 1; // Convertir en entier et ajuster pour l'index (0-based)
        nageurs[i+1] = selectedValue; // Mettre à jour le tableau des nageurs
    } else {
        console.error("Impossible de déterminer la ligne depuis swimSwitch :", swimSwitchValue);
    }
    });
    
});

/**
 * @brief Gestionnaire pour désactiver les raccourcis lorsque le champ de recherche est en focus
 * Évite les conflits entre la saisie de texte et les raccourcis clavier de l'application
 */
document.addEventListener("DOMContentLoaded", function () {
    const searchInput = document.getElementById("search-input");

    // Désactiver les raccourcis lorsque le champ de recherche est en focus
    searchInput.addEventListener("focus", function () {
        shortcut_enabled = false; // Désactiver les raccourcis
    });

    // Réactiver les raccourcis lorsque le champ de recherche perd le focus
    searchInput.addEventListener("blur", function () {
        shortcut_enabled = true; // Réactiver les raccourcis
    });
});

/**
 * @brief Gestionnaires d'affichage pour la liste déroulante de recherche de nageurs
 * Contrôle la visibilité de la liste selon le focus et les clics extérieurs
 */
const searchInput = document.getElementById('search-input');
const selectBox = document.getElementById('searchable-select');

// Afficher le select quand on focus sur l'input
searchInput.addEventListener('focus', () => {
    selectBox.style.display = 'block';
});
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('searchable-dropdown');
    if (!dropdown.contains(e.target)) {
        selectBox.style.display = 'none';
    }
})

/**
 * @brief Gestionnaire de changement de ligne de nageur
 * Remet à zéro le champ de recherche lors du changement de ligne sélectionnée
 */
const swim_switch = document.getElementById("swim_switch");
swim_switch.addEventListener("change", function () {
    document.getElementById('search-input').value = 'Tapez pour rechercher...';
    document.getElementById("searchable-select").value = '';
});

/**
 * @brief Désactive les raccourcis clavier de l'application
 * Utilisé notamment lors de la saisie dans les champs de texte
 */
export function deactivate_shortcut (){
    shortcut_enabled=false;
}

/**
 * @brief Réactive les raccourcis clavier de l'application
 * Utilisé après la fin de saisie dans les champs de texte
 */
export function activate_shortcut (){
    shortcut_enabled=true;
}