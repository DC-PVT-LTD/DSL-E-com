import os

out_dir = r'frontend/public/images/find-my-stationery'
os.makedirs(out_dir, exist_ok=True)

svgs = {}

# 1. star_badge.svg
svgs['star_badge.svg'] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <radialGradient id="starGlow" cx="50%" cy="45%" r="50%">
      <stop offset="0%" stop-color="#FFF6B8"/>
      <stop offset="70%" stop-color="#FFD028"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </radialGradient>
    <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#B45309" flood-opacity="0.3"/>
    </filter>
  </defs>
  <path d="M32 4 L39.5 21 L58 22.5 L44 35 L48.5 53 L32 43.5 L15.5 53 L20 35 L6 22.5 L24.5 21 Z" 
        fill="url(#starGlow)" stroke="#D97706" stroke-width="2.5" stroke-linejoin="round" filter="url(#softShadow)"/>
  <path d="M32 9 L37 20 L48 21" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.8"/>
  <circle cx="26" cy="29" r="2.8" fill="#1E293B"/>
  <circle cx="25" cy="28" r="1" fill="#FFFFFF"/>
  <circle cx="38" cy="29" r="2.8" fill="#1E293B"/>
  <circle cx="37" cy="28" r="1" fill="#FFFFFF"/>
  <ellipse cx="21" cy="33" rx="3" ry="1.8" fill="#FF6B8B" opacity="0.6"/>
  <ellipse cx="43" cy="33" rx="3" ry="1.8" fill="#FF6B8B" opacity="0.6"/>
  <path d="M29 33 Q32 37 35 33" stroke="#1E293B" stroke-width="2" stroke-linecap="round" fill="none"/>
</svg>'''

# 2. grade_1_2.svg (Crayon & Eraser)
svgs['grade_1_2.svg'] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <filter id="crayonShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#0F766E" flood-opacity="0.2"/>
    </filter>
  </defs>
  <g transform="rotate(-35 32 32)" filter="url(#crayonShadow)">
    <path d="M22 6 L26 14 L18 14 Z" fill="#10B981" stroke="#047857" stroke-width="2" stroke-linejoin="round"/>
    <rect x="18" y="14" width="8" height="36" rx="2" fill="#34D399" stroke="#047857" stroke-width="2"/>
    <rect x="17" y="22" width="10" height="20" fill="#6EE7B7" stroke="#047857" stroke-width="1.5"/>
    <path d="M17 26 Q22 28 27 26" stroke="#047857" stroke-width="1.5" fill="none"/>
    <path d="M17 38 Q22 40 27 38" stroke="#047857" stroke-width="1.5" fill="none"/>
    <ellipse cx="22" cy="32" rx="3.5" ry="2" fill="#ECFDF5" stroke="#047857" stroke-width="1"/>
  </g>
  <g transform="translate(34, 30) rotate(15)">
    <rect x="0" y="0" width="18" height="12" rx="2" fill="#F472B6" stroke="#BE185D" stroke-width="2"/>
    <rect x="0" y="0" width="8" height="12" rx="1" fill="#3B82F6" stroke="#1D4ED8" stroke-width="1.5"/>
    <line x1="8" y1="1" x2="8" y2="11" stroke="#1E3A8A" stroke-width="1.5"/>
  </g>
</svg>'''

# 3. grade_3_9.svg (Pair of Colored Pencils)
svgs['grade_3_9.svg'] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <filter id="pencilShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#9A3412" flood-opacity="0.2"/>
    </filter>
  </defs>
  <g transform="rotate(20 28 32)" filter="url(#pencilShadow)">
    <polygon points="28,6 30,12 26,12" fill="#EA580C" stroke="#9A3412" stroke-width="1.5"/>
    <polygon points="26,12 30,12 31,17 25,17" fill="#FED7AA" stroke="#9A3412" stroke-width="1.5"/>
    <rect x="25" y="17" width="6" height="34" fill="#FB923C" stroke="#9A3412" stroke-width="1.5"/>
    <rect x="25" y="51" width="6" height="4" fill="#CBD5E1" stroke="#64748B" stroke-width="1"/>
    <path d="M25 55 L31 55 A2 2 0 0 1 29 59 L27 59 A2 2 0 0 1 25 55 Z" fill="#F43F5E" stroke="#BE123C" stroke-width="1"/>
  </g>
  <g transform="rotate(-15 36 32)" filter="url(#pencilShadow)">
    <polygon points="36,4 38,10 34,10" fill="#E11D48" stroke="#881337" stroke-width="1.5"/>
    <polygon points="34,10 38,10 39,15 33,15" fill="#FCE7F3" stroke="#881337" stroke-width="1.5"/>
    <rect x="33" y="15" width="6" height="36" fill="#FB7185" stroke="#881337" stroke-width="1.5"/>
    <line x1="35" y1="15" x2="35" y2="51" stroke="#BE123C" stroke-width="1" stroke-opacity="0.5"/>
    <rect x="33" y="51" width="6" height="4" fill="#FCD34D" stroke="#D97706" stroke-width="1"/>
    <path d="M33 55 L39 55 A2 2 0 0 1 37 59 L35 59 A2 2 0 0 1 33 55 Z" fill="#A855F7" stroke="#6B21A8" stroke-width="1"/>
  </g>
</svg>'''

# 4. grade_ol.svg (Mortarboard Academic Cap)
svgs['grade_ol.svg'] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <filter id="mortarShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2.5" stdDeviation="1.5" flood-color="#78350F" flood-opacity="0.25"/>
    </filter>
  </defs>
  <g filter="url(#mortarShadow)">
    <path d="M22 34 Q32 40 42 34 L42 44 Q32 50 22 44 Z" fill="#78350F" stroke="#451A03" stroke-width="2"/>
    <polygon points="32,14 58,26 32,38 6,26" fill="#B45309" stroke="#451A03" stroke-width="2.5" stroke-linejoin="round"/>
    <polygon points="32,17 54,26 32,35 10,26" fill="#D97706"/>
    <circle cx="32" cy="26" r="2.5" fill="#FBBF24" stroke="#B45309" stroke-width="1"/>
    <path d="M32 26 Q46 28 48 38 L48 48" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round"/>
    <polygon points="46,47 50,47 51,55 45,55" fill="#FCD34D" stroke="#D97706" stroke-width="1"/>
  </g>
</svg>'''

# 5. grade_al_science.svg (Science Flask with Bubbles)
svgs['grade_al_science.svg'] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="flaskLiquid" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#0284C7"/>
    </linearGradient>
  </defs>
  <path d="M26 12 L38 12 L38 24 L52 48 A4 4 0 0 1 48 54 L16 54 A4 4 0 0 1 12 48 L26 24 Z" 
        fill="#E0F2FE" stroke="#0369A1" stroke-width="2.5" stroke-linejoin="round"/>
  <rect x="24" y="8" width="16" height="5" rx="2" fill="#BAE6FD" stroke="#0369A1" stroke-width="2"/>
  <path d="M20 38 Q32 35 44 38 L49 48 A3 3 0 0 1 46 52 L18 52 A3 3 0 0 1 15 48 Z" 
        fill="url(#flaskLiquid)" stroke="#0284C7" stroke-width="1.5"/>
  <path d="M20 38 Q32 35 44 38" stroke="#E0F2FE" stroke-width="2" fill="none" stroke-linecap="round"/>
  <circle cx="28" cy="44" r="2" fill="#FFFFFF" opacity="0.8"/>
  <circle cx="36" cy="42" r="2.5" fill="#FFFFFF" opacity="0.7"/>
  <circle cx="32" cy="30" r="2" fill="#38BDF8" stroke="#0284C7" stroke-width="1"/>
  <circle cx="34" cy="20" r="1.5" fill="#38BDF8" stroke="#0284C7" stroke-width="1"/>
  <path d="M17 48 L25 32" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
</svg>'''

# 6. grade_al_commerce.svg (Calculator with Colorful Buttons)
svgs['grade_al_commerce.svg'] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <filter id="calcShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#581C87" flood-opacity="0.2"/>
    </filter>
  </defs>
  <g filter="url(#calcShadow)">
    <rect x="14" y="8" width="36" height="48" rx="7" fill="#DDD6FE" stroke="#6B21A8" stroke-width="2.5"/>
    <rect x="19" y="14" width="26" height="11" rx="3" fill="#A7F3D0" stroke="#047857" stroke-width="1.5"/>
    <text x="42" y="23" font-family="monospace" font-size="8" font-weight="bold" fill="#065F46" text-anchor="end">1,250</text>
    <rect x="19" y="29" width="7" height="6" rx="1.5" fill="#F472B6" stroke="#9D174D" stroke-width="1"/>
    <rect x="28.5" y="29" width="7" height="6" rx="1.5" fill="#60A5FA" stroke="#1D4ED8" stroke-width="1"/>
    <rect x="38" y="29" width="7" height="6" rx="1.5" fill="#FBBF24" stroke="#B45309" stroke-width="1"/>
    <rect x="19" y="38" width="7" height="6" rx="1.5" fill="#FFFFFF" stroke="#6B21A8" stroke-width="1"/>
    <rect x="28.5" y="38" width="7" height="6" rx="1.5" fill="#FFFFFF" stroke="#6B21A8" stroke-width="1"/>
    <rect x="38" y="38" width="7" height="6" rx="1.5" fill="#34D399" stroke="#047857" stroke-width="1"/>
    <rect x="19" y="46" width="16.5" height="6" rx="1.5" fill="#FFFFFF" stroke="#6B21A8" stroke-width="1"/>
    <rect x="38" y="46" width="7" height="6" rx="1.5" fill="#A855F7" stroke="#581C87" stroke-width="1"/>
  </g>
</svg>'''

# 7. coin_purse.svg (Kawaii Pink Coin Purse with Gold Clasp)
svgs['coin_purse.svg'] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <radialGradient id="purseGlow" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#FFA0BE"/>
      <stop offset="70%" stop-color="#FF6B8B"/>
      <stop offset="100%" stop-color="#E11D48"/>
    </radialGradient>
    <filter id="purseShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2.5" stdDeviation="1.5" flood-color="#9F1239" flood-opacity="0.25"/>
    </filter>
  </defs>
  <path d="M22 20 Q10 24 10 42 Q10 56 32 56 Q54 56 54 42 Q54 24 42 20 Z" 
        fill="url(#purseGlow)" stroke="#9F1239" stroke-width="2.5" stroke-linejoin="round" filter="url(#purseShadow)"/>
  <path d="M24 24 Q14 28 14 42 Q14 52 32 52 Q50 52 50 42 Q50 28 40 24" 
        stroke="#FFF1F2" stroke-width="1.5" stroke-dasharray="2.5,2" fill="none" opacity="0.8"/>
  <path d="M20 20 L44 20" stroke="#F59E0B" stroke-width="4" stroke-linecap="round"/>
  <path d="M20 20 L44 20" stroke="#FCD34D" stroke-width="2" stroke-linecap="round"/>
  <circle cx="29" cy="14" r="3.5" fill="#F59E0B" stroke="#B45309" stroke-width="1.5"/>
  <circle cx="28" cy="13" r="1" fill="#FEF08A"/>
  <circle cx="35" cy="14" r="3.5" fill="#F59E0B" stroke="#B45309" stroke-width="1.5"/>
  <circle cx="34" cy="13" r="1" fill="#FEF08A"/>
  <circle cx="27" cy="37" r="2" fill="#1E293B"/>
  <circle cx="37" cy="37" r="2" fill="#1E293B"/>
  <path d="M30 40 Q32 42 34 40" stroke="#1E293B" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <ellipse cx="23" cy="40" rx="2" ry="1.2" fill="#FFF" opacity="0.6"/>
  <ellipse cx="41" cy="40" rx="2" ry="1.2" fill="#FFF" opacity="0.6"/>
</svg>'''

# 8. gold_coins.svg (Stack of Shiny Gold Coins)
svgs['gold_coins.svg'] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <filter id="coinShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#78350F" flood-opacity="0.3"/>
    </filter>
  </defs>
  <g filter="url(#coinShadow)">
    <path d="M12 44 L12 48 Q32 58 52 48 L52 44 Q32 54 12 44 Z" fill="#D97706" stroke="#78350F" stroke-width="1.5"/>
    <ellipse cx="32" cy="44" rx="20" ry="7" fill="#FBBF24" stroke="#78350F" stroke-width="1.5"/>
    <path d="M12 36 L12 40 Q32 50 52 40 L52 36 Q32 46 12 36 Z" fill="#D97706" stroke="#78350F" stroke-width="1.5"/>
    <ellipse cx="32" cy="36" rx="20" ry="7" fill="#FCD34D" stroke="#78350F" stroke-width="1.5"/>
    <path d="M12 28 L12 32 Q32 42 52 32 L52 28 Q32 38 12 28 Z" fill="#D97706" stroke="#78350F" stroke-width="1.5"/>
    <ellipse cx="32" cy="28" rx="20" ry="7" fill="#FDE047" stroke="#78350F" stroke-width="1.5"/>
    <ellipse cx="32" cy="28" rx="16" ry="5" fill="none" stroke="#F59E0B" stroke-width="1.2" stroke-dasharray="2,1"/>
    <path d="M44 14 L46 19 L51 21 L46 23 L44 28 L42 23 L37 21 L42 19 Z" fill="#FEF08A" stroke="#D97706" stroke-width="1"/>
  </g>
</svg>'''

# 9. clipboard.svg (Kawaii Pastel Clipboard)
svgs['clipboard.svg'] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <filter id="clipShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#78350F" flood-opacity="0.2"/>
    </filter>
  </defs>
  <g filter="url(#clipShadow)">
    <rect x="12" y="8" width="40" height="50" rx="6" fill="#FDE68A" stroke="#D97706" stroke-width="2.5"/>
    <rect x="16" y="14" width="32" height="40" rx="3" fill="#FFFFFF" stroke="#E5E7EB" stroke-width="1.5"/>
    <path d="M24 6 L40 6 A2 2 0 0 1 42 8 L42 14 L22 14 L22 8 A2 2 0 0 1 24 6 Z" fill="#93C5FD" stroke="#1D4ED8" stroke-width="2"/>
    <ellipse cx="32" cy="10" rx="3" ry="2" fill="#EFF6FF" stroke="#1D4ED8" stroke-width="1"/>
    <path d="M20 22 L23 25 L29 19" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="32" y1="22" x2="44" y2="22" stroke="#94A3B8" stroke-width="2" stroke-linecap="round"/>
    <path d="M20 31 L23 34 L29 28" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="32" y1="31" x2="44" y2="31" stroke="#94A3B8" stroke-width="2" stroke-linecap="round"/>
    <path d="M20 40 L23 43 L29 37" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="32" y1="40" x2="42" y2="40" stroke="#94A3B8" stroke-width="2" stroke-linecap="round"/>
  </g>
</svg>'''

# 10. shopping_basket.svg (Pastel Purple Basket)
svgs['shopping_basket.svg'] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <filter id="basketShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#581C87" flood-opacity="0.2"/>
    </filter>
  </defs>
  <g filter="url(#basketShadow)">
    <path d="M20 30 Q32 8 44 30" fill="none" stroke="#A855F7" stroke-width="3" stroke-linecap="round"/>
    <rect x="8" y="28" width="48" height="6" rx="3" fill="#C084FC" stroke="#6B21A8" stroke-width="2"/>
    <path d="M12 34 L18 54 Q19 56 22 56 L42 56 Q45 56 46 54 L52 34 Z" 
          fill="#E9D5FF" stroke="#6B21A8" stroke-width="2" stroke-linejoin="round"/>
    <line x1="22" y1="34" x2="25" y2="54" stroke="#C084FC" stroke-width="2"/>
    <line x1="32" y1="34" x2="32" y2="54" stroke="#C084FC" stroke-width="2"/>
    <line x1="42" y1="34" x2="39" y2="54" stroke="#C084FC" stroke-width="2"/>
    <line x1="14" y1="44" x2="50" y2="44" stroke="#C084FC" stroke-width="2"/>
  </g>
</svg>'''

for filename, content in svgs.items():
    p = os.path.join(out_dir, filename)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(content.strip())
    print('Saved SVG:', filename)
