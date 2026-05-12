"""Generate a synthetic square-following video from pool homography metadata."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np


REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_METADATA_PATH = (
    REPO_ROOT
    / "courses_demo"
    / "2025_courses_demo"
    / "2025_courses_demo_translation_carre_50_finale"
    / "2025_courses_demo_translation_carre_50_finale.json"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Generate a synthetic video of a moving square using the homography "
            "defined in an Aquanote race metadata JSON file."
        )
    )
    parser.add_argument(
        "--metadata",
        type=Path,
        default=DEFAULT_METADATA_PATH,
        help="Path to the race metadata JSON file.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("output_video.mp4"),
        help="Output video path.",
    )
    parser.add_argument(
        "--square-size",
        type=int,
        default=10,
        help="Square size in pixels in destination space.",
    )
    parser.add_argument(
        "--frame-count",
        type=int,
        default=400,
        help="Number of frames for one forward-and-back motion cycle.",
    )
    parser.add_argument(
        "--fps",
        type=int,
        default=50,
        help="Frames per second for the generated video.",
    )
    parser.add_argument(
        "--video-index",
        type=int,
        default=0,
        help="Index of the video entry to use from the metadata file.",
    )
    parser.add_argument(
        "--render-lanes",
        action="store_true",
        help="Render swimming lane separators and lane labels on each generated frame.",
    )
    return parser.parse_args()


def load_video_metadata(metadata_path: Path, video_index: int) -> tuple[dict, dict]:
    metadata_path = metadata_path.resolve()
    if not metadata_path.is_file():
        raise FileNotFoundError(f"Metadata file not found: {metadata_path}")

    with metadata_path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    videos = data.get("videos")
    if not isinstance(videos, list) or not videos:
        raise ValueError(f"No video entries found in metadata file: {metadata_path}")

    if video_index < 0 or video_index >= len(videos):
        raise IndexError(
            f"Video index {video_index} is out of range for metadata file: {metadata_path}"
        )

    video = videos[video_index]
    required_keys = ("srcPts", "destPts", "width", "height")
    missing_keys = [key for key in required_keys if key not in video]
    if missing_keys:
        raise KeyError(
            f"Metadata is missing required keys {missing_keys} for video index {video_index}"
        )

    return data, video


def build_square_positions(
    destination_points: np.ndarray, square_size: int, frame_count: int
) -> list[tuple[int, int, float]]:
    if square_size <= 0:
        raise ValueError("--square-size must be a positive integer")
    if frame_count < 2:
        raise ValueError("--frame-count must be at least 2")

    x_min, y_min = np.min(destination_points, axis=0)
    x_max, y_max = np.max(destination_points, axis=0)
    rect_height = int(y_max - y_min)

    positions: list[tuple[int, int, float]] = []
    for frame_index in range(frame_count):
        t = frame_index / (frame_count - 1)
        progress = t * 2 if t <= 0.5 else 2 - t * 2
        x = int(x_min + progress * (x_max - x_min - square_size))
        y = int(y_min + rect_height // 2 - square_size // 2)
        positions.append((x, y, progress))

    return positions


def create_video_writer(
    output_path: Path, fps: int, frame_width: int, frame_height: int
) -> tuple[cv2.VideoWriter, Path]:
    candidates = [
        (output_path, "mp4v"),
        (output_path.with_suffix(".avi"), "MJPG"),
    ]

    for candidate_path, codec in candidates:
        fourcc = cv2.VideoWriter_fourcc(*codec)
        writer = cv2.VideoWriter(str(candidate_path), fourcc, fps, (frame_width, frame_height))
        if writer.isOpened():
            return writer, candidate_path
        writer.release()

    raise RuntimeError(
        "Could not open an output video writer. Tried: "
        + ", ".join(f"{path} ({codec})" for path, codec in candidates)
    )


def transform_points(points: np.ndarray, homography: np.ndarray) -> np.ndarray:
    return cv2.perspectiveTransform(points[None, :, :], homography)[0]


def draw_lane_overlay(
    frame: np.ndarray,
    metadata: dict,
    destination_points: np.ndarray,
    homography: np.ndarray,
) -> None:
    lane_names = metadata.get("lignes") or {}
    lane_keys = sorted(lane_names.keys())
    lane_count = len(lane_keys)
    if lane_count == 0:
        return

    x_min, y_min = np.min(destination_points, axis=0)
    x_max, y_max = np.max(destination_points, axis=0)
    lane_height = (y_max - y_min) / lane_count
    line_color = (255, 170, 0)
    text_color = (40, 40, 40)

    for lane_index in range(lane_count + 1):
        y = y_min + lane_index * lane_height
        lane_line = np.array([[x_min, y], [x_max, y]], dtype=np.float32)
        lane_line_src = transform_points(lane_line, homography).astype(np.int32)
        cv2.line(
            frame,
            tuple(lane_line_src[0]),
            tuple(lane_line_src[1]),
            line_color,
            2,
            lineType=cv2.LINE_AA,
        )

    for lane_index, lane_key in enumerate(lane_keys):
        lane_name = str(lane_names[lane_key])
        label_point = np.array(
            [[x_min + 15, y_min + (lane_index + 0.5) * lane_height]],
            dtype=np.float32,
        )
        label_point_src = transform_points(label_point, homography)[0].astype(np.int32)
        cv2.putText(
            frame,
            lane_name,
            tuple(label_point_src),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            text_color,
            2,
            lineType=cv2.LINE_AA,
        )


def generate_video(
    metadata_path: Path,
    output_path: Path,
    square_size: int,
    frame_count: int,
    fps: int,
    video_index: int,
    render_lanes: bool,
) -> Path:
    metadata, video = load_video_metadata(metadata_path, video_index)
    source_points = np.array(video["srcPts"], dtype=np.float32)
    destination_points = np.array(video["destPts"], dtype=np.float32)

    homography = cv2.getPerspectiveTransform(destination_points, source_points)
    frame_width = int(video["width"])
    frame_height = int(video["height"])

    output_path.parent.mkdir(parents=True, exist_ok=True)
    writer, actual_output_path = create_video_writer(
        output_path=output_path,
        fps=fps,
        frame_width=frame_width,
        frame_height=frame_height,
    )

    positions = build_square_positions(destination_points, square_size, frame_count)

    for x, y, progress in positions:
        frame = np.full((frame_height, frame_width, 3), 255, dtype=np.uint8)
        if render_lanes:
            draw_lane_overlay(frame, metadata, destination_points, homography)

        square_points = np.array(
            [
                [x, y],
                [x + square_size, y],
                [x + square_size, y + square_size],
                [x, y + square_size],
            ],
            dtype=np.float32,
        )

        source_square_points = cv2.perspectiveTransform(square_points[None, :, :], homography)[0]

        percent = int(progress * 100)
        color = (0, 0, 255) if percent % 20 == 0 else (0, 255, 0)

        polygon = source_square_points.astype(np.int32)
        cv2.polylines(frame, [polygon], isClosed=True, color=color, thickness=3)
        cv2.fillPoly(frame, [polygon], color=color)
        writer.write(frame)

    writer.release()
    return actual_output_path.resolve()


def main() -> int:
    args = parse_args()
    output_path = generate_video(
        metadata_path=args.metadata,
        output_path=args.output,
        square_size=args.square_size,
        frame_count=args.frame_count,
        fps=args.fps,
        video_index=args.video_index,
        render_lanes=args.render_lanes,
    )
    print(f"Video generated: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
