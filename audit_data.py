import urllib.request
import json

# Fetch products
rp = urllib.request.urlopen('http://localhost:4000/api/v1/products?limit=100')
prods = json.loads(rp.read().decode('utf-8')).get('data', [])

# Fetch categories
rc = urllib.request.urlopen('http://localhost:4000/api/v1/categories')
cats = json.loads(rc.read().decode('utf-8')).get('data', [])
cat_map = {c['id']: c for c in cats}

print(f'Total categories: {len(cats)}')
print(f'Total products: {len(prods)}\n')

# Diagnostic table data
print('=== CATEGORY DIAGNOSTIC TABLE ===')
print(f'{"Category Name":<25} | {"Category ID":<22} | {"Slug":<22} | {"itemCount":<10}')
print('-'*85)
for c in cats:
    print(f'{c["name"]:<25} | {c["id"]:<22} | {c["slug"]:<22} | {c.get("itemCount", 0):<10}')

print('\n=== PRODUCT AUDIT ACROSS ALL CATEGORIES ===')
for c in cats:
    cat_prods = [p for p in prods if p.get('categoryId') == c['id']]
    print(f'\nCategory: {c["name"]} ({c["id"]}) -> {len(cat_prods)} products')
    for p in cat_prods:
        print(f'  - [{p["id"]}] {p["name"]} (SKU: {p.get("sku")})')

print('\n=== KEYWORD / INTENT MISMATCH DETECTION ===')
for p in prods:
    c_id = p.get('categoryId')
    c_name = cat_map.get(c_id, {}).get('name', 'UNKNOWN')
    name = p.get('name', '').lower()
    
    # Check for correction
    if 'correction' in name and c_id != 'cat-correction-pens':
        print(f'MISMATCH DETECTED: Product "{p["name"]}" is in "{c_name}" ({c_id}), but category "Correction Pens" (cat-correction-pens) exists!')
    # Check for banner paint
    if 'banner' in name and c_id != 'cat-banner-paint':
        print(f'MISMATCH DETECTED: Product "{p["name"]}" is in "{c_name}" ({c_id}), but category "Banner Paint" (cat-banner-paint) exists!')
    # Check for highlighter
    if 'highlight' in name and c_id != 'cat-highlighters':
        print(f'MISMATCH DETECTED: Product "{p["name"]}" is in "{c_name}" ({c_id}), but category "Highlighters" (cat-highlighters) exists!')
    # Check for diaper
    if 'diaper' in name and c_id != 'cat-diapers':
        print(f'MISMATCH DETECTED: Product "{p["name"]}" is in "{c_name}" ({c_id}), but category "Diapers" (cat-diapers) exists!')
    # Check for sharpener
    if 'sharpener' in name and c_id != 'cat-sharpeners':
        print(f'MISMATCH DETECTED: Product "{p["name"]}" is in "{c_name}" ({c_id}), but category "Sharpeners" (cat-sharpeners) exists!')
    # Check for eraser
    if 'eraser' in name and c_id != 'cat-erasers':
        print(f'MISMATCH DETECTED: Product "{p["name"]}" is in "{c_name}" ({c_id}), but category "Erasers" (cat-erasers) exists!')
    # Check for ruler
    if 'ruler' in name and c_id != 'cat-rulers':
        print(f'MISMATCH DETECTED: Product "{p["name"]}" is in "{c_name}" ({c_id}), but category "Rulers" (cat-rulers) exists!')
    # Check for calculator
    if 'calculator' in name and c_id != 'cat-calculators':
        print(f'MISMATCH DETECTED: Product "{p["name"]}" is in "{c_name}" ({c_id}), but category "Calculators" (cat-calculators) exists!')
    # Check for tape
    if 'tape' in name and c_id != 'cat-tapes':
        print(f'MISMATCH DETECTED: Product "{p["name"]}" is in "{c_name}" ({c_id}), but category "Tapes & Adhesives" (cat-tapes) exists!')
    # Check for clay
    if 'clay' in name and c_id != 'cat-clay':
        print(f'MISMATCH DETECTED: Product "{p["name"]}" is in "{c_name}" ({c_id}), but category "Clay & Modelling" (cat-clay) exists!')
