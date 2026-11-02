"""
Derives the website's image layers from the invitation artwork in assets/.

  python tools/build_assets.py

Requires: opencv-python-headless, numpy.
Input : assets/marwan*.png                                (never modified)
        assets/Ornate Frame Children's Ring Proposal.png  (never modified)
Output: assets/card/*, assets/gate/*, assets/og-image.jpg, assets/favicon.png,
        assets/apple-touch-icon.png
(The garlands and background pattern come from the original invitation, recoloured by
tools/recolor_original.py.)

The arch on the artwork is a single flat colour (#511817), so the lettering
and the gold portrait frame can be lifted off as transparent layers and the
arch re-filled underneath. That lets the website animate each line of the real
artwork independently.
"""
import glob
import json
import os
import sys

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = (glob.glob(os.path.join(ROOT, "assets", "marwan*.png")) or [os.path.join(ROOT, "assets", "marwan & noura.png")])[0]
FRAME_SRC = glob.glob(os.path.join(ROOT, "assets", "Ornate Frame*.png"))
OUT = os.path.join(ROOT, "assets", "card")
GATE = os.path.join(ROOT, "assets", "gate")
ARCH_BGR = np.array([23, 24, 81], dtype=np.float32)  # #511817

# Boxes in original-artwork pixels: (x0, y0, x1, y1)
LAYERS = {
    "bismillah": (1235, 1165, 2690, 1500),
    "portrait": (740, 1540, 3125, 3390),
    "invite-1": (1240, 3470, 2620, 3655),
    "invite-2": (1260, 3705, 2610, 3890),
    "ornament": (1150, 3925, 2770, 4150),
    "date": (1450, 4195, 2460, 4340),
    "names": (1360, 4390, 2550, 4560),
    "closing": (1050, 4725, 2800, 4870),
}

PLATE_WIDTHS = (1600, 900)
PAGE_BGR = np.array([0xD3, 0xE6, 0xF5], dtype=np.float32)  # #F5E6D3, the page's champagne
LAYER_SCALE = 1600 / 3875  # layers exported at the 1600px plate scale


def unmix_arch(crop):
    """BGRA: anything that isn't the flat arch colour, un-blended from it."""
    px = crop.astype(np.float32)
    dist = np.linalg.norm(px - ARCH_BGR, axis=2)
    alpha = np.clip((dist - 14) / 110, 0, 1)
    a = np.clip(alpha, 0.05, 1)[..., None]
    fg = np.clip((px - ARCH_BGR * (1 - a)) / a, 0, 255)
    return np.dstack([fg, alpha * 255]).astype(np.uint8)


def drop_border_specks(rgba, keep_ratio=0.02):
    """Remove fragments of neighbouring artwork (a petal, a leaf tip) caught at the crop's edge."""
    solid = (rgba[..., 3] > 20).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(solid, connectivity=8)
    h, w = solid.shape
    total = max(1, solid.sum())
    for i in range(1, n):
        x, y, bw, bh, area = stats[i]
        touches = x == 0 or y == 0 or x + bw >= w or y + bh >= h
        if touches and area < keep_ratio * total:
            rgba[labels == i, 3] = 0
    return rgba


def imread(path, flags=cv2.IMREAD_COLOR):
    """cv2.imread that copes with non-ASCII paths on Windows."""
    data = np.fromfile(path, np.uint8)
    return cv2.imdecode(data, flags) if data.size else None


def imwrite(path, img, params=()):
    ok, buf = cv2.imencode(os.path.splitext(path)[1], img, list(params))
    if not ok:
        sys.exit(f"Cannot encode {path}")
    buf.tofile(path)


def scaled(img, scale):
    h, w = img.shape[:2]
    return cv2.resize(img, (max(1, round(w * scale)), max(1, round(h * scale))), interpolation=cv2.INTER_AREA)


def main():
    art = imread(SRC)
    if art is None:
        sys.exit(f"Cannot read {SRC}")
    H, W = art.shape[:2]
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(GATE, exist_ok=True)
    meta = {"width": W, "height": H, "layers": {}}

    plate = art.copy()
    for name, (x0, y0, x1, y1) in LAYERS.items():
        crop = art[y0:y1, x0:x1]
        rgba = drop_border_specks(unmix_arch(crop), {"portrait": 0.04, "bismillah": 0.1}.get(name, 0.02))
        if name == "portrait":
            # keep only the frame and photo: everything the frame encloses is opaque
            solid = (rgba[..., 3] > 40).astype(np.uint8)
            n, lbl, st, _ = cv2.connectedComponentsWithStats(solid, connectivity=8)
            biggest = 1 + int(np.argmax(st[1:, 4]))
            body = (lbl == biggest).astype(np.uint8)
            cnts, _ = cv2.findContours(body, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
            filled = np.zeros_like(body)
            cv2.drawContours(filled, cnts, -1, 1, -1)
            core = cv2.erode(filled, np.ones((7, 7), np.uint8)) > 0
            rgba[core, :3] = crop[core]  # the photo's own colours (dark hair is close to the arch colour)
            rgba[..., 3] = np.where(filled > 0, np.where(core, 255, rgba[..., 3]), 0)
        # re-fill the arch where the layer was lifted off
        lifted = cv2.dilate((rgba[..., 3] > 0).astype(np.uint8), np.ones((15, 15), np.uint8)) > 0
        plate[y0:y1, x0:x1][lifted] = ARCH_BGR.astype(np.uint8)
        if name == "portrait":  # a photograph: WebP keeps it light
            imwrite(os.path.join(OUT, "portrait.webp"), scaled(rgba, LAYER_SCALE), [cv2.IMWRITE_WEBP_QUALITY, 88])
        else:
            imwrite(os.path.join(OUT, f"{name}.png"), scaled(rgba, LAYER_SCALE))
        meta["layers"][name] = {
            "left": round(x0 / W * 100, 3), "top": round(y0 / H * 100, 3),
            "width": round((x1 - x0) / W * 100, 3), "height": round((y1 - y0) / H * 100, 3),
            "px": [round((x1 - x0) * LAYER_SCALE), round((y1 - y0) * LAYER_SCALE)],
        }

    # The card's white paper takes on the page's champagne (as if printed on it), so the
    # card sits in the page the way the original did instead of as a white rectangle.
    # The wine arch itself is left untouched.
    arch = (np.abs(plate.astype(np.float32) - ARCH_BGR).sum(2) < 40).astype(np.uint8)
    arch = cv2.morphologyEx(arch, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
    keep = cv2.GaussianBlur(arch.astype(np.float32), (0, 0), 3)[..., None]
    tinted = plate.astype(np.float32) * (PAGE_BGR / 255)
    plate = np.clip(plate * keep + tinted * (1 - keep), 0, 255).astype(np.uint8)

    for w in PLATE_WIDTHS:
        imwrite(os.path.join(OUT, f"plate-{w}.webp"), scaled(plate, w / W), [cv2.IMWRITE_WEBP_QUALITY, 86])
        imwrite(os.path.join(OUT, f"invitation-{w}.webp"), scaled(art, w / W), [cv2.IMWRITE_WEBP_QUALITY, 88])
    imwrite(os.path.join(OUT, "invitation-1600.jpg"), scaled(art, 1600 / W), [cv2.IMWRITE_JPEG_QUALITY, 88])

    # Opening screen: the ring-proposal portrait, kept exactly as supplied, just web-sized
    if FRAME_SRC:
        frame = imread(FRAME_SRC[0], cv2.IMREAD_UNCHANGED)
        for w in (1400, 800):
            imwrite(os.path.join(GATE, f"ring-proposal-{w}.webp"), scaled(frame, w / frame.shape[1]), [cv2.IMWRITE_WEBP_QUALITY, 90])
        meta["gate"] = list(frame.shape[1::-1])

    # Open Graph image (1200x630): artwork centred on the card's own ivory
    og = np.full((630, 1200, 3), (250, 249, 252), np.uint8)
    card = scaled(art, 600 / H)
    ox = (1200 - card.shape[1]) // 2
    og[15:15 + card.shape[0], ox:ox + card.shape[1]] = card
    imwrite(os.path.join(ROOT, "assets", "og-image.jpg"), og, [cv2.IMWRITE_JPEG_QUALITY, 86])

    # Favicon: a rose from the garland on the arch's wine colour
    rose = art[880:1310, 560:990]  # one full-blown rose on the left arm
    icon = np.zeros((512, 512, 4), np.uint8)
    cv2.circle(icon, (256, 256), 255, (*ARCH_BGR.astype(int).tolist(), 255), -1, cv2.LINE_AA)
    disc = np.zeros((512, 512), np.uint8)
    cv2.circle(disc, (256, 256), 205, 255, -1, cv2.LINE_AA)
    r = cv2.resize(rose, (410, 410), interpolation=cv2.INTER_AREA)
    roi = icon[51:461, 51:461]
    m = disc[51:461, 51:461, None].astype(np.float32) / 255
    roi[..., :3] = (roi[..., :3] * (1 - m) + r * m).astype(np.uint8)
    cv2.circle(icon, (256, 256), 207, (100, 167, 201, 255), 6, cv2.LINE_AA)  # gold ring
    imwrite(os.path.join(ROOT, "assets", "favicon.png"), scaled(icon, 192 / 512))
    imwrite(os.path.join(ROOT, "assets", "apple-touch-icon.png"), scaled(icon, 180 / 512))

    with open(os.path.join(OUT, "layers.json"), "w") as f:
        json.dump(meta, f, indent=2)
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
