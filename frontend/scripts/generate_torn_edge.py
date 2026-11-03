import math
import random

# We generate a natural deckled torn paper edge across 1024 width
random.seed(42)

w = 1200
points = []
num_points = 240
step = w / num_points

for i in range(num_points + 1):
    x = i * step
    # Base wave
    wave1 = 4.0 * math.sin(x * 0.015)
    wave2 = 2.5 * math.sin(x * 0.035 + 1.2)
    wave3 = 1.5 * math.sin(x * 0.08 + 0.5)
    # Fine paper tear jitter
    jitter = random.uniform(-1.0, 1.0)
    
    y = 12.0 + wave1 + wave2 + wave3 + jitter
    points.append((x, y))

# Path string
path_d = f"M 0 0 L {w} 0 L {w} {points[-1][1]:.2f} "
for x, y in reversed(points):
    path_d += f"L {x:.1f} {y:.2f} "
path_d += "Z"

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} 24" preserveAspectRatio="none" class="w-full h-4 sm:h-5 block filter drop-shadow-[0_4px_6px_rgba(16,40,93,0.06)]">
  <path d="{path_d}" fill="#FFF8ED" />
</svg>'''

with open('frontend/public/images/hero/natural_torn_edge.svg', 'w') as f:
    f.write(svg)

print('Natural torn edge SVG generated!')

