import sys, os
from PIL import Image

SRC = r"<WORKSPACE>\tools\storyboard-1.jpg"
OUT = r"<WORKSPACE>\tools\frames"
os.makedirs(OUT, exist_ok=True)

img = Image.open(SRC)
W, H = img.size
COLS, ROWS = 10, 10
cw, ch = W // COLS, H // ROWS

# frame index i (0-based) -> cell (row, col) row-major
def cell(i, scale=3):
    r, c = divmod(i, COLS)
    box = (c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)
    im = img.crop(box)
    return im.resize((cw * scale, ch * scale), Image.LANCZOS)

def sheet(indices, scale=2, tag="sheet"):
    cols = 2
    rows = (len(indices) + cols - 1) // cols
    cs = cell(indices[0], scale)
    sw, sh = cs.size
    canvas = Image.new("RGB", (sw * cols, sh * rows), "white")
    for k, i in enumerate(indices):
        r, c = divmod(k, cols)
        canvas.paste(cell(i, scale), (c * sw, r * sh))
    p = os.path.join(OUT, f"{tag}.png")
    canvas.save(p)
    print(p, canvas.size)

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "sheet"
    if mode == "sheet":
        idx = [int(x) for x in sys.argv[2].split(",")]
        tag = sys.argv[3] if len(sys.argv) > 3 else "sheet"
        scale = int(sys.argv[4]) if len(sys.argv) > 4 else 2
        sheet(idx, scale, tag)
    else:
        idx = int(sys.argv[2])
        scale = int(sys.argv[3]) if len(sys.argv) > 3 else 3
        p = os.path.join(OUT, f"f{idx:02d}.png")
        cell(idx, scale).save(p)
        print(p, cell(idx, scale).size)
