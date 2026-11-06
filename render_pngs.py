import os
import subprocess

out_dir = os.path.abspath(r'frontend/public/images/find-my-stationery')
chrome_path = r'C:\Program Files\Google\Chrome\Application\chrome.exe'

svg_files = [
    'star_badge', 'grade_1_2', 'grade_3_9', 'grade_ol',
    'grade_al_science', 'grade_al_commerce', 'coin_purse',
    'gold_coins', 'clipboard', 'shopping_basket'
]

html_template = '''<!DOCTYPE html>
<html>
<head>
<style>
body {{ margin: 0; padding: 0; background: transparent; width: 256px; height: 256px; display: flex; align-items: center; justify-content: center; }}
img {{ width: 240px; height: 240px; object-fit: contain; }}
</style>
</head>
<body>
<img src="{svg_path}" />
</body>
</html>'''

for name in svg_files:
    svg_abs = os.path.join(out_dir, f'{name}.svg').replace('\\', '/')
    html_content = html_template.format(svg_path='file:///' + svg_abs)
    temp_html = os.path.abspath(f'temp_{name}.html')
    with open(temp_html, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    png_out = os.path.join(out_dir, f'{name}.png')
    cmd = [
        chrome_path,
        '--headless',
        '--disable-gpu',
        '--default-background-color=00000000',
        '--window-size=256,256',
        f'--screenshot={png_out}',
        f'file:///{temp_html}'
    ]
    subprocess.run(cmd, check=True)
    if os.path.exists(temp_html):
        os.remove(temp_html)
    print(f'Rendered crystal clear PNG: {name}.png')

print('All PNGs updated with high-resolution vector renders!')
