"""Make a sticker's Warm Yellow background (#FFF5C5) transparent, keeping anti-aliased edges smooth.

Used to make static/merchandise/Sticker/transparent/ from the originals in static/merchandise/Sticker/,
for event pages, which have a white background (see data/stickers.yaml).

  python3 scripts/remove-sticker-background.py static/merchandise/Sticker/transparent \
      static/merchandise/Sticker/*.png

How it works:
  1. Pixels within TOLERANCE of the background color become fully transparent.
  2. Pixels within EDGE_BAND px of those are "unmixed" from the background (like GIMP's Color to Alpha),
     so the soft edge between artwork and background becomes partial transparency instead of a yellow halo.
Needs Pillow, NumPy and SciPy (pip install pillow numpy scipy).
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

BACKGROUND = np.array([255, 245, 197], dtype=float)  # Warm Yellow, the brand background
TOLERANCE = 8   # color distance (0-441) still counted as pure background
EDGE_BAND = 3   # px around the background that get unmixed


def remove_background(path):
    image = np.asarray(Image.open(path).convert("RGBA")).astype(float)
    rgb, alpha = image[..., :3], image[..., 3] / 255.0

    distance = np.sqrt(((rgb - BACKGROUND) ** 2).sum(axis=-1))
    background = distance <= TOLERANCE
    edge = ndimage.binary_dilation(background, iterations=EDGE_BAND) & ~background

    # Color to alpha: the smallest opacity that explains the pixel as artwork drawn over the background.
    above = np.where(rgb > BACKGROUND, (rgb - BACKGROUND) / np.maximum(255 - BACKGROUND, 1e-6), 0)
    below = np.where(rgb < BACKGROUND, (BACKGROUND - rgb) / np.maximum(BACKGROUND, 1e-6), 0)
    edge_alpha = np.clip(np.maximum(above, below).max(axis=-1), 0, 1)
    edge_rgb = np.clip(BACKGROUND + (rgb - BACKGROUND) / np.maximum(edge_alpha, 1e-6)[..., None], 0, 255)

    new_rgb = np.where(edge[..., None], edge_rgb, rgb)
    new_alpha = np.where(background, 0, np.where(edge, edge_alpha, 1.0)) * alpha
    pixels = np.dstack([new_rgb, new_alpha * 255]).round().astype(np.uint8)
    return Image.fromarray(pixels, "RGBA")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    out_dir = Path(sys.argv[1])
    out_dir.mkdir(parents=True, exist_ok=True)
    for path in map(Path, sys.argv[2:]):
        remove_background(path).save(out_dir / path.name, optimize=True)
        print("saved", out_dir / path.name)
