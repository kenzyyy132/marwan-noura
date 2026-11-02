"""
Brings the original invitation's own decorative artwork into the wine-red palette.

  python tools/recolor_original.py "D:/WAAD & MUHAMMED"

- The watercolour garlands (assets/card/garland-*.webp): every pink blossom
  becomes wine red / burgundy; leaves, stems and gold stay as painted.
- The background damask (assets/pattern.webp): the sage tile is redrawn as
  antique gold on champagne.
Requires: opencv-python-headless, numpy.
"""
import os
import sys

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(ROOT), "WAAD & MUHAMMED")


def imread(path):
    data = np.fromfile(path, np.uint8)
    return cv2.imdecode(data, cv2.IMREAD_UNCHANGED)


def imwrite(path, img, params=()):
    ok, buf = cv2.imencode(os.path.splitext(path)[1], img, list(params))
    assert ok, path
    buf.tofile(path)


def pink_to_wine(bgra):
    """Re-ink pink/rose pixels as wine red, keeping their painted light and shade."""
    bgr = bgra[..., :3]
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    h, s, v = hsv[..., 0], hsv[..., 1] / 255, hsv[..., 2] / 255
    # pink lives at hue 150..180 and 0..8 (OpenCV's 0..180 scale), with some colour in it
    pinkness = np.clip((s - 0.08) / 0.12, 0, 1) * ((h >= 150) | (h <= 8))
    pinkness = cv2.GaussianBlur(pinkness.astype(np.float32), (0, 0), 0.8)
    # wine: hue ~350°, rich saturation, darker value; light petals keep a little of their glow
    wine_h = np.full_like(h, 172.0)
    wine_s = np.clip(0.55 + s * 0.45, 0, 1) * 255
    wine_v = np.clip(0.12 + v * 0.44, 0, 1) * 255
    out = cv2.cvtColor(np.dstack([wine_h, wine_s, wine_v]).astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)
    mixed = bgr.astype(np.float32) * (1 - pinkness[..., None]) + out * pinkness[..., None]
    res = bgra.copy()
    res[..., :3] = np.clip(mixed, 0, 255).astype(np.uint8)
    return res


def main():
    card_src = os.path.join(SRC, "assets", "card")
    card_out = os.path.join(ROOT, "assets", "card")
    for name in ("garland-left", "garland-right", "garland-left-arch", "garland-right-arch"):
        img = imread(os.path.join(card_src, f"{name}.webp"))
        imwrite(os.path.join(card_out, f"{name}.webp"), pink_to_wine(img), [cv2.IMWRITE_WEBP_QUALITY, 90])
        print(name, img.shape[1::-1])

    # damask: darkness of each pixel against the stone becomes gold ink on champagne
    tile = imread(os.path.join(SRC, "assets", "pattern.webp"))[..., :3].astype(np.float32)
    lum = cv2.cvtColor(tile.astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)
    bg = np.percentile(lum, 70)
    ink = np.clip((bg - lum) / max(1.0, bg - np.percentile(lum, 1)), 0, 1)[..., None]
    champagne = np.array([0xD3, 0xE6, 0xF5], np.float32)   # #F5E6D3
    gold = np.array([0x5B, 0x8D, 0xB8], np.float32)        # #B88D5B, antique gold
    out = champagne * (1 - ink * 0.4) + gold * (ink * 0.4)
    imwrite(os.path.join(ROOT, "assets", "pattern.webp"), out.astype(np.uint8), [cv2.IMWRITE_WEBP_QUALITY, 82])
    print("pattern", tile.shape[1::-1])


if __name__ == "__main__":
    main()
