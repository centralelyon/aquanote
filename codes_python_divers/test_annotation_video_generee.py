import cv2
import numpy as np
import json

# === Paramètres ===
json_path = r"./data/competition/course_exemple/course_exemple.json"
output_video = "carre_homographie.mp4"
carre_size = 10  # Taille du carré en pixels
nb_frames = 400  # Nombre de frames pour un aller-retour complet
fps = 50

# === Lecture du JSON ===
with open(json_path, "r", encoding="utf-8") as f:
    data = json.load(f)

video = data["videos"][0]
src_pts = np.array(video["srcPts"], dtype=np.float32)
dest_pts = np.array(video["destPts"], dtype=np.float32)

# === Calcul de l'homographie ===
H = cv2.getPerspectiveTransform(dest_pts, src_pts)

# === Définition du rectangle destination ===
x_min, y_min = np.min(dest_pts, axis=0)
x_max, y_max = np.max(dest_pts, axis=0)
rect_w = int(x_max - x_min)
rect_h = int(y_max - y_min)

# === Création de la vidéo ===
frame_w, frame_h = video["width"], video["height"]
try:
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
except AttributeError:
    fourcc = cv2.cv.FOURCC(*'mp4v')
out = cv2.VideoWriter(output_video, fourcc, fps, (frame_w, frame_h))

# === Génération des positions du carré ===
positions = []
for i in range(nb_frames):
    t = i / (nb_frames - 1)
    if t <= 0.5:
        alpha = t * 2  # 0 -> 1
    else:
        alpha = 2 - t * 2  # 1 -> 0 (retour)
    x = int(x_min + alpha * (x_max - x_min - carre_size))
    y = int(y_min + rect_h // 2 - carre_size // 2)
    positions.append((x, y, alpha))

# === Génération des frames ===
for i, (x, y, alpha) in enumerate(positions):
    # Rectangle destination (image blanche)
    img = np.ones((frame_h, frame_w, 3), dtype=np.uint8) * 255

    # Position du carré dans le rectangle destination
    carre_pts = np.array([
        [x, y],
        [x + carre_size, y],
        [x + carre_size, y + carre_size],
        [x, y + carre_size]
    ], dtype=np.float32)

    # Appliquer l'homographie pour obtenir la position dans l'image source
    carre_pts_src = cv2.perspectiveTransform(carre_pts[None, :, :], H)[0]

    # Déterminer la couleur (rouge clignotant à chaque 20%)
    percent = int(alpha * 100)
    if percent % 20 == 0:
        color = (0, 0, 255)  # Rouge (BGR)
    else:
        color = (0, 255, 0)  # Vert (BGR)

    # Dessiner le carré dans l'image source
    pts = carre_pts_src.astype(np.int32)
    cv2.polylines(img, [pts], isClosed=True, color=color, thickness=3)
    cv2.fillPoly(img, [pts], color=color if percent % 20 == 0 else (0, 255, 0))

    out.write(img)

out.release()
print(f"Vidéo générée : {output_video}")