import urllib.request
import json

rp = urllib.request.urlopen('http://localhost:4000/api/v1/products?limit=100')
prods = json.loads(rp.read().decode('utf-8')).get('data', [])

print(f'Total Products: {len(prods)}')
for idx, p in enumerate(prods, 1):
    print(f'{idx:2d}. [{p["id"]:<28}] | {p["name"]:<45} | Category: {p.get("categoryId"):<20} ({p.get("categoryName")}) | Brand: {p.get("brandName")}')

