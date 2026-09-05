"""Create cropped, half-resolution runtime UI assets from their editable sources.

The renderer only uses the regions defined below. Cropping removes unused canvas
area; half-resolution still leaves at least one source pixel per rendered desktop
pixel for every runtime frame. Originals are intentionally kept as editable source.
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "ui"
OUTPUT = SOURCE / "runtime"

ASSETS = {
    "upgrade-card-frame-v2.png": (38, 46, 1909, 683),
    "upgrade-card-frame-rocket-v1.png": (10, 4, 1963, 781),
    "upgrade-card-frame-purple-v1.png": (0, 0, 1908, 809),
    "boss-alert-frame-v1.png": (24, 170, 2123, 369),
    "title-command-panel-v1.png": (16, 12, 1743, 853),
    "start-run-button-frame-v1.png": (28, 110, 2117, 475),
}


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, (x, y, width, height) in ASSETS.items():
        with Image.open(SOURCE / name) as source:
            crop = source.crop((x, y, x + width, y + height))
            size = ((width + 1) // 2, (height + 1) // 2)
            optimized = crop.resize(size, Image.Resampling.LANCZOS)
            optimized.save(OUTPUT / name, optimize=True)
            print(f"{name}: {width}x{height} -> {size[0]}x{size[1]}")


if __name__ == "__main__":
    main()
