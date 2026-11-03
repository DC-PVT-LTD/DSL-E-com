import cv2
import numpy as np

img = cv2.imread(r'C:\Users\Yehara Kobbagala\.gemini\antigravity\brain\4fee825d-9a8a-48ab-95a2-debad91a5b78\.user_uploaded\media_1793719561790_e7bb6bb3.jpg')
h, w, _ = img.shape

# Find boundary between cream and blue in y=45..68
ys = []
for x in range(w):
    col = img[45:68, x]
    # compute r - b
    diff = col[:, 2].astype(int) - col[:, 0].astype(int)
    blue_idx = np.where(diff < -15)[0]
    if len(blue_idx) > 0:
        y_trans = 45 + blue_idx[0]
    else:
        y_trans = 58
    ys.append(y_trans)

ys_smooth = np.convolve(ys, np.ones(5)/5, mode='same')
ys_smooth[0] = ys[0]
ys_smooth[-1] = ys[-1]

# Convert to SVG path:
# viewBox: 0 0 1024 25 (relative to y=45)
path_d = f"M 0 0 L {w} 0 L {w} {ys_smooth[-1] - 45:.1f} "
for x in range(w-1, -1, -4):
    path_d += f"L {x} {ys_smooth[x] - 45:.1f} "
path_d += "Z"

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} 25" preserveAspectRatio="none" class="w-full block">
  <path d="{path_d}" fill="#FFF8ED" />
</svg>'''

with open('frontend/public/images/hero/torn_header_edge.svg', 'w') as f:
    f.write(svg)

print('Generated torn_header_edge.svg successfully!')

