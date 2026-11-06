import os

out_dir = r'frontend/public/images/find-my-stationery'

cards_svg = {}

# 1. school_student.svg
cards_svg['school_student.svg'] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100" width="120" height="100">
  <defs>
    <filter id="shadow1" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="3" stdDeviation="2" flood-color="#78350F" flood-opacity="0.2"/>
    </filter>
  </defs>
  <g filter="url(#shadow1)">
    <!-- Main School Building Walls -->
    <rect x="22" y="44" width="76" height="46" rx="4" fill="#FEF3C7" stroke="#92400E" stroke-width="2.5"/>
    <!-- Stone Base Trim -->
    <rect x="20" y="84" width="80" height="8" rx="2" fill="#FDE68A" stroke="#92400E" stroke-width="2"/>
    
    <!-- Central Portico / Tower -->
    <rect x="46" y="24" width="28" height="66" rx="2" fill="#FDE68A" stroke="#92400E" stroke-width="2.5"/>
    <!-- Belfry / Clock Tower Roof -->
    <polygon points="60,6 40,24 80,24" fill="#EF4444" stroke="#991B1B" stroke-width="2.5" stroke-linejoin="round"/>
    <!-- Flagpole & Flag -->
    <line x1="60" y1="6" x2="60" y2="0" stroke="#78350F" stroke-width="2"/>
    <polygon points="60,0 72,3 60,7" fill="#3B82F6"/>
    <!-- Clock -->
    <circle cx="60" cy="33" r="6" fill="#FFFFFF" stroke="#92400E" stroke-width="1.8"/>
    <line x1="60" y1="33" x2="60" y2="30" stroke="#92400E" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="60" y1="33" x2="63" y2="33" stroke="#92400E" stroke-width="1.5" stroke-linecap="round"/>

    <!-- Main Roof Side Left -->
    <polygon points="16,44 48,24 48,44" fill="#F87171" stroke="#991B1B" stroke-width="2.5" stroke-linejoin="round"/>
    <!-- Main Roof Side Right -->
    <polygon points="104,44 72,24 72,44" fill="#F87171" stroke="#991B1B" stroke-width="2.5" stroke-linejoin="round"/>

    <!-- Double Arched Door -->
    <path d="M52 90 L52 70 A8 8 0 0 1 68 70 L68 90 Z" fill="#B45309" stroke="#78350F" stroke-width="2"/>
    <line x1="60" y1="68" x2="60" y2="90" stroke="#78350F" stroke-width="1.5"/>
    <circle cx="57" cy="80" r="1.2" fill="#FDE68A"/>
    <circle cx="63" cy="80" r="1.2" fill="#FDE68A"/>

    <!-- Left Windows -->
    <rect x="28" y="52" width="12" height="15" rx="3" fill="#BFDBFE" stroke="#1E40AF" stroke-width="1.8"/>
    <line x1="34" y1="52" x2="34" y2="67" stroke="#1E40AF" stroke-width="1.2"/>
    <line x1="28" y1="60" x2="40" y2="60" stroke="#1E40AF" stroke-width="1.2"/>

    <!-- Right Windows -->
    <rect x="80" y="52" width="12" height="15" rx="3" fill="#BFDBFE" stroke="#1E40AF" stroke-width="1.8"/>
    <line x1="86" y1="52" x2="86" y2="67" stroke="#1E40AF" stroke-width="1.2"/>
    <line x1="80" y1="60" x2="92" y2="60" stroke="#1E40AF" stroke-width="1.2"/>
  </g>
</svg>'''

# 2. art_craft.svg
cards_svg['art_craft.svg'] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100" width="120" height="100">
  <defs>
    <filter id="shadow2" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="3" stdDeviation="2" flood-color="#9A3412" flood-opacity="0.2"/>
    </filter>
  </defs>
  <g filter="url(#shadow2)">
    <!-- Wooden Artist Palette -->
    <path d="M60 14 C90 14 108 30 106 58 C104 80 84 88 70 86 C60 84 56 74 48 76 C40 78 38 88 28 84 C14 78 12 56 18 36 C24 16 44 14 60 14 Z" 
          fill="#FED7AA" stroke="#9A3412" stroke-width="2.5" stroke-linejoin="round"/>
    <!-- Palette Thumb Hole -->
    <ellipse cx="86" cy="66" rx="6" ry="8" fill="#FFFDF0" stroke="#9A3412" stroke-width="2"/>

    <!-- Colorful Paint Blobs with Kawaii Glint -->
    <!-- Red Paint -->
    <circle cx="34" cy="32" r="7" fill="#F43F5E"/>
    <circle cx="32" cy="30" r="2" fill="#FFFFFF" opacity="0.8"/>
    <!-- Yellow Paint -->
    <circle cx="52" cy="24" r="7" fill="#FBBF24"/>
    <circle cx="50" cy="22" r="2" fill="#FFFFFF" opacity="0.8"/>
    <!-- Blue Paint -->
    <circle cx="72" cy="26" r="7" fill="#38BDF8"/>
    <circle cx="70" cy="24" r="2" fill="#FFFFFF" opacity="0.8"/>
    <!-- Green Paint -->
    <circle cx="90" cy="38" r="7" fill="#34D399"/>
    <circle cx="88" cy="36" r="2" fill="#FFFFFF" opacity="0.8"/>
    <!-- Purple Paint -->
    <circle cx="38" cy="54" r="6.5" fill="#A855F7"/>
    <circle cx="36" cy="52" r="2" fill="#FFFFFF" opacity="0.8"/>

    <!-- Paintbrush Crossing Palette -->
    <g transform="rotate(35 60 50)">
      <!-- Brush Handle -->
      <path d="M58 8 L62 8 L64 74 L56 74 Z" fill="#EA580C" stroke="#7C2D12" stroke-width="2"/>
      <!-- Silver Ferrule -->
      <rect x="55" y="74" width="10" height="10" fill="#E2E8F0" stroke="#475569" stroke-width="1.8"/>
      <!-- Bristles Tip with Paint -->
      <path d="M55 84 Q60 98 65 84 Z" fill="#38BDF8" stroke="#0284C7" stroke-width="1.8"/>
    </g>
  </g>
</svg>'''

# 3. university.svg
cards_svg['university.svg'] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100" width="120" height="100">
  <defs>
    <filter id="shadow3" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="3" stdDeviation="2" flood-color="#065F46" flood-opacity="0.2"/>
    </filter>
  </defs>
  <g filter="url(#shadow3)">
    <!-- Bottom Book (Pastel Teal) -->
    <rect x="24" y="68" width="72" height="14" rx="3" fill="#A7F3D0" stroke="#065F46" stroke-width="2.5"/>
    <rect x="90" y="70" width="6" height="10" rx="1" fill="#FFFFFF"/>
    <!-- Middle Book (Pastel Lavender) -->
    <rect x="28" y="54" width="64" height="14" rx="3" fill="#DDD6FE" stroke="#5B21B6" stroke-width="2.5"/>
    <rect x="86" y="56" width="6" height="10" rx="1" fill="#FFFFFF"/>

    <!-- Mortarboard Cap Sitting on Books -->
    <!-- Cap Skull Base -->
    <path d="M44 38 Q60 44 76 38 L76 46 Q60 52 44 46 Z" fill="#1E3A8A" stroke="#0F172A" stroke-width="2"/>
    <!-- Diamond Board Top -->
    <polygon points="60,14 100,28 60,42 20,28" fill="#2563EB" stroke="#0F172A" stroke-width="2.5" stroke-linejoin="round"/>
    <polygon points="60,18 94,28 60,38 26,28" fill="#3B82F6"/>
    <!-- Gold Center Button -->
    <circle cx="60" cy="28" r="3" fill="#FBBF24" stroke="#B45309" stroke-width="1.5"/>
    <!-- Gold Tassel -->
    <path d="M60 28 Q80 30 84 42 L84 54" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round"/>
    <polygon points="81,53 87,53 88,62 80,62" fill="#FCD34D" stroke="#B45309" stroke-width="1.5"/>
  </g>
</svg>'''

# 4. office_business.svg
cards_svg['office_business.svg'] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100" width="120" height="100">
  <defs>
    <filter id="shadow4" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="3" stdDeviation="2" flood-color="#1E3A8A" flood-opacity="0.2"/>
    </filter>
  </defs>
  <g filter="url(#shadow4)">
    <!-- Briefcase Body (Warm Caramel Leather) -->
    <rect x="20" y="34" width="80" height="52" rx="10" fill="#D97706" stroke="#78350F" stroke-width="2.5"/>
    <!-- Front Flap -->
    <path d="M20 38 L20 56 Q60 70 100 56 L100 38 Z" fill="#B45309" stroke="#78350F" stroke-width="2.5"/>
    
    <!-- Top Sturdy Handle -->
    <path d="M46 34 L46 22 Q60 16 74 22 L74 34" fill="none" stroke="#78350F" stroke-width="5" stroke-linecap="round"/>
    <path d="M48 34 L48 24 Q60 19 72 24 L72 34" fill="none" stroke="#FCD34D" stroke-width="2" stroke-linecap="round"/>
    <!-- Handle Metal Mounts -->
    <rect x="43" y="30" width="6" height="8" rx="1.5" fill="#FBBF24" stroke="#78350F" stroke-width="1.5"/>
    <rect x="71" y="30" width="6" height="8" rx="1.5" fill="#FBBF24" stroke="#78350F" stroke-width="1.5"/>

    <!-- Dual Straps & Brass Buckles -->
    <!-- Left Strap -->
    <rect x="34" y="36" width="10" height="48" fill="#92400E" stroke="#78350F" stroke-width="1.5"/>
    <rect x="32" y="58" width="14" height="10" rx="2" fill="#FBBF24" stroke="#78350F" stroke-width="1.5"/>
    <rect x="35" y="61" width="8" height="4" fill="#92400E"/>
    <!-- Right Strap -->
    <rect x="76" y="36" width="10" height="48" fill="#92400E" stroke="#78350F" stroke-width="1.5"/>
    <rect x="74" y="58" width="14" height="10" rx="2" fill="#FBBF24" stroke="#78350F" stroke-width="1.5"/>
    <rect x="77" y="61" width="8" height="4" fill="#92400E"/>

    <!-- Center Keyhole Clasp -->
    <circle cx="60" cy="62" r="5" fill="#FCD34D" stroke="#78350F" stroke-width="1.5"/>
    <circle cx="60" cy="62" r="1.5" fill="#78350F"/>
  </g>
</svg>'''

# 5. gift_pack.svg
cards_svg['gift_pack.svg'] = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100" width="120" height="100">
  <defs>
    <filter id="shadow5" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="3" stdDeviation="2" flood-color="#831843" flood-opacity="0.2"/>
    </filter>
  </defs>
  <g filter="url(#shadow5)">
    <!-- Box Body (Pastel Pink) -->
    <rect x="24" y="42" width="72" height="46" rx="6" fill="#FBCFE8" stroke="#9D174D" stroke-width="2.5"/>
    <!-- Box Lid -->
    <rect x="20" y="34" width="80" height="12" rx="4" fill="#F472B6" stroke="#9D174D" stroke-width="2.5"/>

    <!-- Vertical Ribbon -->
    <rect x="54" y="34" width="12" height="54" fill="#E11D48" stroke="#881337" stroke-width="1.5"/>
    <!-- Horizontal Ribbon on Lid -->
    <rect x="20" y="37" width="80" height="6" fill="#E11D48" stroke="#881337" stroke-width="1"/>

    <!-- Big Satin Ribbon Bow at Top -->
    <!-- Left Loop -->
    <path d="M60 32 C45 14 30 18 36 28 C42 34 56 32 60 32 Z" fill="#F43F5E" stroke="#881337" stroke-width="2"/>
    <path d="M54 30 C45 20 38 22 42 27" stroke="#FFF" stroke-width="1.5" fill="none" opacity="0.6"/>
    <!-- Right Loop -->
    <path d="M60 32 C75 14 90 18 84 28 C78 34 64 32 60 32 Z" fill="#F43F5E" stroke="#881337" stroke-width="2"/>
    <path d="M66 30 C75 20 82 22 78 27" stroke="#FFF" stroke-width="1.5" fill="none" opacity="0.6"/>
    <!-- Center Ribbon Knot -->
    <circle cx="60" cy="32" r="5" fill="#E11D48" stroke="#881337" stroke-width="2"/>

    <!-- Cute Sparkle Stars -->
    <path d="M96 22 L98 26 L102 28 L98 30 L96 34 L94 30 L90 28 L94 26 Z" fill="#FDE047" stroke="#CA8A04" stroke-width="1"/>
    <circle cx="18" cy="28" r="2" fill="#FDE047"/>
  </g>
</svg>'''

for name, content in cards_svg.items():
    p = os.path.join(out_dir, name)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(content.strip())
    print('Saved Card SVG:', name)
