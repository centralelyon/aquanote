"""
@file local.py
@brief Serveur Flask API pour servir les données de courses de natation en mode local.
"""

from pathlib import Path
import json

from flask import Flask, jsonify, request
from flask_caching import Cache
from flask_compress import Compress


ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "courses_demo"

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

    target = (DATA_DIR / compet / run / f"{run}.json").resolve()
    try:
        target.relative_to(DATA_DIR.resolve())
    except ValueError:
        return None
    return target


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


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8001, debug=False)
