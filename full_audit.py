import urllib.request
import json

base_url = 'http://localhost:4000/api/v1'

def fetch_json(url):
    req = urllib.request.Request(url, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

# 1. Fetch all categories
cats_resp = fetch_json(f'{base_url}/categories')
categories = cats_resp.get('data', [])

# 2. Fetch all products (limit=100)
prods_resp = fetch_json(f'{base_url}/products?limit=100')
all_products = prods_resp.get('data', [])

print(f'AUDIT SUMMARY: {len(categories)} Categories | {len(all_products)} Total Products\n')

# Check each category
diagnostic_table = []
for c in categories:
    cid = c['id']
    cslug = c['slug']
    cname = c['name']
    api_item_count = c.get('itemCount', 0)
    
    # Products by category ID endpoint
    try:
        cat_prods_resp = fetch_json(f'{base_url}/categories/{cid}/products')
        cat_endpoint_count = cat_prods_resp.get('meta', {}).get('total', len(cat_prods_resp.get('data', [])))
    except Exception as e:
        cat_endpoint_count = f'ERR: {e}'
        
    # Products by query param categoryId
    try:
        p_by_id = fetch_json(f'{base_url}/products?categoryId={cid}&limit=100')
        query_by_id_count = p_by_id.get('meta', {}).get('total', len(p_by_id.get('data', [])))
    except Exception as e:
        query_by_id_count = f'ERR: {e}'

    # Products by query param categorySlug
    try:
        p_by_slug = fetch_json(f'{base_url}/products?categorySlug={cslug}&limit=100')
        query_by_slug_count = p_by_slug.get('meta', {}).get('total', len(p_by_slug.get('data', [])))
    except Exception as e:
        query_by_slug_count = f'ERR: {e}'
        
    # Actual count in all_products array
    array_count = sum(1 for p in all_products if p.get('categoryId') == cid)
    
    diagnostic_table.append({
        'name': cname,
        'id': cid,
        'slug': cslug,
        'array_count': array_count,
        'api_itemCount': api_item_count,
        'cat_endpoint': cat_endpoint_count,
        'query_by_id': query_by_id_count,
        'query_by_slug': query_by_slug_count,
    })

print(f'{"Category Name":<22} | {"Category ID":<20} | {"Slug":<20} | {"In DB":<6} | {"itemCount":<9} | {"/cat/:id/prods":<14} | {"?categoryId":<11} | {"?categorySlug":<13}')
print('-'*125)
for row in diagnostic_table:
    print(f'{row["name"]:<22} | {row["id"]:<20} | {row["slug"]:<20} | {row["array_count"]:<6} | {row["api_itemCount"]:<9} | {str(row["cat_endpoint"]):<14} | {str(row["query_by_id"]):<11} | {str(row["query_by_slug"]):<13}')

# Check for zero product categories
print('\n=== CATEGORIES WITH 0 PRODUCTS ===')
zero_cats = [r for r in diagnostic_table if r['array_count'] == 0]
for z in zero_cats:
    print(f'- {z["name"]} (ID: {z["id"]}, Slug: {z["slug"]})')

# Detailed inspection of products in "Pens" and "Markers" and "Fabric Paint"
print('\n=== DETAILED PRODUCTS IN "Pens" (cat-pens) ===')
pens_prods = [p for p in all_products if p.get('categoryId') == 'cat-pens']
for p in pens_prods:
    print(f'  [{p["id"]}] \"{p["name"]}\" | SKU: {p.get("sku")} | Tags: {p.get("tags")}')

print('\n=== DETAILED PRODUCTS IN "Markers" (cat-markers) ===')
marker_prods = [p for p in all_products if p.get('categoryId') == 'cat-markers']
for p in marker_prods:
    print(f'  [{p["id"]}] \"{p["name"]}\" | SKU: {p.get("sku")} | Tags: {p.get("tags")}')

