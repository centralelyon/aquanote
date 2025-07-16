/**
 * @file refractor-script.js
 * @brief ce fichier fait le lien entre les éléments html et leurs fonctions, c'est ici quelles sont attribuées.
 */

import { choose_tab,construct_modify_selected_annotation_table, add_element_to_data,vide_last_added_data, last_added_data, currate_events, construct_last_added_data_table } from './data_handler.js';
import { meters_checkpoints,megaData,curr_swims, frame_rate, compets, getDatas, selected_comp, load_run, turn_distances, selected_run, edit_vidName, vidName, getRuns, get_quality, get_temp_start, pool_size, n_camera } from './loader.js';
import { draw_stats, set_placeholder_of_time_entry, update_swimmer } from './side_views.js';
import { updateTable, setGrad,frameId_to_RunTime, base, metrics_calculation } from './main.js';
import { activate_shortcut,deactivate_shortcut, nageurs } from './jquery-custom.js';
import { getPointInverted,getPoolBar, eucDistance, get_orr } from './homography_handler.js';
import { getMeta, getSize,update_url } from './utils.js';
import { get_last_checkpoint, get_meter_plot_label,highlightCycle, mode_color, edit_lab_flipper,lab_flipper, resetHigh, update_cycle_rapide, updateBarsFromEvent } from './cycles_handler.js';
import { indicator_correction, show_indicator_lines, plot_indicator_lines, hide_indicator_lines,action_indicator_lines } from './plot_handler.js';
import { positionCurseur,edit_positionCurseur } from './shortcuts_handler.js'
import { vidReset } from './videoHandler.js';


export let video_volume = 0;
export let selected_swim =3;
export let selected_num = 0;// Numéro du cycle séléctionné
export let vue_du_dessus = false; // Boolean correspondant à : est-ce qu'on a séléctionné la vue du dessus ?
let actual_side;//indique quelle est la vidéo actuellement affichée (droite ou gauche)
let min = 0;
let sec;
let ms = 0;
let video_speed = 1;
let tempval = "";// Valeur temporaire utilisée pour la selection du jeux de donnée "data"
let play_bool = false;// play/pause de la vidéo
export let last_checkpoint = 0;
var vid = document.getElementById("vid");
export const zoom_step = 5;// Quand on zoom : scaleZoom += (step / 100)
export let selected_data = ''// nom du fichier csv chargé en donnée (ex :2021_GT_Nice_brasse_50_finaleA_dames_Espadon.csv)
export let selected_cycle; // int, numéro du cycle séléctionné
export let temp_start = 0; //instant de la vidéo oùla course démarre.
export let displayMode = "0" // Mode d'affichage des annotations : 0 -> all, 1 -> swimmer séléctionné, 2 -> dernière annotation, 3 -> rien
export let scaleZoom = 1// Correspond au zoom dans la vidéo
export let mode = "cycle"// Modifié dans les boutons de classe modebtn (enter : fin de vol, end : fin de coulée, cycle : cycle, section : temps intermédiaire, respi : respirations, turn : demi-tour, finish : fin)
export let flipper = false;// Boolean correspondant à : est-ce qu'on a séléctionné une annotation ?
const codeNaNforDownload = "";// Lors du téléchargement des données, si une donnée est NaN, elle sera remplacé par codeNaNforDownload
//choose_right_plot({"checked":false});
choose_tab(null,"data_entry",'side_tab_content','sideTabLinks')
construct_modify_selected_annotation_table(true)

    document.querySelectorAll(".__range-step").forEach(function (ctrl) {
        let el = ctrl.querySelector('input');
        let output = ctrl.querySelector('output');

        el.oninput = function () {
            // colorize step options
            ctrl.querySelectorAll("option").forEach(function (opt) {
                if (opt.value <= el.valueAsNumber)
                    opt.style.backgroundColor = '#232157';
                else
                    opt.style.backgroundColor = '#aaa';
            });
            // colorize before and after
            let valPercent = (el.valueAsNumber - parseInt(el.min)) / (parseInt(el.max) - parseInt(el.min));
            let style = 'background-image: -webkit-gradient(linear, 0% 0%, 100% 0%, color-stop(' +
                valPercent + ', #232157), color-stop(' +
                valPercent + ', #aaa));width:160px';
            el.style = style;

            // Popup
            if ((' ' + ctrl.className + ' ').indexOf(' ' + '__range-step-popup' + ' ') > -1) {
                let selectedOpt = ctrl.querySelector('option[value="' + el.value + '"]');
                output.innerText = selectedOpt.text;
                output.style.left = "50%";
                output.style.left = ((selectedOpt.offsetLeft + selectedOpt.offsetWidth / 2) - output.offsetWidth / 2) + 'px';
            }
        };
        el.oninput();
    });


    $("#temp").on("focus", function () {
        deactivate_shortcut();
        let elem = $("#temp")
        tempval = elem.val()
    })

    $("#temp").on("focusout", function () {
        activate_shortcut();
        let elem = $("#temp")
        let t = elem.val()
        if (t == "") {
            elem.val(tempval)
        }
        tempval = ""
    })

    $("#kmod").on("input", function () {
        displayMode = $(this).val();
        updateBarsFromEvent(selected_swim, true);
    })


    $("#hidlab").on("click", function () {
        edit_lab_flipper(!lab_flipper);
        updateBarsFromEvent(selected_swim, true);
        if (lab_flipper) {
            $(this).html("Cacher texte")
        } else {
            $(this).html("Afficher texte")
        }
    })

    $(".modebtn").on("click", function () {

        $(".selected").toggleClass("selected")
        let elem = $(this)

        let name = elem.attr("name")

        elem.toggleClass("selected")

        mode = name
    })

    $("#play").on("click", () => {

        
        play_bool = !play_bool;
        if (play_bool) {
            vid.play();
            $("#play").attr("src", "assets/images/controls/pause-sign.svg");
        } else {
            $("#play").attr("src", "assets/images/controls/play-sign.svg");
            vid.pause();
        }
    });

    

    $("#quality").on("change",() =>{
        edit_vidName( $('#quality').val());
        let vid = document.getElementById("vid")
        let metaDroite = megaData[0].videos.filter(d => d.name.includes("fixeDroite")) [0]
        let metaGauche = megaData[0].videos.filter(d => d.name.includes("fixeGauche")) [0]

        let right_attr = "start_flash"
        let left_attr = "start_synchro_flash"
        if (metaDroite["start_side"] === "left") {
            right_attr = "start_synchro_flash"
            left_attr = "start_flash"
        }

        if (vid.getAttribute("src").includes("fixeDroite")) {

            let t = vid.currentTime - metaDroite[right_attr] + metaGauche[left_attr]
            vid.setAttribute("src", base+ selected_comp + "/" + selected_run + "/" + vidName+ '#t=' + t)
            setGrad(t)
        } else {
            let t = vid.currentTime - metaDroite[right_attr] + metaGauche[left_attr]
            vid.setAttribute("src", base+ selected_comp + "/" + selected_run + "/" + vidName+ '#t=' + t)
            setGrad(t)
        }
        updateBarsFromEvent(selected_swim, true);
        if (flipper)
            highlightCycle(selected_swim, selected_cycle)

        // On doit réafficher les lignes indicatrices si elle était déjà affiché :
        if(show_indicator_lines){
            // On supprimer les anciennes
            plot_indicator_lines(false)
            // On réaffiche les lignes indicatrices
            plot_indicator_lines(true)
        }
    })
    $("#vidsw").on("click", () => {
        if (n_camera > 1) {
            let vid = document.getElementById("vid")
            let metaDroite = megaData[0].videos.filter(d => d.name.includes("fixeDroite")) [0]
            let metaGauche = megaData[0].videos.filter(d => d.name.includes("fixeGauche")) [0]

            let right_attr = "start_flash"
            let left_attr = "start_synchro_flash"
            if (metaDroite["start_side"] === "left") {
                right_attr = "start_synchro_flash"
                left_attr = "start_flash"
            }
            if (vid.getAttribute("src").includes("fixeDroite")) {
                let t = vid.currentTime + metaDroite[right_attr] - metaGauche[left_attr]
                vid.setAttribute("src", base+ selected_comp + "/" + selected_run + "/" + vidName.replace("fixeDroite","fixeGauche")+ '#t=' + t)
                setGrad(t)
            } else {
                let t = vid.currentTime - metaDroite[right_attr] + metaGauche[left_attr]
                vid.setAttribute("src", base+ selected_comp + "/" + selected_run + "/" + vidName.replace("fixeGauche","fixeDroite")+ '#t=' + t)
                setGrad(t)
            }
            updateBarsFromEvent(selected_swim, true); //
            if (flipper)
                highlightCycle(selected_swim, selected_cycle)

            // On doit réafficher les lignes indicatrices si elle était déjà affiché :
            if(show_indicator_lines){
                plot_indicator_lines(false)
                plot_indicator_lines(true)
            }
            document.getElementById('vid').playbackRate = video_speed;
            document.getElementById('vid').volume = video_volume;
            vidReset();
        }
    })
    $("#vid_dessus").on("click", () => {
        let vid = document.getElementById("vid")
        if (vid.getAttribute("src").includes("dessus")) {
                let t = 0
                vid.setAttribute("src", base+ selected_comp + "/" + selected_run + "/" + vidName.replace("dessus","fixeGauche")+ '#t=' + t)
                setGrad(t)
                vue_du_dessus = false;
            } else {
                let t = 0
                let vidName2 = selected_run+"_dessus.mp4"
                vid.setAttribute("src", base+ selected_comp + "/" + selected_run + "/" + vidName2+ '#t=' + t);
                setGrad(t)
                vue_du_dessus = true;
            }
        updateBarsFromEvent(selected_swim, true); //
            if (flipper)
                highlightCycle(selected_swim, selected_cycle)

            // On doit réafficher les lignes indicatrices si elle était déjà affiché :
            if(show_indicator_lines){
                plot_indicator_lines(false)
                plot_indicator_lines(true)
            }
            document.getElementById('vid').playbackRate = video_speed;
            document.getElementById('vid').volume = video_volume;
            vidReset();
    })

    $("#quality").on("click",() =>{
        if (vid.getAttribute("src").includes("fixeDroite")) {
            actual_side = "droite"
        }
        if (vid.getAttribute("src").includes("fixeGauche")) {
            actual_side = "gauche"
        }
        get_quality(selected_comp, selected_run,actual_side)
    })

    $("#next-chk").on("click", () => {
        
        let vid = document.getElementById("vid");
        vid.currentTime += 1    
    })

    $("#next-frame").on("click", () => {

        var vid = document.getElementById("vid");
        vid.currentTime += 1/frame_rate
    })

    $("#prev-frame").on("click", () => {

        var vid = document.getElementById("vid");
        vid.currentTime -= 1/frame_rate
    })

    $("#prev-chck").on("click", () => {

        var vid = document.getElementById("vid");
        vid.currentTime -= 1;
    })

    $("#competition").on("change", function () {
        let val = $(this).val()
        getRuns(val)

    })

    $("#run").on("input", function () {

        let val = $(this).val()
        getDatas($("#competition").val(), val)
    })

    $("#loadbtn").on("click", function () {
        const selected_comp = $("#competition").val();
        if (!compets[selected_comp].some(run => run.name === get_run_selected())) {
            alert(`L'épreuve "${get_run_selected()}" n'existe pas.`);
            return;
        }
        $(".crop_can").remove();
        $(".swname_pool").remove();
    
        const temp = $("#temp").val();
        selected_data = (temp === "new_data" ? '' : temp);
        load_run(get_run_selected(), selected_data);
        update_url();
    });
    $("#run_part1").on("change", function () {
        const selectedTypeNage = $(this).val(); // Récupérer la valeur sélectionnée dans run_part1
        const selectedComp = $("#competition").val(); // Récupérer la compétition sélectionnée
    
        // Vérifier si une compétition est sélectionnée
        if (!selectedComp || !compets[selectedComp]) {
            console.error("Aucune compétition valide sélectionnée.");
            return;
        }
    
        // Filtrer les options pour run_part2
        const filteredSexeNageurs = compets[selectedComp]
            .filter(run => run.name.includes(selectedTypeNage)) // Filtrer par type de nage
            .map(run => run.name.split("_")[4]) // Extraire le sexe
            .filter((value, index, self) => value && self.indexOf(value) === index); // Supprimer les doublons
    
        fillDropdown("run_part2", filteredSexeNageurs);
    
        // Vider les menus suivants
        let filteredDistances = compets[selectedComp]
            .filter(run => run.name.includes(selectedTypeNage)) // Filtrer par type de nage et sexe
            .map(run => run.name.split("_")[5]) // Extraire la distance
            .filter((value, index, self) => value && self.indexOf(value) === index); // Supprimer les doublons
        filteredDistances = Array.from(filteredDistances).sort((a, b) => parseInt(a) - parseInt(b));
        fillDropdown("run_part3", filteredDistances);
        const filteredEtapes = compets[selectedComp]
            .filter(run => run.name.includes(selectedTypeNage)) // Filtrer par type de nage, sexe et distance
            .map(run => run.name.split("_")[6]) // Extraire l'étape
            .filter((value, index, self) => value && self.indexOf(value) === index); // Supprimer les doublons
        
        fillDropdown("run_part4", filteredEtapes);
    });
    
    $("#run_part2").on("change", function () {
        const selectedTypeNage = $("#run_part1").val();
        const selectedSexeNageur = $(this).val();
        const selectedComp = $("#competition").val();
    
        if (!selectedComp || !compets[selectedComp]) {
            console.error("Aucune compétition valide sélectionnée.");
            return;
        }
    
        // Filtrer les options pour run_part3
        let filteredDistances = compets[selectedComp]
            .filter(run => run.name.includes(selectedTypeNage) && run.name.includes(selectedSexeNageur)) // Filtrer par type de nage et sexe
            .map(run => run.name.split("_")[5]) // Extraire la distance
            .filter((value, index, self) => value && self.indexOf(value) === index); // Supprimer les doublons
        filteredDistances = Array.from(filteredDistances).sort((a, b) => parseInt(a) - parseInt(b));
        fillDropdown("run_part3", filteredDistances);
    
        // Vider les menus suivants
        const filteredEtapes = compets[selectedComp]
            .filter(run => run.name.includes(selectedTypeNage) && run.name.includes(selectedSexeNageur)) // Filtrer par type de nage, sexe et distance
            .map(run => run.name.split("_")[6]) // Extraire l'étape
            .filter((value, index, self) => value && self.indexOf(value) === index); // Supprimer les doublons
    
        fillDropdown("run_part4", filteredEtapes);
    });
    
    $("#run_part3").on("change", function () {
        const selectedTypeNage = $("#run_part1").val();
        const selectedSexeNageur = $("#run_part2").val();
        const selectedDistance = $(this).val();
        const selectedComp = $("#competition").val();
    
        if (!selectedComp || !compets[selectedComp]) {
            console.error("Aucune compétition valide sélectionnée.");
            return;
        }
    
        // Filtrer les options pour run_part4
        const filteredEtapes = compets[selectedComp]
            .filter(run => run.name.includes(selectedTypeNage) && run.name.includes(selectedSexeNageur) && run.name.includes(selectedDistance)) // Filtrer par type de nage, sexe et distance
            .map(run => run.name.split("_")[6]) // Extraire l'étape
            .filter((value, index, self) => value && self.indexOf(value) === index); // Supprimer les doublons
    
        fillDropdown("run_part4", filteredEtapes);
    });
    $("#run_part4").on("change", function () {
        const part1 = $("#run_part1").val();
        const part2 = $("#run_part2").val();
        const part3 = $("#run_part3").val();

        // Vérifier si les trois champs ont des valeurs sélectionnées
        if (part1 && part2 && part3) {
            getDatas($("#competition").val(), get_run_selected());
        }
    });
    
    function fillDropdown(dropdownId, options) {
        const dropdown = $(`#${dropdownId}`);
        dropdown.empty(); // Vider les options existantes
    
        // Ajouter une option par défaut
        dropdown.append('<option value="">Sélectionnez une option</option>');
    
        // Ajouter les nouvelles options
        options.forEach(option => {
            dropdown.append(`<option value="${option}">${option}</option>`);
        });
        if (options.length === 1) {
            dropdown.val(options[0]).trigger('change');
        }
    }

    /**
     * Method used to generate the report related to the current run
     */
    export function generateRunReport(){
        let url = `${base}${selected_comp}/${selected_run}/${$("#temp").val()}`
        // let lien = window.location.href.match(/[0-9]+_[^&]+/g)
        let lien = "https://observablehq.com/d/9dbe52f370657ce8?s="+url
        window.open(lien,'_blank')
    }
    window.generateRunReport = generateRunReport;
    $("#pathToReport").on("click",function() {
        let url = `${base}${selected_comp}/${selected_run}/${$("#temp").val()}`
        // let lien = window.location.href.match(/[0-9]+_[^&]+/g)
        let lien = "https://observablehq.com/d/9dbe52f370657ce8?s="+url
        window.open(lien,'_blank')
    })


    $("body").on("click", ".cycleDots", function () {
        let elem = $(this)
        let id = elem.attr("num")
        selected_cycle = id
        highlightCycle(selected_swim, selected_cycle)
    })

    $("body").on("click", "rect", function () {

        let elem = $(this)

        let id = elem.attr("num")
        selected_cycle = id
        selected_swim = parseInt(elem.attr("swim"))
        updateSwimSwitch()

        highlightCycle(selected_swim, selected_cycle)

    })

    $("#volume_range").on("input",function(){
        let elem = $("#volume_range")
        let val = parseFloat(elem.val())
        let val2 = val + 0.0001

        video_volume = val
        document.getElementById('vid').volume = video_volume

        let volume_plot = "🔊"
        if(val <= 0.0001){
            volume_plot = "🔇";
        }else if(val < 1/3.0){
            volume_plot = "🔈";
        }else if(val < 2/3.0){
            volume_plot = "🔉";
        }

        $("#volume").html(volume_plot)

        elem.css('background',
            'linear-gradient(to right,'
            + 'rgba(35, 33, 87, 1) 0%, '
            + 'rgba(35, 33, 87, 1) ' + (val * 100) + '%, '
            + '#FFF ' + (val2 * 100) + '%, '
            + '#FFF 100%) '
        )
    });

    $("#poolop").on("input", function () {
        let elem = $("#poolop")
        let val = parseFloat(elem.val())
        let val2 = val + 0.0001

        video_speed = val;
        document.getElementById('vid').playbackRate = video_speed;
       
        $("#speed").html("x" + val)

        elem.css('background',
            'linear-gradient(to right,'
            + 'rgba(35, 33, 87, 1) 0%, '
            + 'rgba(35, 33, 87, 1) ' + (val * 100) + '%, '
            + '#FFF ' + (val2 * 100) + '%, '
            + '#FFF 100%) '
        )
    })

    $("#cyclebar").on("mouseover", "rect", function () {

        let elem = d3.select(this);
        highlightCycle(elem.attr("swim"), elem.attr("num"))
    })

    $("#cyclebar").on("mouseout", "rect", function () {
        resetHigh()
    })

    $("#cycle_stats").on("mouseover", "rect", function () {

        let elem = d3.select(this);
        highlightCycle(selected_swim, elem.attr("num"))
    })

    $("#cycle_stats").on("mouseout", "rect", function () {
        resetHigh()
    })

    $("#stats").on("mouseover", "circle", function () {

        let elem = d3.select(this);
        highlightCycle(selected_swim, elem.attr("num"))
    })

    $("#stats").on("mouseout", "circle", function () {
        resetHigh()
    })

    $("body").on("input", "#swim_switch", function () {

        selected_swim = parseInt($(this).val()) // I guess this is inverted -> TODO: one is up is true?
        update_swimmer(selected_swim)
        updateTable();
        $(".crop_can").remove()
        $(".div_can").remove()
        updateBarsFromEvent(selected_swim, true);
        set_placeholder_of_time_entry();
    })

    $("#video").on("click", ".crop_can", function () {
        var vid = document.getElementById("vid");

        let elem = d3.select(this);
        flipper = true;
        vid.style.cursor = "pointer"
        selected_swim = parseInt(elem.attr("swim"))
        //updateSwimSwitch()
        selected_num = elem.attr("num")
        let data=curr_swims[selected_swim].filter(d=>d.event!=="reaction");
        selected_cycle = parseInt(selected_num)

        vid.currentTime = temp_start + data[selected_cycle].frame_number / frame_rate;
        update_swimmer(selected_swim)
        highlightCycle(elem.attr("swim"), elem.attr("num"))
        construct_modify_selected_annotation_table(false)
    })
    $("#video").on("click", async function (e) {clic_souris_video(e)})
    //TODO: REPLACE FOR CLICK
export function clic_souris_video(e) {
    var vid = document.getElementById("vid");
    if (e.target == vid) {
        //let vid = document.getElementById("vid");

        let meta = getMeta();
        if (flipper) {
            resetHigh()
            flipper = false;
            construct_modify_selected_annotation_table(true)
            vid.style.cursor = "crosshair";
            updateBarsFromEvent(selected_swim, true);
        } else {
            var bounds = e.target.getBoundingClientRect();
            let x = e.clientX - bounds.left;
            let y = e.clientY - bounds.top;
            
            x = x - vid.style["left"]
            y = y - vid.style["top"]

            let pt = getPointInverted([(x / scaleZoom) / vid.offsetWidth, (y / scaleZoom) / vid.offsetHeight], meta) //todo:get Offset stuff
            
            let trx_scale = d3.scaleLinear([0, 960], [pool_size[0], 0]);
            let meters_plot_label = (show_indicator_lines ? indicator_correction(trx_scale(pt[0])):trx_scale(pt[0]));
            if (meters_plot_label < 0 || meters_plot_label > pool_size[0] || isNaN(meters_plot_label) || isNaN(pt[1])) {
                return;
            }
            let yPosition = selected_swim*2
            if (meta.one_is_up == false) {
                yPosition = (7 - selected_swim)*2
            }
            annotate(meters_plot_label,yPosition,selected_swim);
        }
        let tid = curr_swims[selected_swim].findIndex(d => d.frame_number == parseInt(vid.currentTime * frame_rate) - parseInt(temp_start * frame_rate),) // = currate_events(curr_swims[selected_swim])
        selected_cycle = tid

        highlightCycle(selected_cycle)

        //TODO: select current cycle in the re-order
        
        updateTable()
        
    }
}

    export function annotate(xPosition,yPosition,id_swim){

        var vid = document.getElementById("vid");
        if (parseInt((vid.currentTime - temp_start) * frame_rate) > 0) {

            let mode_annotation = mode
            let cumul_annotation = get_meter_plot_label(xPosition)

            if(mode_annotation == "section"){
                if(xPosition == 0 || xPosition == pool_size[0]){
                    mode_annotation = "turn"
                }
                if(cumul_annotation == turn_distances[turn_distances.length-1]){
                    mode_annotation = "finish"
                }
                if(cumul_annotation == 0){
                    mode_annotation = mode
                }
            }
            add_element_to_data({
                "frame_number": (parseInt(vid.currentTime * frame_rate) - parseInt(temp_start * frame_rate)),
                "frameId": (parseInt(vid.currentTime * frame_rate) - parseInt(temp_start * frame_rate)),
                "x": xPosition,
                "y": yPosition,
                "swimmer": id_swim,
                "mode": mode_annotation,
                "cumul": cumul_annotation
            },id_swim)
            update_cycle_rapide()
        } else {
            if (temp_start) {
                alert("Annotation should start when the run begins !")
            } else {
                //TODO: Annotate_start moment
            }
        }
        
    }

    $("#vid").on("timeupdate", function () {
        let elem = $("#timebar");
        let vid = document.getElementById("vid");

        let tdat = megaData[1].filter(d => d.frame_number === parseInt((vid.currentTime - temp_start) * frame_rate))

        if (tdat.length > 0) {

            let avg = tdat.map(d => d.x).reduce((a, b) => (a + b)) / tdat.length

            if (avg > (pool_size[0] / 2) - 3 && !vid.getAttribute("src").includes("fixeGauche")) { //TODO: Adapt to start side

                let metaLeft = megaData[0].videos.filter(d => d.name.includes("fixeGauche"))[0]
                temp_start = get_temp_start(metaLeft);


                vid.setAttribute("src", base + "/" + selected_comp + "/" + selected_run + "/" + metaLeft.name)
                vid.currentTime = temp_start + tdat[0].frame_number / frame_rate;
                selected_num = curr_swims[selected_swim].length - 1;

                if (play_bool) vid.play()

                updateBarsFromEvent(selected_swim, true);

            } else if (avg < (pool_size[0] / 2) - 3 && !vid.getAttribute("src").includes("fixeDroite")) { //TODO: Adapt to start side

                let metaRight = megaData[0].videos.filter(d => d.name.includes("fixeDroite"))[0];
                temp_start = get_temp_start(metaRight);

                vid.setAttribute("src", base + "/" + selected_comp + "/" + selected_run + "/" + metaRight.name)
                vid.currentTime = temp_start + tdat[0].frame_number / frame_rate;
                selected_num = 0
                updateBarsFromEvent(selected_swim, true);
            }
        }

        let tval = (vid.currentTime / vid.duration) * 100;
        if (!isNaN(tval)) {
            elem.val(tval)
            setGrad((tval / 100))
        } else {
            setGrad(0)
        }
        let memo = last_checkpoint
        last_checkpoint = (get_last_checkpoint(meters_checkpoints, parseInt((vid.currentTime - temp_start)*frame_rate)))
        if( memo != last_checkpoint){
            if(show_indicator_lines){
                // On supprimer les anciennes
                plot_indicator_lines(false)
                // On réaffiche les lignes indicatrices
                plot_indicator_lines(true)
            }
            $(".crop_can").remove()
            $(".div_can").remove()
            updateBarsFromEvent(selected_swim, true);
        }
        let rangeV = document.getElementById('nodule')
        rangeV.innerHTML = `<span>${sec_to_timestr((vid.currentTime - temp_start).toFixed(3))}s</span>`;
    })

    $("#timebar").on("input", function () {
        let elem = $("#timebar");
        let vid = document.getElementById("vid")

        vid.currentTime = vid.duration * (elem.val() / 100)

        let memo = last_checkpoint
        last_checkpoint = (get_last_checkpoint(meters_checkpoints, parseInt((vid.currentTime - temp_start)*frame_rate)))
        if(memo != last_checkpoint){
            if(show_indicator_lines){
                // On supprime les anciennes
                plot_indicator_lines(false)
                // On réaffiche les lignes indicatrices
                plot_indicator_lines(true)
            }
            $(".crop_can").remove()
            $(".div_can").remove()
            updateBarsFromEvent(selected_swim, true);
        }
        setGrad((elem.val() / 100))
        let rangeV = document.getElementById('nodule')
        rangeV.innerHTML = `<span>${sec_to_timestr((vid.currentTime - temp_start).toFixed(3))}</span>`;
    })

    $("#keyframes").on("mouseover", ".keyhold", function () {
        let elem = $(this);
        highlightCycle(elem.attr("swim"), elem.attr("num"))
    })
    
    $("#keyframes").on("mouseout", ".keyhold", function () {
        resetHigh()
    })

    $("#download").on("click", function () {
        const head = [["frameId", "swimmerId", "swimmerName", "lane", "cumul", "eventId", "eventX", "eventY", "event", "TempsVideo (s)", "Temps (s)", "distance (m)", "tempo (s)", "frequence (cylce/min)", "amplitude (m)", "vitesse (m/s)"]];
        let rows = []
        let swims = Object.keys(curr_swims)
        for (let i = 0; i < swims.length; i++) {
            const epreuveStyle  = megaData[0]["nage"]
            const epreuveDistance = megaData[0]["distance"]
            let longueur = 1
            let skipNextCycle = false;
    
            let ampli = []
            let tempo = []
            for (let j = 0; j < curr_swims[i].length; j++) {
                let r = curr_swims[i][j]

                let nageur = nageurs[i];
                let lane = "ligne" + (i + 1)
                let eventRow = r["mode"]
                let distanceRow = r["cumul"].toFixed(2)
                let tempsVideo = (parseFloat(frameId_to_RunTime(r["frame_number"]))+parseFloat(temp_start))
                let tempsRow = frameId_to_RunTime(r["frame_number"]);

                if (r["mode"] === "turn") {
                    rows.push([r["frame_number"], (r["swimmer"]), nageur, lane, distanceRow, j, r["x"].toFixed(4), r["y"], eventRow, tempsVideo, tempsRow, distanceRow])

                    longueur +=1
                    skipNextCycle = true        
                } else if (r["mode"] === "cycle") { 
                    if (skipNextCycle) {
                        skipNextCycle = false;

                        tempo.push(frameId_to_RunTime(r["frame_number"]))
                        ampli.push(r["cumul"])
        
                        rows.push([r["frame_number"], (r["swimmer"]), nageur, lane, distanceRow, j, r["x"].toFixed(4), r["y"], eventRow, tempsVideo, tempsRow, distanceRow])
                    } else {
                        tempo.push(frameId_to_RunTime(r["frame_number"]))
                        ampli.push(r["cumul"])

                        let result = metrics_calculation(epreuveStyle, epreuveDistance, tempo, ampli, longueur);
                        let tempoRow = result.tempoRow;
                        let frequenceRow = result.frequenceRow;
                        let amplitudeRow = result.amplitudeRow;
                        let vitesseRow = result.vitesseRow;

                        if(isNaN(tempoRow)){tempoRow = codeNaNforDownload}
                        if(isNaN(frequenceRow)){frequenceRow = codeNaNforDownload}
                        if(isNaN(amplitudeRow)){amplitudeRow = codeNaNforDownload}
                        if(isNaN(vitesseRow)){vitesseRow = codeNaNforDownload}

                        rows.push([r["frame_number"], (r["swimmer"]), nageur, lane, distanceRow, j, r["x"].toFixed(4), r["y"], eventRow, tempsVideo, tempsRow, distanceRow, tempoRow, frequenceRow, amplitudeRow, vitesseRow])
                    }
                } else {
                    rows.push([r["frame_number"], (r["swimmer"]), nageur, lane, distanceRow, j, r["x"].toFixed(4), r["y"], eventRow, tempsVideo, tempsRow, distanceRow])
                }

            }
        }

        let csvContent = "data:text/csv;charset=utf-8,"
            + head.map(e => e.join(",")).join("\n") + "\n"
            + rows.map(e => e.join(",")).join("\n");


        let encodedUri = encodeURI(csvContent);
        let link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", $("#temp").val());
        document.body.appendChild(link); 

        link.click();
    })

    
    $("#del").on("click", function () {

        
        let last_added_data_index = last_added_data.indexOf(curr_swims[selected_swim][selected_cycle])
        if(last_added_data_index >= 0){
            last_added_data.splice(last_added_data_index,1);
        }
        curr_swims[selected_swim].splice(selected_cycle, 1);
        curr_swims[selected_swim] = currate_events(curr_swims[selected_swim])

        updateBarsFromEvent(selected_swim);
        draw_stats(curr_swims[selected_swim])
        updateTable()

        flipper = false
        construct_last_added_data_table()
        construct_modify_selected_annotation_table(true)}
    )

    $("#right-m").on("click", function () {

       
        let valueDeplacement = parseFloat(document.getElementById("deplacementCorrection").value)/100;
        curr_swims[selected_swim][selected_cycle].x -= valueDeplacement

        update_cycle_rapide()
    })

    $("#left-m").on("click", function () {
        
        let valueDeplacement = parseFloat(document.getElementById("deplacementCorrection").value)/100;
        curr_swims[selected_swim][selected_cycle].x += valueDeplacement
        update_cycle_rapide()
    })

    

export function focus_time_input(){
    deactivate_shortcut();
}

export function focusout_time_input(e){
    activate_shortcut();
    let entry = e.currentTarget
    let entry_value = entry.value
    if(entry_value != ""){
        [min,sec,ms] = timestr_to_min_sec_ms(entry_value)
        e.currentTarget.value = min+":"+sec+"."+ms
    }
}



    /**
     * Transforme une chaîne de caractère comprenant min:sec.ms en une version normalisée et vérifiée
     * Ex : "01:1.23" en min = "01" sec = "01" ms = "23"
     * Ex : pasUnNombre:10.toto en min = "00" sec = "10" ms = "00"
     * Ex : "72.234" en min = "01" sec = "12" ms = "234"
     * Ex : 120 en min = "00" sec = "01" ms = "20"
     *
     * @param {str} timestr the input string
     * @return {array} [min,sec,ms] minute, second, precise sec
     */
    export function timestr_to_min_sec_ms(timestr){
        let spl_min_secms = timestr.split(":");
        let secms = spl_min_secms[0];
        if (spl_min_secms.length > 1){
            min = spl_min_secms[0];
            secms = spl_min_secms[1];
        }
        let spl_sec_ms = secms.split(".");
        let sec = spl_sec_ms[0];
        if(spl_sec_ms.length > 1){
            ms = spl_sec_ms[1];
        }else{
            let elm = spl_sec_ms[0]
            ms = (isNaN(elm[elm.length-2]) ? "0" : elm[elm.length-2]) + (isNaN(elm[elm.length-1]) ? "0" : elm[elm.length-1])
            sec = (isNaN(elm[elm.length-4]) ? "0" : elm[elm.length-4]) + (isNaN(elm[elm.length-3]) ? "0" : elm[elm.length-3])
            min = (isNaN(elm[elm.length-6]) ? "0" : elm[elm.length-6]) + (isNaN(elm[elm.length-5]) ? "0" : elm[elm.length-5])
        }

        min = isNaN(min) ? 0 : (parseInt(Math.abs(min)))
        sec = isNaN(sec) ? 0 : (parseInt(Math.abs(sec)))

        min = (min+Math.floor(sec/60)).toString();
        sec = (sec%60).toString();

        ms = isNaN(ms) ? "0" : ms
        
        if(min.length <= 1){
            min = ("0"+min).substr(("0"+min).length-2)
        }

        sec = ("0"+sec).substr(("0"+sec).length-2)
        if(ms.length <= 1){
            ms = (ms+"0").substr((ms+"0").length-2)
        }
        return [min,sec,ms]
    }

    /**
     * Transforme min:sec.ms en une valeur totale de secondes
     * Ex :  min = "01" sec = "02" ms = "23" en 62.23
     * Devrait être utiliser avec timestr_to_min_sec_ms
     *
     * @param {array} [min,sec,ms] minute, second, precise sec
     * @return {number} total_sec nombre total de secondes
     */
    export function min_sec_ms_to_sec([min,sec,ms]){
        min = parseInt(min)
        sec = parseInt(sec)
        ms = parseFloat("0."+ms)
        return min*60+sec+1.0*ms
    }

    export function sec_to_timestr(secondes){
        min = Math.floor(Math.abs(secondes) / 60.0)
        min = ("0"+min.toString()).substr(("0"+min.toString()).length-2)

        sec = Math.floor(Math.abs(secondes) % 60.0)
        sec = ("0"+sec.toString()).substr(("0"+sec.toString()).length-2)

        ms = (Math.abs(secondes).toString()).split(".")
        if(ms.length > 1){
            ms = ms[1]
        }else{
            ms = 0
        }
        ms = (ms+"0").substring(2,0)
        let signe = ""
        if(secondes < 0){
            signe += "-"
        }
        return signe+min+":"+sec+"."+ms
    }

    $('#video').bind('wheel', function (e) {
        e.preventDefault()

        let vid = document.getElementById("video");
        let bounds = document.getElementById("vid-cont").getBoundingClientRect();
        let x = (e.clientX - bounds.left - (isNaN(parseFloat(vid.style["left"])) ? 0 : parseFloat(vid.style["left"])) ) - vid.offsetWidth/2.0
        let y = (e.clientY - bounds.top - (isNaN(parseFloat(vid.style["top"])) ? 0 : parseFloat(vid.style["top"])) ) - vid.offsetHeight/2.0
        
        if (e.originalEvent.wheelDelta / 120 > 0) { //ZOOM IN
            // if (scaleZoom < 6.8) { // arbitrary cap of zoom
            //     scaleZoom += (zoom_step / 100)
            //     // TODO: un-comment to release the aimed zoom
            //     // let bx = e.originalEvent.offsetX
            //     // let by = e.originalEvent.offsetY
            //     // d3.select("#video").transition().duration(75).style("transform-origin", (bx) + "px " + (by) + "px").style("transform", "scale(" + (scaleZoom) + ")")
            //     d3.select("#video").transition().duration(75).style("transform", "scale(" + (scaleZoom) + ")")
            // }
            
            zoom((zoom_step / 100),x,y)
        } else { // ZOOM out
            zoom(-(zoom_step / 100),x,y)
            // //TODO: un-comment to release the aimed zoom
            // let left = elem.css("left").substring(0, elem.css("left").length - 2)
            // let top = elem.css("top").substring(0, elem.css("top").length - 2)
            
            // let tleft = parseFloat(left)
            // let ttop = parseFloat(top)
            // elem.css("left", tleft * 0.9)
            // elem.css("top", ttop * 0.9)
        }
    });
let pt=[0,0];
    export function zoom(delta_zoom,deltaX=undefined,deltaY=undefined){
        const elem = $("#video")
        let nextScaleZoom = Math.min(Math.max(1, scaleZoom + delta_zoom),6.8)
        elem.css("transform", "scale(" + (nextScaleZoom) + ")")
        
        if(deltaX != undefined && deltaY != undefined){
            let pleft = parseFloat(elem.css("left"))
            let ptop = parseFloat(elem.css("top"))
            
            elem.css("left",pleft - deltaX*(1-scaleZoom/nextScaleZoom))
            elem.css("top",ptop - deltaY*(1-scaleZoom/nextScaleZoom))
        }
        scaleZoom = nextScaleZoom
    }

    $("#video").on("mousemove", function (e) {
        let bounds = e.target.getBoundingClientRect();
        let x = e.clientX - bounds.left;
        let y = e.clientY - bounds.top;
        let vid = document.getElementById("vid");
    
        if (!vid) {
            console.error("Element with ID 'vid' not found");
            return;
        }
    
        let src = vid.getAttribute("src");
        if (!src) {
            console.error("Attribute 'src' not found on element with ID 'vid'");
            return;
        }
    
        let meta=getMeta();
        if (!meta) {
            console.error("No matching video metadata found");
            return;
        }
    
        x = x - parseFloat(vid.style["left"] || 0);
        y = y - parseFloat(vid.style["top"] || 0);
        if (e.target == vid) {
            pt = getPointInverted([(x / scaleZoom) / vid.offsetWidth, (y / scaleZoom) / vid.offsetHeight], meta);
        } //todo:get Offset stuff
        let trx_scale = d3.scaleLinear([0, 960], [pool_size[0], 0]);
        // On corrige la position de la ligne dans le cas où il y a des lignes indicatrices pour aider à une mesure précise
        let meters_plot_label = (show_indicator_lines ? indicator_correction(trx_scale(pt[0])):trx_scale(pt[0]));
        edit_positionCurseur( meters_plot_label);
        
        plot_cursor(positionCurseur, meta);
    });
    
    
    export function plot_cursor(cursor_position,meta){
        let vid = document.getElementById("vid");
        let container = document.getElementById("video")
        let [twidth, theight] = getSize(meta)
        let pts = getPoolBar(cursor_position, meta).reverse()

        if (cursor_position >= 0 && cursor_position <= pool_size[0]) {
            $(".lin_mesure").remove()

            let can = document.createElement("canvas");
            let context = can.getContext("2d")
            can.setAttribute("class", "line_can lin_mesure")

            let wscale = d3.scaleLinear([2.5, 2.5], [2.5, 2.5])
            can.width = wscale(scaleZoom)

            can.height = Math.round(eucDistance(pts[0], pts[1]) * (vid.offsetWidth / twidth)) //+ 10
            let pointer_color = "#232156" //"rgba(35, 33, 86, 0.2)"

            if(mode in mode_color){
                pointer_color = mode_color[mode]
            }
            context.fillStyle = pointer_color
            context.fillRect(0, 0, 50, 9999)

            let tpool_xscale = d3.scaleLinear([twidth, 0], [100, 0]);
            let tpool_yscale = d3.scaleLinear([0, theight], [0, 100]);
            can.style["top"] = (tpool_yscale(pts[0][1])) + "%";
            can.style["left"] = (tpool_xscale(pts[0][0])) + "%";
            can.style["transform"] = "rotate(" + get_orr(pts[1], pts[0]) + "deg)"
            container.append(can)

            let div = document.createElement("p");
            div.setAttribute("class", "line_can line_tool lin_mesure")
            div.innerText = (Math.round(get_meter_plot_label(cursor_position) * 100, 2) / 100) + " m"
            div.style["left"] = (tpool_xscale(pts[1][0] - 2.5)) + "%";

            if (twidth === 2704) {
                div.style["top"] = (tpool_yscale(pts[1][1]) + 3) + "%";
            } else {
                div.style["top"] = (tpool_yscale(pts[1][1])) + "%";
            }
            container.append(div)
        }
    }


    $("#vid").on("seeking", () => {
        $("#vid").css("opacity", "0.75")
        $("#vid-cont").attr("class", "loading")
    })

    $('#vid').on('canplay', () => {
        $("#vid-cont").attr("class", "")
        $("#vid").css("opacity", "1")
    })

    $("svg").on("click", "rect, circle", function () {
        let elem = d3.select(this);
        flipper = true;
        let vid = document.getElementById("vid")
        vid.style.cursor = "pointer"

        selected_swim = parseInt(elem.attr("swim"))
        updateSwimSwitch()
        selected_num = elem.attr("num")
        selected_cycle = parseInt(selected_num)
        vid.currentTime = temp_start + curr_swims[selected_swim][selected_cycle].frame_number / frame_rate
        construct_modify_selected_annotation_table(false)
    })
    document.getElementById("clr").addEventListener("click", function() {
        // Afficher une fenêtre de confirmation
        var confirmDelete = confirm("Êtes-vous sûr de vouloir supprimer cette ligne ?");
        
        if (confirmDelete) {
            // Si l'utilisateur confirme la suppression, vider les données de la nage sélectionnée
            curr_swims[selected_swim] = [];
            
            vide_last_added_data();
            
            // Mettre à jour l'affichage
            updateBarsFromEvent(selected_swim, true);
            draw_stats(curr_swims[selected_swim]);
            updateTable();
            
            // Réinitialiser le flipper
            flipper = false;
            
            // Reconstruire les tables de données
            construct_last_added_data_table();
            construct_modify_selected_annotation_table(true);
        }
        // Si l'utilisateur annule, rien ne se passe
    });

    function telech() {
                    
                    let message = "https://observablehq.com/@liris/nt-calibration-local?competition=" + selected_comp + "&course=" + get_run_selected();
                    
                    window.open(message, "_blank");
                }
    
    
        // Fetch version from package.json
        if (typeof window !== "undefined" && !window.__TEST__) {
        fetch('./package.json')
        .then(response => response.json())
        .then(data => {
            const version = data.version;
            const versionElement = document.getElementById('app-version');
            if (versionElement) {
                versionElement.textContent = version;
            }
        })
        .catch(error => console.error('Error fetching package.json:', error));
    }
    
    

    export function get_run_selected(){
        // Vérifie d'abord si un paramètre 'course' est présent dans l'URL
        const urlParams = new URLSearchParams(window.location.search);
        const courseParam = urlParams.get('course');
        if (courseParam && courseParam.trim() !== "" && $("#run_part3").val()=='') {
            return courseParam;
        }
        // Sinon, comportement habituel
        const part1 = $("#run_part1").val();
        const part2 = $("#run_part2").val();
        const part3 = $("#run_part3").val();
        const part4 = $("#run_part4").val();
        const selected_comp1 = $("#competition").val();
        return (`${selected_comp1}_${part1}_${part2}_${part3}_${part4}`);
    }
    window.get_run_selected = get_run_selected;
    export function edit_temp_start(x){
        temp_start =x;
    }
    export function edit_selected_cycle(x){
        selected_cycle=x;
    }
    export function edit_scaleZoom (x){
        scaleZoom = x;
    }
    export function edit_flipper(x){
        flipper = x;
    }
    export function edit_selected_num(x){
        selected_num = x;
    }
    export function edit_vue_du_dessus(x){
        vue_du_dessus = x;
    }

    window.addEventListener('DOMContentLoaded', function() {
        // Remplace les onclick inline par des listeners JS
        document.getElementById('btn-enter')?.addEventListener('click', hide_indicator_lines);
        document.getElementById('btn-end')?.addEventListener('click', hide_indicator_lines);
        document.getElementById('btn-cycle')?.addEventListener('click', hide_indicator_lines);
        document.getElementById('btn-respi')?.addEventListener('click', hide_indicator_lines);
        document.getElementById('ligneRef')?.addEventListener('click', action_indicator_lines);
        document.getElementById('resetZoom')?.addEventListener('click', vidReset);
        document.getElementById('btn-report-run')?.addEventListener('click', generateRunReport);
        document.getElementById('telech')?.addEventListener('click', telech);
        document.getElementById('tab-data-entry')?.addEventListener('click', function(e) {
            choose_tab(e, 'data_entry','side_tab_content','sideTabLinks');
        });
        document.getElementById('tab-verification-charts')?.addEventListener('click', function(e) {
            choose_tab(e, 'verification_charts','side_tab_content','sideTabLinks');
        });
        document.getElementById('tab-data-plot-tout')?.addEventListener('click', function(e) {
            choose_tab(e, 'data_plot_tout','side_tab_content','sideTabLinks');
        });
        document.getElementById('tab-modify-selected-annotation')?.addEventListener('click', function(e) {
            choose_tab(e, 'modify_selected_annotation','side_tab_content','sideTabLinks');
        });
        document.getElementById('tab-generate-report')?.addEventListener('click', function(e) {
            choose_tab(e, 'generate_report','side_tab_content','sideTabLinks');
        });
    });

    /**
     * @brief Synchronise l'affichage du sélecteur swim_switch avec la variable selected_swim
     * Met à jour la valeur et les classes CSS du sélecteur pour refléter le nageur sélectionné
     */
    export function updateSwimSwitch() {
        const swimSwitch = document.getElementById("swim_switch");
        if (swimSwitch) {
            swimSwitch.value = selected_swim;
            
            // Mettre à jour les classes CSS des options
            const options = swimSwitch.querySelectorAll('option');
            options.forEach((option, index) => {
                if (index === selected_swim) {
                    option.className = "swimmer-option selected";
                } else {
                    option.className = "swimmer-option";
                }
            });
        }
    }

