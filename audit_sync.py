with open('backend/prisma/sync-dsl-products.ts', 'r', encoding='utf-8') as f:
    text = f.read()

import re
cat_counts = {}
for m in re.finditer(r'"categoryId":\s*"([^"]+)"', text):
    cid = m.group(1)
    cat_counts[cid] = cat_counts.get(cid, 0) + 1

print('Categories in sync-dsl-products.ts:')
for cid, cnt in sorted(cat_counts.items(), key=lambda x: -x[1]):
    print(f'  {cid:<25} : {cnt}')

