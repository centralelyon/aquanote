"""
@file local.py
@brief Serveur Flask API pour servir les données de courses de natation en mode local.
"""

from pathlib import Path
import argparse
import json
import os
import shutil
import subprocess
import sys
import threading
import time
import traceback
import uuid

from flask import Flask, jsonify, request
from flask_caching import Cache
from flask_compress import Compress


ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "videos"
POOL_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
POOL_IMAGE_KEYWORDS = ("pool", "piscine", "swimming")
GENERATION_JOBS = {}
GENERATION_JOBS_LOCK = threading.Lock()

app = Flask(__name__, static_folder=str(DATA_DIR), static_url_path="/files")

COMPRESS_MIMETYPES = [
    "text/html",
    "text/css",
    "text/plain",
    "text/csv",
    "text/xml",
    "application/json",
    "application/javascript",
    "image/jpeg",
    "image/png",
    "video/mp4",
]
COMPRESS_LEVEL = 6
COMPRESS_MIN_SIZE = 500

cache = Cache(config={"CACHE_TYPE": "simple"})
cache.init_app(app)
Compress(app)


def valid_port(value):
    try:
        port = int(value)
    except (TypeError, ValueError) as exc:
        raise argparse.ArgumentTypeError("port must be an integer") from exc

    if not 1 <= port <= 65535:
        raise argparse.ArgumentTypeError("port must be between 1 and 65535")
    return port


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


def directory_payload(directory: Path, entry_type: str):
    if not directory.exists() or not directory.is_dir():
        return jsonify({"error": f"Directory not found: {directory.name}"}), 404

    entries = []
    for entry in sorted(directory.iterdir()):
        if entry_type == "directory" and entry.is_dir():
            entries.append({"name": entry.name, "type": "directory"})
        if entry_type == "file" and entry.is_file():
            entries.append({"name": entry.name, "type": "file"})

    return jsonify(entries)


def safe_metadata_path(compet: str, run: str):
    if not compet or not run:
        return None

    run_directory = safe_run_directory(compet, run)
    if run_directory is None:
        return None

    candidates = [run_directory / f"{run}.json", run_directory / "meta.json"]
    candidates.extend(
        entry for entry in sorted(run_directory.glob("*.json"))
        if entry.name not in {f"{run}.json", "meta.json"}
    )
    for target in candidates:
        resolved = target.resolve()
        try:
            resolved.relative_to(DATA_DIR.resolve())
        except ValueError:
            continue
        if resolved.exists():
            return resolved
    return (run_directory / f"{run}.json").resolve()


def safe_run_directory(compet: str, run: str):
    if not compet or not run:
        return None

    target = (DATA_DIR / compet / run).resolve()
    try:
        target.relative_to(DATA_DIR.resolve())
    except ValueError:
        return None
    return target


def output_url_for(compet: str, run: str, filename: str):
    return f"/files/{compet}/{run}/{filename}"


def job_snapshot(job_id: str):
    with GENERATION_JOBS_LOCK:
        job = GENERATION_JOBS.get(job_id)
        return dict(job) if job else None


def update_generation_job(job_id: str, **values):
    with GENERATION_JOBS_LOCK:
        job = GENERATION_JOBS.get(job_id)
        if not job:
            return
        job.update(values)
        job["updated_at"] = time.time()


def generation_code_for(compet: str, run: str, metadata_path: Path, output_name: str):
    return (
        "from local import generate_from_above_video\n"
        "generate_from_above_video(\n"
        f"    competition={compet!r},\n"
        f"    course={run!r},\n"
        f"    metadata={str(metadata_path)!r},\n"
        f"    output={output_name!r},\n"
        ")"
    )


def ensure_ntt_import_path():
    local_ntt_src = ROOT_DIR.parent / "ntt" / "src"
    if local_ntt_src.exists():
        local_ntt_src_string = str(local_ntt_src)
        if local_ntt_src_string not in sys.path:
            sys.path.insert(0, local_ntt_src_string)


def load_json(path):
    with Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)


def video_by_type(videos, expected_type):
    expected = str(expected_type or "").lower()
    for video in videos:
        type_video = str(video.get("type_video", "")).lower()
        name = str(video.get("name", "")).lower()
        if expected in type_video or expected in name:
            return video
    return None


def metadata_path_for(video_path_in, course, explicit_path=None):
    if explicit_path:
        return Path(explicit_path)

    course_json = Path(video_path_in) / f"{course}.json"
    if course_json.exists():
        return course_json
    return Path(video_path_in) / "meta.json"


def homography_from_video(video):
    return {
        "srcPts": video.get("srcPts", []),
        "destPts": video.get("destPts", []),
    }


def video_start_time(video):
    if not isinstance(video, dict):
        return 0
    for key in ("start_flash", "start_synchro_flash", "start_moment"):
        if key in video:
            try:
                return float(video.get(key) or 0)
            except (TypeError, ValueError):
                return 0
    return 0


def video_with_flash(metadata, fallback=None):
    videos = metadata.get("videos", []) if isinstance(metadata, dict) else []
    flash_side = str((metadata.get("flash") or {}).get("side", "")).lower() if isinstance(metadata, dict) else ""
    side_aliases = {
        "left": ("left", "gauche"),
        "gauche": ("left", "gauche"),
        "right": ("right", "droite"),
        "droite": ("right", "droite"),
    }.get(flash_side, (flash_side,) if flash_side else ())
    return next((video for video in videos if "start_flash" in video), None) or next(
        (
            video for video in videos
            if side_aliases
            and any(alias in f"{video.get('type_video', '')} {video.get('name', '')}".lower() for alias in side_aliases)
        ),
        fallback,
    )


def generate_from_above_video(
    competition="2024_JO_Paris",
    course="2024_JO_Paris_freestyle_hommes_50_finaleA",
    data_dir=DATA_DIR,
    metadata=None,
    output=None,
    log=print,
):
    ensure_ntt_import_path()
    import numpy as np
    from ntt.videos.stich import stitch_2_videos

    video_path_in = os.path.join(str(data_dir), competition, course)

    log("---------------------------------\n    Lancement du programme\n---------------------------------")

    if not os.path.exists(video_path_in):
        log(f"[ERREUR] Le repertoire n'a pas pu etre trouve : {video_path_in}")
        log("[INFO] Creation du repertoire...")
        os.makedirs(video_path_in, exist_ok=True)
        log(f"[INFO] Veuillez placer les videos dans : {video_path_in}")
        log(f"        {course}_fixeGauche.mp4")
        log(f"        {course}_fixeDroite.mp4")
        log("        meta.json")
        raise FileNotFoundError(f"Race directory not found: {video_path_in}")

    json_path = metadata_path_for(video_path_in, course, metadata)
    log(f"[INFO] Chemin du fichier Json : {json_path}")

    try:
        json_course = load_json(json_path)
    except FileNotFoundError:
        log(f"[ERREUR] Aucun fichier de metadata n'a pu etre trouve dans {video_path_in}.")
        raise
    except Exception as exc:
        log(f"[ERREUR] {exc}")
        raise

    log("[INFO] Fichier JSON charge avec succes.")

    videos_meta = json_course.get("videos", [])
    video_gauche_meta = video_by_type(videos_meta, "fixegauche")
    video_droite_meta = video_by_type(videos_meta, "fixedroite")

    video_gauche = (video_gauche_meta or {}).get("name") or course + "_fixeGauche.mp4"
    video_droite = (video_droite_meta or {}).get("name") or course + "_fixeDroite.mp4"

    vg_path = os.path.join(video_path_in, video_gauche)
    vd_path = os.path.join(video_path_in, video_droite)

    if not os.path.exists(vg_path):
        log(f"[ERREUR] Video gauche introuvable : {vg_path}")
        raise FileNotFoundError(f"Left video not found: {vg_path}")
    if not os.path.exists(vd_path):
        log(f"[ERREUR] Video droite introuvable : {vd_path}")
        raise FileNotFoundError(f"Right video not found: {vd_path}")

    log("[INFO] Videos trouvees.")
    log(f"        Gauche : {video_gauche}")
    log(f"        Droite : {video_droite}")

    depart_video_gauche_sound = 0.0
    depart_video_droite_sound = 0.0

    for video in videos_meta:
        if "fixeGauche" in video.get("type_video", ""):
            depart_video_gauche_sound = video_start_time(video)
        elif "fixeDroite" in video.get("type_video", ""):
            depart_video_droite_sound = video_start_time(video)

    offset_gauche_droite = depart_video_gauche_sound - depart_video_droite_sound
    log(f"[INFO] Offset video gauche -> droite : {offset_gauche_droite:.3f}s")

    log("\n__STITCHING DES VIDEOS__\n")

    output_name = output or course + "_from_above.mp4"
    output_path = os.path.join(video_path_in, output_name)

    homography_left = json_course.get("homography_left") or homography_from_video(video_gauche_meta or {})
    homography_right = json_course.get("homography_right") or homography_from_video(video_droite_meta or {})

    if (
        len(homography_left.get("srcPts", [])) < 4
        or len(homography_left.get("destPts", [])) < 4
        or len(homography_right.get("srcPts", [])) < 4
        or len(homography_right.get("destPts", [])) < 4
    ):
        log("[ERREUR] Homographies manquantes dans le JSON de metadata.")
        raise ValueError("Homographies missing from metadata JSON.")

    log("[INFO] Creation de la video stitchee...")

    stitch_2_videos(
        video_path_in,
        video_gauche,
        video_droite,
        video_path_in,
        output_name,
        offset_gauche_droite,
        np.float32(homography_left["srcPts"]),
        np.float32(homography_left["destPts"]),
        np.float32(homography_right["srcPts"]),
        np.float32(homography_right["destPts"]),
    )

    log(f"[INFO] Video stitchee creee : {output_path}")

    log("\n---------------------------------\n        Fin du programme        \n---------------------------------")
    return Path(output_path)


def clamp_region(points, width, height):
    valid_points = []
    for point in points or []:
        if isinstance(point, dict):
            x = point.get("x")
            y = point.get("y")
        elif isinstance(point, (list, tuple)) and len(point) >= 2:
            x, y = point[0], point[1]
        else:
            continue
        try:
            valid_points.append((float(x), float(y)))
        except (TypeError, ValueError):
            continue

    if not valid_points:
        return 0, max(1, int(width)), 0, max(1, int(height))

    xs = [point[0] for point in valid_points]
    ys = [point[1] for point in valid_points]
    xa = max(0, min(int(min(xs)), int(width) - 1))
    xb = min(int(width), max(int(max(xs)) + 1, xa + 1))
    ya = max(0, min(int(min(ys)), int(height) - 1))
    yb = min(int(height), max(int(max(ys)) + 1, ya + 1))
    return xa, xb, ya, yb


def write_flash_preview_frame(video_path: Path, frame_index: int, region, preview_path: Path):
    import cv2

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Could not reopen input video for preview: {video_path}")
    cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, int(frame_index)))
    ret, frame = cap.read()
    cap.release()
    if not ret:
        raise ValueError(f"Could not read detected flash frame {frame_index}.")

    height, width = frame.shape[:2]
    xa, xb, ya, yb = region
    margin = max(24, int(max(xb - xa, yb - ya) * 0.75))
    crop_xa = max(0, xa - margin)
    crop_xb = min(width, xb + margin)
    crop_ya = max(0, ya - margin)
    crop_yb = min(height, yb + margin)
    crop = frame[crop_ya:crop_yb, crop_xa:crop_xb].copy()
    cv2.rectangle(
        crop,
        (xa - crop_xa, ya - crop_ya),
        (max(0, xb - crop_xa - 1), max(0, yb - crop_ya - 1)),
        (0, 0, 255),
        2,
    )
    cv2.imwrite(str(preview_path), crop)
    return preview_path


def detect_flash_peak_video(run_directory: Path, video_name: str, region_points=None, threshold=200, frame_begin=0, frame_end=-1):
    ensure_ntt_import_path()
    import cv2
    from ntt.videos.peak import detect_peak_video

    video_path = run_directory / video_name
    if not video_path.exists():
        raise FileNotFoundError(f"Video not found: {video_name}")

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Could not open input video: {video_path}")
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0) or 50.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    cap.release()

    if width <= 0 or height <= 0:
        raise ValueError(f"Could not read video dimensions for: {video_name}")

    xa, xb, ya, yb = clamp_region(region_points, width, height)
    peak_frame = int(detect_peak_video(
        input_path=str(run_directory),
        video_name_in=video_name,
        output_path=str(run_directory),
        video_name_out=f"{Path(video_name).stem}_flash_peak.avi",
        xa=xa,
        xb=xb,
        ya=ya,
        yb=yb,
        seuil=int(threshold),
        frame_begin=max(0, int(frame_begin)),
        frame_end=int(frame_end),
        nb_frame=-1,
        afficher_anime=False,
        afficher_hist=False,
        write_video=False,
    ))
    preview_name = f"{Path(video_name).stem}_flash_peak_{peak_frame}.jpg"
    preview_path = write_flash_preview_frame(video_path, peak_frame, (xa, xb, ya, yb), run_directory / preview_name)
    return {
        "frame": peak_frame,
        "time": peak_frame / fps,
        "fps": fps,
        "frame_count": frame_count,
        "region": {"xa": xa, "xb": xb, "ya": ya, "yb": yb},
        "preview_name": preview_path.name,
    }


def from_above_video_entry(metadata: dict, output_name: str):
    videos = metadata.get("videos") if isinstance(metadata, dict) else []
    side_video = next(
        (
            video for video in videos
            if "fixe" in str(video.get("type_video", "")).lower()
            or "fixe" in str(video.get("name", "")).lower()
        ),
        videos[0] if videos else {},
    )
    all_dest_points = [
        point
        for video in videos
        for point in video.get("destPts", [])
        if isinstance(point, list) and len(point) >= 2
    ]
    if not all_dest_points:
        all_dest_points = [[0, 361], [900, 361], [900, 0], [0, 0]]
    flash_video = video_with_flash(metadata, side_video)
    xs = [float(point[0]) for point in all_dest_points]
    ys = [float(point[1]) for point in all_dest_points]
    width = int(round(max(xs))) if xs else 900
    height = int(round(max(ys))) if ys else 361
    width = max(width, 1)
    height = max(height, 1)
    src_points = [[0, height], [width, height], [width, 0], [0, 0]]
    return {
        "name": output_name,
        "type_video": "from_above",
        "fps": side_video.get("fps", 50),
        "width": width,
        "height": height,
        "start_moment": video_start_time(flash_video),
        "start_side": metadata.get("start_side", side_video.get("start_side", "left")),
        "one_is_up": metadata.get("one_is_up", side_video.get("one_is_up", False)),
        "srcPts": src_points,
        "destPts": src_points,
    }


def ensure_from_above_metadata(metadata_path: Path, output_name: str):
    with metadata_path.open(encoding="utf-8") as handle:
        metadata = json.load(handle)
    videos = metadata.setdefault("videos", [])
    entry = from_above_video_entry(metadata, output_name)
    existing_index = next(
        (
            index for index, video in enumerate(videos)
            if video.get("name") == output_name
            or str(video.get("type_video", "")).lower() == "from_above"
            or "from_above" in str(video.get("name", "")).lower()
        ),
        -1,
    )
    if existing_index >= 0:
        videos[existing_index] = {**videos[existing_index], **entry}
    else:
        videos.append(entry)
    metadata["ncamera"] = len(videos)
    with metadata_path.open("w", encoding="utf-8") as handle:
        json.dump(metadata, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    cache.clear()
    return entry


def remove_from_above_metadata(metadata_path: Path):
    with metadata_path.open(encoding="utf-8") as handle:
        metadata = json.load(handle)
    videos = metadata.get("videos") if isinstance(metadata, dict) else []
    if not isinstance(videos, list):
        videos = []
    kept = [
        video for video in videos
        if str(video.get("type_video", "")).lower() not in {"from_above", "dessus"}
        and "from_above" not in str(video.get("name", "")).lower()
    ]
    metadata["videos"] = kept
    metadata["ncamera"] = len(kept)
    with metadata_path.open("w", encoding="utf-8") as handle:
        json.dump(metadata, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    cache.clear()
    return metadata


def transcode_for_browser(video_path: Path, log=print):
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is required to make the from-above video browser-playable.")

    source_path = Path(video_path)
    temp_path = source_path.with_name(f"{source_path.stem}_browser_tmp{source_path.suffix}")
    original_path = source_path.with_name(f"{source_path.stem}_original{source_path.suffix}")
    command = [
        ffmpeg,
        "-y",
        "-i",
        str(source_path),
        "-an",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(temp_path),
    ]
    log("[INFO] Conversion H.264 pour lecture navigateur...")
    process = subprocess.run(command, capture_output=True, text=True, check=False)
    if process.returncode != 0:
        if temp_path.exists():
            temp_path.unlink()
        raise RuntimeError(process.stderr or process.stdout or "ffmpeg conversion failed.")

    if not original_path.exists():
        source_path.replace(original_path)
    else:
        source_path.unlink(missing_ok=True)
    temp_path.replace(source_path)
    log(f"[INFO] Vidéo compatible navigateur créée : {source_path}")
    return source_path


def run_generation_job(job_id: str, compet: str, run: str, metadata_path: Path, output_name: str, output_path: Path):
    update_generation_job(job_id, status="running", progress=20, message="Generation started.")
    logs = []

    def log(message):
        logs.append(str(message))
        update_generation_job(
            job_id,
            stdout="\n".join(logs[-80:]),
            message=str(message).splitlines()[0] if str(message).strip() else "Generation running.",
        )

    try:
        generated_path = generate_from_above_video(
            competition=compet,
            course=run,
            data_dir=DATA_DIR,
            metadata=metadata_path,
            output=output_name,
            log=log,
        )
    except Exception as exc:
        update_generation_job(
            job_id,
            status="error",
            progress=100,
            message=str(exc),
            stdout="\n".join(logs),
            stderr=traceback.format_exc(),
        )
        return

    actual_output_path = Path(generated_path or output_path)
    if not actual_output_path.exists():
        update_generation_job(
            job_id,
            status="error",
            progress=100,
            message="Generation finished, but the output video was not found.",
            stdout="\n".join(logs),
        )
        return

    try:
        actual_output_path = transcode_for_browser(actual_output_path, log=log)
    except Exception as exc:
        update_generation_job(
            job_id,
            status="error",
            progress=100,
            message=str(exc),
            stdout="\n".join(logs),
            stderr=traceback.format_exc(),
        )
        return

    video_entry = ensure_from_above_metadata(metadata_path, actual_output_path.name)
    update_generation_job(
        job_id,
        status="done",
        progress=100,
        message="Generation complete.",
        stdout="\n".join(logs),
        stderr="",
        output=str(actual_output_path.relative_to(ROOT_DIR)),
        output_url=output_url_for(compet, run, actual_output_path.name),
        video=video_entry,
    )


def pool_image_payload():
    entries = []
    seen = set()
    search_dirs = [ROOT_DIR, DATA_DIR]

    for directory in search_dirs:
        if not directory.exists():
            continue
        for entry in sorted(directory.iterdir()):
            if not entry.is_file() or entry.suffix.lower() not in POOL_IMAGE_EXTENSIONS:
                continue
            relative = entry.relative_to(ROOT_DIR).as_posix()
            searchable = relative.lower()
            if not any(keyword in searchable for keyword in POOL_IMAGE_KEYWORDS):
                continue
            if relative in seen:
                continue
            seen.add(relative)
            entries.append({
                "name": entry.stem.replace("_", " "),
                "path": relative,
                "type": "file"
            })

    return jsonify(entries)


@app.route("/getCompets")
def get_compets():
    return directory_payload(DATA_DIR, "directory")


@app.route("/getRuns/<compet>")
def get_runs(compet):
    return directory_payload(DATA_DIR / compet, "directory")


@app.route("/getDatas/<compet>/<run>")
def get_datas(compet, run):
    return directory_payload(DATA_DIR / compet / run, "file")


@app.route("/getQuality/<compet>/<run>")
def get_quality(compet, run):
    return directory_payload(DATA_DIR / compet / run, "file")


@app.route("/getPoolImages")
def get_pool_images():
    return pool_image_payload()


@app.route("/saveMetadata", methods=["POST", "OPTIONS"])
def save_metadata():
    if request.method == "OPTIONS":
        return "", 204

    payload = request.get_json(silent=True) or {}
    compet = payload.get("competition")
    run = payload.get("run")
    metadata = payload.get("metadata")

    target = safe_metadata_path(compet, run)
    if target is None:
        return jsonify({"error": "Invalid competition or run."}), 400
    if not target.exists():
        return jsonify({"error": f"Metadata file not found: {target.name}"}), 404
    if not isinstance(metadata, dict):
        return jsonify({"error": "metadata must be a JSON object."}), 400

    with target.open("w", encoding="utf-8") as handle:
        json.dump(metadata, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    cache.clear()
    return jsonify({"status": "ok", "path": str(target.relative_to(ROOT_DIR))})


@app.route("/generateFromAbove", methods=["POST", "OPTIONS"])
def generate_from_above():
    if request.method == "OPTIONS":
        return "", 204

    payload = request.get_json(silent=True) or {}
    compet = payload.get("competition")
    run = payload.get("run")
    metadata = payload.get("metadata")

    run_directory = safe_run_directory(compet, run)
    target = safe_metadata_path(compet, run)
    if run_directory is None or target is None:
        return jsonify({"error": "Invalid competition or run."}), 400
    if not run_directory.exists():
        return jsonify({"error": f"Run directory not found: {run}"}), 404
    if not target.exists():
        return jsonify({"error": f"Metadata file not found: {target.name}"}), 404
    if metadata is not None and not isinstance(metadata, dict):
        return jsonify({"error": "metadata must be a JSON object."}), 400

    if isinstance(metadata, dict):
        with target.open("w", encoding="utf-8") as handle:
            json.dump(metadata, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        cache.clear()

    output_name = f"{run}_from_above.mp4"
    output_path = run_directory / output_name
    code = generation_code_for(compet, run, target, output_name)

    job_id = uuid.uuid4().hex
    with GENERATION_JOBS_LOCK:
        GENERATION_JOBS[job_id] = {
            "id": job_id,
            "status": "queued",
            "progress": 5,
            "message": "Generation queued.",
            "command": code,
            "created_at": time.time(),
            "updated_at": time.time(),
            "output": str(output_path.relative_to(ROOT_DIR)),
            "output_url": output_url_for(compet, run, output_name),
        }

    thread = threading.Thread(
        target=run_generation_job,
        args=(job_id, compet, run, target, output_name, output_path),
        daemon=True,
    )
    thread.start()

    return jsonify(job_snapshot(job_id)), 202


@app.route("/generateFromAbove/<job_id>")
def generate_from_above_status(job_id):
    job = job_snapshot(job_id)
    if job is None:
        return jsonify({"error": "Generation job not found."}), 404
    return jsonify(job)


@app.route("/detectFlashPeak", methods=["POST", "OPTIONS"])
def detect_flash_peak():
    if request.method == "OPTIONS":
        return "", 204

    payload = request.get_json(silent=True) or {}
    compet = payload.get("competition")
    run = payload.get("run")
    video_name = payload.get("video")

    run_directory = safe_run_directory(compet, run)
    if run_directory is None:
        return jsonify({"error": "Invalid competition or run."}), 400
    if not run_directory.exists():
        return jsonify({"error": f"Run directory not found: {run}"}), 404
    if not video_name:
        return jsonify({"error": "video is required."}), 400

    video_path = (run_directory / str(video_name)).resolve()
    try:
        video_path.relative_to(run_directory)
    except ValueError:
        return jsonify({"error": "Invalid video path."}), 400

    try:
        result = detect_flash_peak_video(
            run_directory=run_directory,
            video_name=video_path.name,
            region_points=payload.get("regionSourcePts"),
            threshold=payload.get("threshold", 200),
            frame_begin=payload.get("frameBegin", 0),
            frame_end=payload.get("frameEnd", -1),
        )
    except Exception as exc:
        return jsonify({
            "error": str(exc),
            "traceback": traceback.format_exc(),
        }), 500

    return jsonify({
        "status": "ok",
        **result,
        "video": video_path.name,
        "preview_url": output_url_for(compet, run, result["preview_name"]),
    })


@app.route("/deleteFromAbove", methods=["POST", "OPTIONS"])
def delete_from_above():
    if request.method == "OPTIONS":
        return "", 204

    payload = request.get_json(silent=True) or {}
    compet = payload.get("competition")
    run = payload.get("run")

    run_directory = safe_run_directory(compet, run)
    target = safe_metadata_path(compet, run)
    if run_directory is None or target is None:
        return jsonify({"error": "Invalid competition or run."}), 400
    if not run_directory.exists():
        return jsonify({"error": f"Run directory not found: {run}"}), 404
    if not target.exists():
        return jsonify({"error": f"Metadata file not found: {target.name}"}), 404

    deleted = []
    for candidate in run_directory.glob("*from_above*.mp4"):
        if candidate.is_file():
            candidate.unlink()
            deleted.append(str(candidate.relative_to(ROOT_DIR)))

    metadata = remove_from_above_metadata(target)
    return jsonify({
        "status": "ok",
        "deleted": deleted,
        "metadata": metadata,
    })


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the Aquanote local data API.")
    parser.add_argument(
        "--port",
        type=valid_port,
        default=valid_port(os.environ.get("AQUANOTE_API_PORT", "8000")),
        help="API port to listen on. Defaults to AQUANOTE_API_PORT or 8000.",
    )
    args = parser.parse_args()
    app.run(host="127.0.0.1", port=args.port, debug=False)
