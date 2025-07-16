/**
 * @file homography_handler.js
 * @brief gère les calculs d'homographie afin de passer d'un rectangle représantant une piscine vue du dessus à la vue de la caméra.
 */
import { getSize } from './utils.js';
import { pool_size} from './loader.js';

const PerspT= window.PerspT;
let pool_vid_xscale ;
let pool_vid_yscale ;

/**
 * @brief Transforme un point de coordonnées de piscine en coordonnées vidéo via homographie
 * Utilise la calibration pour convertir des coordonnées métriques de la piscine en pixels vidéo
 * 
 * @param {array} pt Point [x, y] en coordonnées de piscine (mètres)
 * @param {object} meta Métadonnées de calibration vidéo contenant srcPts et destPts
 * @return {array} Point transformé [x, y] en coordonnées vidéo (pixels)
 */
export function getPoint(pt, meta) {
    pool_vid_xscale = d3.scaleLinear([0, pool_size[0]], [1920, 0]);
    pool_vid_yscale = d3.scaleLinear([0, pool_size[1]], [1080, 0]);
    let try_scale = d3.scaleLinear([0, 360], [0, 1080])
    let trx_scale = d3.scaleLinear([0, 900], [0, 960])

    let src_tmeta = meta.srcPts.map(d => [d[0], d[1]]) // Does their vids' x are from right to left?
    let dst_tmeta = meta.destPts.map(d => [trx_scale(d[0]), try_scale(d[1])]) // This is in from_above reference

    let srcCorners = src_tmeta.flat()
    let dstCorners = dst_tmeta.flat()

    let perspT = new PerspT(dstCorners, srcCorners);

    let srcPt = [pool_vid_xscale(pt[0]) / 2, pool_vid_yscale(pt[1])] // In from_above space
    let dstPt = perspT.transform(srcPt[0], srcPt[1]);

    return [dstPt[0], dstPt[1]]
}

/**
 * @brief Transforme un point de coordonnées vidéo en coordonnées de piscine (transformation inverse)
 * Convertit des coordonnées pixel de la vidéo en coordonnées métriques de la piscine
 * 
 * @param {array} pt Point [x, y] en coordonnées vidéo normalisées (0-1)
 * @param {object} meta Métadonnées de calibration vidéo
 * @return {array} Point transformé [x, y] en coordonnées de piscine (mètres)
 */
export function getPointInverted(pt, meta) { // I.E. from side view to meters

    let [twidth, theight] = getSize(meta)

    let try_scale = d3.scaleLinear([0, 360], [0, 1080]);
    let trx_scale = d3.scaleLinear([0, 901], [0, 960]);

    let src_tmeta = meta.srcPts.map(d => [d[0], d[1]]); // Does their vids' x are from right to left?
    let dst_tmeta = meta.destPts.map(d => [trx_scale(d[0]), try_scale(d[1])]); // This is in from_above reference

    let srcCorners = src_tmeta.flat();
    let dstCorners = dst_tmeta.flat();

    let perspT = new PerspT(srcCorners, dstCorners);

    let dstPt = perspT.transform(pt[0] * twidth, pt[1] * theight);

    return [dstPt[0], dstPt[1]]
}
/**
 * @brief Cette fonction permet de calculer les points délimitant l'affichage des barres d'annotation sur une seule ligne.
 * Lire la documentation de getPoolBar pour comprendre les lignes relatives à ratio_affichage_html.
 * @param {*} pt indique à quel point on est avancé dans la piscine
 * @param {*} meta comporte les informations de la course et de comment elles ont été filmés, notamment de la calibration
 * @param {*} swimmer le nageur sur la ligne
 * @returns Les points pour faire une barre sur une seule ligne 
 */

export function getBar(pt, meta, swimmer) { // Here we take the assumption that pt is at the middle of a lane
    //console.log(pt, "le pt ou on dessine");
    pool_vid_xscale = d3.scaleLinear([0, pool_size[0]], [1920, 0]);
    pool_vid_yscale = d3.scaleLinear([0, pool_size[1]], [1080, 0]);
    let try_scale = d3.scaleLinear([0, 361], [0, 1080])
    let trx_scale = d3.scaleLinear([0, 900], [0, 960])

    let src_tmeta = meta.srcPts.map(d => [d[0], d[1]]) // Does their vids' x are from right to left?
    let dst_tmeta = meta.destPts.map(d => [trx_scale(d[0]), try_scale(d[1])]) // This is in from_above reference
    let ratio_affichage_html=1.89 // cela est la valeur autours de laquelle semble tourner l'affichage (dépend de la taille de la page). 
    let ratio_video=meta.width/meta.height;
    if (ratio_video<ratio_affichage_html){
        let hauteur_affiche=meta.width/ratio_affichage_html
        for (let i=0; i<src_tmeta.length;i++){
            src_tmeta[i][1]=src_tmeta[i][1]-(hauteur_affiche-meta.height)/2
        }     
    }
    

    let srcCorners = src_tmeta.flat();
    let dstCorners = dst_tmeta.flat();

    let perspT = new PerspT(dstCorners, srcCorners);
    //console.log(swimmer,pt[0], "le nageur puis les pt[0]")
    let srcPt1 = [pool_vid_xscale(pt[0]) / 2, pool_vid_yscale(swimmer * (pool_size[1] / 8))]; // In from_above space -1 meter vertically (i.e. the start of the lane)
    let srcPt2 = [pool_vid_xscale(pt[0]) / 2, pool_vid_yscale((swimmer * (pool_size[1] / 8) + 2))]; // In from_above space +1 meter vertically (i.e. the end of the lane)
    //console.log(srcPt1, srcPt2, "amuvais sources points")
    let dstPt1 = perspT.transform(srcPt1[0], srcPt1[1]);
    let dstPt2 = perspT.transform(srcPt2[0], srcPt2[1]);

    return [[dstPt1[0], dstPt1[1]], [dstPt2[0], dstPt2[1]]]
}

/**
 * @brief Calcule la distance euclidienne entre deux points
 * Fonction utilitaire pour mesurer la distance entre deux points dans un espace 2D
 * 
 * @param {array} a Premier point [x, y]
 * @param {array} b Deuxième point [x, y]
 * @return {number} Distance euclidienne entre les deux points
 */
export function eucDistance(a, b) {
    return a
            .map((x, i) => Math.abs(x - b[i]) ** 2)
            .reduce((sum, now) => sum + now)
        ** (1 / 2)
}

/**
 * @brief Calcule l'angle d'orientation entre deux points
 * Détermine l'angle de rotation nécessaire pour orienter une ligne entre deux points
 * 
 * @param {array} p1 Premier point [x, y]
 * @param {array} p2 Deuxième point [x, y]
 * @return {number} Angle en degrés (avec correction de +90°)
 */
export function get_orr(p1, p2) {
    let a = (Math.atan2(p2[1] - p1[1], p2[0] - p1[0])) * (180 / Math.PI);
    a += 90;
    return a;
}


/**
 * @brief Une composante importante à comprendre est que le site fonctionne actuellement avec un ratio d'affichage vidéo fixe (largeur/hauteur environ = 1.89)
 * Cela implique de ronger des vidéos qui n'auraient pas ce ratio précis. Ainsi, il est nécessaire de prendre cela en compte afin de corriger lors du placement des point d'annotation.
 * Sans correction de ce type, une vidéo au format 3840*2160 pourra être parfaitement calibrée mais les affichages seront au dessus car la vidéo sera rongé verticalement
 * ainsi, on va venir corriger cet effet en bougeant artificiellement les points de calibration.
 * @function getPoolBar permet de calculer les 2 points délimitant chaque barre tracée dans l'application
 * @param x indique à quel point on est avancé dans la piscine
 * @param meta comporte les informations de la course et de comment elles ont été filmés, notamment de la calibration
 * @param D3Instance utile pour les tests automatisés
 * @return les 2 points délimitant chaque barre tracée dans l'application
 */
export function getPoolBar(x, meta,D3Instance=d3) {
    pool_vid_xscale = d3.scaleLinear([0, pool_size[0]], [1920, 0]);
    pool_vid_yscale = d3.scaleLinear([0, pool_size[1]], [1080, 0]);

    let try_scale = D3Instance.scaleLinear([0, 360], [0, 1080])
    let trx_scale = D3Instance.scaleLinear([0, 900], [0, 960])

    let src_tmeta = meta.srcPts.map(d => [d[0], d[1]]) // Does their vids' x are from right to left?
    let dst_tmeta = meta.destPts.map(d => [trx_scale(d[0]), try_scale(d[1])]) // This is in from_above reference

    
    let ratio_affichage_html=1.89 // cela est la valeur autours de laquelle semble tourner l'affichage (dépend de la taille de la page). 
    let ratio_video=meta.width/meta.height;
    if (ratio_video<ratio_affichage_html){
        let hauteur_affiche=meta.width/ratio_affichage_html
        for (let i=0; i<src_tmeta.length;i++){
            src_tmeta[i][1]=src_tmeta[i][1]-(hauteur_affiche-meta.height)/2

        }     
    }else{
        let largeur_affiche=meta.height*ratio_affichage_html
        for (let i=0; i<src_tmeta.length;i++){
            src_tmeta[i][0]=src_tmeta[i][0]+(largeur_affiche-meta.width)/2
        }
    }
    
    let srcCorners = src_tmeta.flat()
    let dstCorners = dst_tmeta.flat()

    let perspT = new PerspT(dstCorners, srcCorners);
    
    let srcPt1 = [(pool_vid_xscale(x) / 2), pool_vid_yscale(0)];
    let srcPt2 = [(pool_vid_xscale(x) / 2), pool_vid_yscale(pool_size[1])];
    //console.log(srcPt1,srcPt2," bons source points",x,"le x")
    let dstPt1 = perspT.transform(srcPt1[0], srcPt1[1]);
    let dstPt2 = perspT.transform(srcPt2[0], srcPt2[1]);
    return [dstPt1, dstPt2]
};
