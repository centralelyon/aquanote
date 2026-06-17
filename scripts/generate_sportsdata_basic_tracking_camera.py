"""Generate Aquanote sportsdata assets from a side-pool perspective camera."""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from generate_sportsdata_basic_tracking import (
    DEFAULT_COMPETITION,
    DEFAULT_COURSE,
    DEFAULT_COURSE_TYPE,
    DEFAULT_DISTANCE,
    DEFAULT_SWIMMER_SEX,
    DEFAULT_YEAR,
    build_aquanote_rows,
    copy_input,
    derived_competition_name,
    derived_run_name,
    display_path,
    ensure_default_input,
    read_basic_tracking_csv,
    regenerate_flat_json,
    resolve_output_dir,
    write_aquanote_csv,
    interpolate_distance,
)
from generate_video import (
    LANE_CAP_COLORS,
    build_circle_polygon,
    build_swimmer_polygon,
    draw_lane_overlay,
    draw_pool_surface,
    finalize_output as finalize_aquanote_video_output,
    pool_x_to_destination_x,
    transform_points,
)


REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CAMERA_NAME = "sportsdata_basic_tracking_camera.json"
REFERENCE_POOL_WIDTH = 900.0
REFERENCE_POOL_HEIGHT = 361.0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Convert sportsdata basic swimming tracking CSV files into Aquanote "
            "assets using a side-pool pinhole camera to create perspective."
        )
    )
    parser.add_argument(
        "--input",
        type=Path,
        help=(
            "sportsdata basic tracking CSV. If omitted, the script writes and uses "
            "the bundled sportsdata sample in the output directory."
        ),
    )
    parser.add_argument(
        "--camera",
        type=Path,
        help=(
            "Camera JSON file. If omitted, a side-pool camera is derived from the "
            "pool and video dimensions."
        ),
    )
    parser.add_argument(
        "--camera-output",
        type=Path,
        help=(
            "Where to write the camera actually used. Defaults to "
            f"{DEFAULT_CAMERA_NAME} inside the output directory."
        ),
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        help=(
            "Output run directory. Defaults to "
            "videos/{year}_{competition}/"
            "{year}_{competition}_{type_nage}_{sexe_nageurs}_{distance}_{course}."
        ),
    )
    parser.add_argument("--year", default=DEFAULT_YEAR)
    parser.add_argument("--competition", default=DEFAULT_COMPETITION)
    parser.add_argument(
        "--type-nage",
        "--course-type",
        dest="course_type",
        default=DEFAULT_COURSE_TYPE,
    )
    parser.add_argument(
        "--sexe-nageurs",
        "--swimmer-sex",
        dest="swimmer_sex",
        default=DEFAULT_SWIMMER_SEX,
    )
    parser.add_argument("--distance", default=DEFAULT_DISTANCE)
    parser.add_argument("--course", default=DEFAULT_COURSE)
    parser.add_argument(
        "--competition-name",
        help="Competition folder name. Defaults to {year}_{competition}.",
    )
    parser.add_argument(
        "--run-name",
        help=(
            "Run folder and file stem. Defaults to "
            "{competition_name}_{type_nage}_{sexe_nageurs}_{distance}_{course}."
        ),
    )
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=720)
    parser.add_argument("--pool-length", type=float, default=50.0)
    parser.add_argument("--pool-width", type=float, default=20.0)
    parser.add_argument("--lane", default="ligne1")
    parser.add_argument("--swimmer-name", default="Swimmer 1")
    parser.add_argument("--start-side", choices=("left", "right"), default="left")
    parser.add_argument("--post-roll-seconds", type=float, default=1.0)
    parser.add_argument(
        "--flat-json",
        type=Path,
        default=REPO_ROOT / "videos" / "flat.json",
        help="Flatdir manifest to regenerate after writing assets.",
    )
    parser.add_argument(
        "--skip-flatdir",
        action="store_true",
        help="Do not regenerate videos/flat.json after writing assets.",
    )
    parser.add_argument(
        "--no-render-lanes",
        action="store_false",
        dest="render_lanes",
        help="Disable lane separators and labels in the generated video.",
    )
    parser.set_defaults(render_lanes=True)
    return parser.parse_args()


def vector3(value: Any, field_name: str) -> list[float]:
    if not isinstance(value, list | tuple) or len(value) != 3:
        raise ValueError(f"camera.{field_name} must be a three-value array")
    numbers = [float(component) for component in value]
    if not all(math.isfinite(component) for component in numbers):
        raise ValueError(f"camera.{field_name} must contain finite numbers")
    return numbers


def default_side_pool_camera(pool_length: float, pool_width: float, aspect: float) -> dict[str, Any]:
    """Create a side-pool camera that sees the full racing surface."""
    camera_height = max(12.0, pool_width * 0.85)
    side_offset = max(24.0, pool_width * 1.25)
    return {
        "fov": 55,
        "aspect": round(aspect, 6),
        "near": 0.01,
        "far": 1000,
        "position": [
            round(pool_length * 0.5, 3),
            round(camera_height, 3),
            round(-side_offset, 3),
        ],
        "target": [
            round(pool_length * 0.5, 3),
            0.0,
            round(pool_width * 0.5, 3),
        ],
        "up": [0, 1, 0],
        "roll": 0,
    }


def create_reliable_video_writer(
    output_path: Path, fps: int, frame_width: int, frame_height: int
) -> tuple[cv2.VideoWriter, Path]:
    """Use MJPG first; OpenCV's macOS MP4 writer can open and still fail on write."""
    candidate_path = output_path if output_path.suffix.lower() == ".avi" else output_path.with_suffix(".avi")
    fourcc = cv2.VideoWriter_fourcc(*"MJPG")
    writer = cv2.VideoWriter(str(candidate_path), fourcc, fps, (frame_width, frame_height))
    if writer.isOpened():
        return writer, candidate_path
    writer.release()
    raise RuntimeError(f"Could not open an MJPG video writer for {candidate_path}")


def load_camera(path: Path | None, pool_length: float, pool_width: float, aspect: float) -> dict[str, Any]:
    if path is None:
        raw_camera = default_side_pool_camera(pool_length, pool_width, aspect)
    else:
        with path.open("r", encoding="utf-8") as handle:
            raw_camera = json.load(handle)

    camera = {
        "fov": float(raw_camera.get("fov", 55)),
        "aspect": float(raw_camera.get("aspect", aspect)),
        "near": float(raw_camera.get("near", 0.01)),
        "far": float(raw_camera.get("far", 1000)),
        "position": vector3(raw_camera.get("position"), "position"),
        "target": vector3(raw_camera.get("target"), "target"),
        "up": vector3(raw_camera.get("up", [0, 1, 0]), "up"),
        "roll": float(raw_camera.get("roll", 0)),
    }

    if not 1 < camera["fov"] < 179:
        raise ValueError("camera.fov must be between 1 and 179 degrees")
    if camera["aspect"] <= 0:
        raise ValueError("camera.aspect must be positive")
    if camera["near"] <= 0 or camera["far"] <= camera["near"]:
        raise ValueError("camera.near/far must define a valid positive depth range")

    return camera


def normalized(vector: np.ndarray, name: str) -> np.ndarray:
    norm = float(np.linalg.norm(vector))
    if norm <= 1e-9:
        raise ValueError(f"camera {name} vector is degenerate")
    return vector / norm


def camera_basis(camera: dict[str, Any]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    position = np.array(camera["position"], dtype=np.float64)
    target = np.array(camera["target"], dtype=np.float64)
    up = normalized(np.array(camera["up"], dtype=np.float64), "up")
    forward = normalized(target - position, "forward")
    right = normalized(np.cross(forward, up), "right")
    true_up = normalized(np.cross(right, forward), "true_up")

    roll_radians = math.radians(float(camera.get("roll", 0)))
    if abs(roll_radians) > 1e-12:
        cos_roll = math.cos(roll_radians)
        sin_roll = math.sin(roll_radians)
        right, true_up = (
            right * cos_roll + true_up * sin_roll,
            -right * sin_roll + true_up * cos_roll,
        )

    return right, true_up, forward


def project_world_points(
    points: np.ndarray,
    camera: dict[str, Any],
    frame_width: int,
    frame_height: int,
) -> np.ndarray:
    position = np.array(camera["position"], dtype=np.float64)
    right, true_up, forward = camera_basis(camera)
    relative = points.astype(np.float64) - position
    camera_x = relative @ right
    camera_y = relative @ true_up
    camera_z = relative @ forward

    if np.any(camera_z <= float(camera["near"])):
        raise ValueError("camera places at least one pool corner behind or too close to the near plane")

    focal_y = 1.0 / math.tan(math.radians(float(camera["fov"])) / 2.0)
    focal_x = focal_y / float(camera["aspect"])
    ndc_x = (camera_x / camera_z) * focal_x
    ndc_y = (camera_y / camera_z) * focal_y

    pixels = np.column_stack(
        [
            (ndc_x + 1.0) * 0.5 * frame_width,
            (1.0 - ndc_y) * 0.5 * frame_height,
        ]
    )
    return pixels.astype(np.float32)


def pool_corners_world(pool_length: float, pool_width: float) -> np.ndarray:
    return np.array(
        [
            [0.0, 0.0, pool_width],
            [pool_length, 0.0, pool_width],
            [pool_length, 0.0, 0.0],
            [0.0, 0.0, 0.0],
        ],
        dtype=np.float32,
    )


def camera_source_points(
    camera: dict[str, Any],
    pool_length: float,
    pool_width: float,
    frame_width: int,
    frame_height: int,
) -> list[list[float]]:
    projected = project_world_points(
        pool_corners_world(pool_length, pool_width),
        camera,
        frame_width,
        frame_height,
    )
    return [[round(float(x), 3), round(float(y), 3)] for x, y in projected]


def build_metadata(
    run_name: str,
    video_name: str,
    csv_name: str,
    source_csv_name: str,
    camera_name: str,
    camera: dict[str, Any],
    source_points: list[list[float]],
    year: str,
    competition: str,
    course_type: str,
    swimmer_sex: str,
    course_distance: str,
    course: str,
    fps: int,
    width: int,
    height: int,
    pool_length: float,
    pool_width: float,
    lane: str,
    swimmer_name: str,
    start_side: str,
) -> dict[str, Any]:
    return {
        "city": competition,
        "cup": competition,
        "distance": str(course_distance),
        "epreuve": course,
        "lignes": {lane: swimmer_name},
        "nage": course_type,
        "name": run_name,
        "ncamera": 1,
        "one_is_up": "False",
        "sexe": swimmer_sex,
        "start_side": start_side,
        "taille_piscine": [pool_length, pool_width],
        "csvFiles": [csv_name],
        "camera": camera,
        "cameraFile": camera_name,
        "sourceSportsdata": {
            "format": "basic_tracking",
            "csv": source_csv_name,
            "columns": ["frameId", "swimmerId", "eventId", "time", "distance"],
            "lane": lane,
        },
        "videos": [
            {
                "destPts": [
                    [0, REFERENCE_POOL_HEIGHT],
                    [REFERENCE_POOL_WIDTH, REFERENCE_POOL_HEIGHT],
                    [REFERENCE_POOL_WIDTH, 0],
                    [0, 0],
                ],
                "fps": fps,
                "height": height,
                "name": video_name,
                "one_is_up": "False",
                "srcPts": source_points,
                "start_flash": 0,
                "start_moment": 0,
                "start_side": start_side,
                "width": width,
            }
        ],
        "year": str(year),
    }


def render_tracking_video(
    output_path: Path,
    metadata: dict[str, Any],
    rows: list[Any],
    fps: int,
    post_roll_seconds: float,
    render_lanes: bool,
) -> Path:
    video = metadata["videos"][0]
    source_points = np.array(video["srcPts"], dtype=np.float32)
    pool_size = metadata.get("taille_piscine") or [50, 20]
    pool_length = float(pool_size[0])
    pool_width = float(pool_size[1])
    destination_points = np.array(
        [
            [0, pool_width],
            [pool_length, pool_width],
            [pool_length, 0],
            [0, 0],
        ],
        dtype=np.float32,
    )
    homography = cv2.getPerspectiveTransform(destination_points, source_points)
    frame_width = int(video["width"])
    frame_height = int(video["height"])
    total_seconds = rows[-1].time + max(0.0, post_roll_seconds)
    total_frames = max(rows[-1].frame_id + 1, int(math.ceil(total_seconds * fps)) + 1)
    lane_keys = sorted((metadata.get("lignes") or {}).keys())
    lane_index = lane_keys.index(metadata["sourceSportsdata"]["lane"]) if lane_keys else 0

    x_min, y_min = np.min(destination_points, axis=0)
    x_max, y_max = np.max(destination_points, axis=0)
    lane_height = (y_max - y_min) / max(1, len(lane_keys))
    lane_center_y = y_min + (lane_index + 0.5) * lane_height
    direction = 1 if metadata.get("start_side") == "left" else -1

    output_path.parent.mkdir(parents=True, exist_ok=True)
    writer, actual_output_path = create_reliable_video_writer(
        output_path=output_path,
        fps=fps,
        frame_width=frame_width,
        frame_height=frame_height,
    )

    base_frame = np.full((frame_height, frame_width, 3), 236, dtype=np.uint8)
    cv2.rectangle(base_frame, (0, 0), (frame_width, frame_height), (232, 232, 226), -1)
    draw_pool_surface(base_frame, destination_points, homography)
    if render_lanes:
        draw_lane_overlay(base_frame, metadata, destination_points, homography)

    for frame_index in range(total_frames):
        frame = base_frame.copy()
        time_seconds = frame_index / fps
        distance = interpolate_distance(rows, time_seconds)
        pool_x = pool_length - distance if metadata.get("start_side") == "left" else distance
        destination_x = pool_x_to_destination_x(pool_x, x_min, x_max, pool_length)

        draw_meter_swimmer(
            frame=frame,
            homography=homography,
            center_x=destination_x,
            center_y=lane_center_y,
            direction=direction,
            lane_index=lane_index,
            frame_index=frame_index,
            fps=fps,
        )
        cv2.putText(
            frame,
            f"{time_seconds:05.2f}s  {distance:04.1f}m",
            (42, frame_height - 36),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.78,
            (55, 55, 55),
            2,
            lineType=cv2.LINE_AA,
        )
        writer.write(frame)

    writer.release()
    return finalize_aquanote_video_output(actual_output_path, output_path)


def draw_meter_swimmer(
    frame: np.ndarray,
    homography: np.ndarray,
    center_x: float,
    center_y: float,
    direction: int,
    lane_index: int,
    frame_index: int,
    fps: int,
) -> None:
    stroke_phase = (frame_index / fps) * 2 * math.pi * 0.9 + lane_index * 0.35
    center_y += math.sin(stroke_phase) * 0.08
    cap_color = LANE_CAP_COLORS[lane_index % len(LANE_CAP_COLORS)]

    swimmer_shape = build_swimmer_polygon(
        center_x,
        center_y,
        direction,
        stroke_phase,
        body_length=2.25,
        body_width=0.62,
    )
    swimmer_shape_src = transform_points(swimmer_shape, homography).astype(np.int32)

    wake_points = np.array(
        [
            [center_x - direction * 0.8, center_y - 0.05],
            [center_x - direction * 1.6, center_y + math.sin(stroke_phase) * 0.08],
            [center_x - direction * 2.3, center_y - 0.03],
        ],
        dtype=np.float32,
    )
    wake_src = transform_points(wake_points, homography).astype(np.int32)
    cv2.polylines(frame, [wake_src], isClosed=False, color=(250, 250, 250), thickness=2)

    cv2.fillPoly(frame, [swimmer_shape_src], color=cap_color)
    cv2.polylines(frame, [swimmer_shape_src], isClosed=True, color=(35, 35, 35), thickness=1)

    head = build_circle_polygon(
        center_x + direction * 0.36,
        center_y - 0.03,
        radius=0.16,
    )
    head_src = transform_points(head, homography).astype(np.int32)
    cv2.fillPoly(frame, [head_src], color=(235, 225, 210))

    splash = build_circle_polygon(
        center_x + direction * 0.6,
        center_y - 0.07,
        radius=0.08 + 0.02 * math.sin(stroke_phase),
        point_count=12,
    )
    splash_src = transform_points(splash, homography).astype(np.int32)
    cv2.fillPoly(frame, [splash_src], color=(255, 255, 255))


def main() -> int:
    args = parse_args()
    if args.fps <= 0:
        raise ValueError("--fps must be positive")
    if args.width <= 0 or args.height <= 0:
        raise ValueError("--width and --height must be positive")
    if args.pool_length <= 0 or args.pool_width <= 0:
        raise ValueError("--pool-length and --pool-width must be positive")

    competition_name = derived_competition_name(args)
    run_name = derived_run_name(args)
    output_dir = resolve_output_dir(args, competition_name, run_name)
    output_dir.mkdir(parents=True, exist_ok=True)

    aspect = args.width / args.height
    camera = load_camera(args.camera.resolve() if args.camera else None, args.pool_length, args.pool_width, aspect)
    source_points = camera_source_points(
        camera=camera,
        pool_length=args.pool_length,
        pool_width=args.pool_width,
        frame_width=args.width,
        frame_height=args.height,
    )

    input_path = args.input.resolve() if args.input else ensure_default_input(output_dir)
    source_csv_path = copy_input(input_path, output_dir)
    rows = read_basic_tracking_csv(source_csv_path)

    camera_path = args.camera_output.resolve() if args.camera_output else output_dir / DEFAULT_CAMERA_NAME
    camera_path.parent.mkdir(parents=True, exist_ok=True)
    with camera_path.open("w", encoding="utf-8") as handle:
        json.dump(camera, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    csv_path = output_dir / f"{run_name}.csv"
    video_path = output_dir / f"{run_name}.mp4"
    metadata_path = output_dir / f"{run_name}.json"
    metadata = build_metadata(
        run_name=run_name,
        video_name=video_path.name,
        csv_name=csv_path.name,
        source_csv_name=source_csv_path.name,
        camera_name=camera_path.name,
        camera=camera,
        source_points=source_points,
        year=args.year,
        competition=args.competition,
        course_type=args.course_type,
        swimmer_sex=args.swimmer_sex,
        course_distance=args.distance,
        course=args.course,
        fps=args.fps,
        width=args.width,
        height=args.height,
        pool_length=args.pool_length,
        pool_width=args.pool_width,
        lane=args.lane,
        swimmer_name=args.swimmer_name,
        start_side=args.start_side,
    )

    aquanote_rows = build_aquanote_rows(
        rows=rows,
        lane=args.lane,
        swimmer_name=args.swimmer_name,
        pool_length=args.pool_length,
        pool_width=args.pool_width,
    )
    write_aquanote_csv(csv_path, aquanote_rows)
    actual_video_path = render_tracking_video(
        output_path=video_path,
        metadata=metadata,
        rows=rows,
        fps=args.fps,
        post_roll_seconds=args.post_roll_seconds,
        render_lanes=args.render_lanes,
    )
    metadata["videos"][0]["name"] = actual_video_path.name
    with metadata_path.open("w", encoding="utf-8") as handle:
        json.dump(metadata, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    print(f"competition: {competition_name}")
    print(f"run: {run_name}")
    print(f"sportsdata input: {display_path(source_csv_path)}")
    print(f"camera: {display_path(camera_path)}")
    print(f"Aquanote CSV: {display_path(csv_path)}")
    print(f"metadata: {display_path(metadata_path)}")
    print(f"video: {display_path(actual_video_path)}")
    if not args.skip_flatdir:
        flat_json_path = args.flat_json.resolve()
        if regenerate_flat_json(flat_json_path):
            print(f"flat.json: {display_path(flat_json_path)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
