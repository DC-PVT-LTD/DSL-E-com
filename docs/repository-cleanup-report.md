# DSL Stationery — Deep Repository Audit & Safe Project Cleanup Report

**Date:** 2026-11-14  
**Project:** DSL Stationery E-Commerce Platform  
**Target:** Deep Repository Audit & Safe Project Cleanup  
**Status:** Audit & Safe Cleanup Completed & Verified  

---

## 1. Original Repository Structure

Prior to cleanup, the repository root had accumulated a mixture of temporary test scripts, test images, ad-hoc Playwright automation, prompt transcripts, unextracted zip archives, and stray build/cache directories:

```
DSL E-com/
├── .git/
├── .next/                              <-- Accidental root Next.js build cache (dated Nov 8)
├── backend/                            <-- NestJS backend application
│   ├── dist/
│   ├── node_modules/
│   ├── prisma/
│   ├── public/uploads/
│   ├── src/
│   └── ...
├── docs/                               <-- Documentation & architecture roadmaps
├── frontend/                           <-- Next.js frontend application
│   ├── .next/                          <-- Active frontend Turbopack build
│   ├── node_modules/
│   ├── public/
│   │   ├── fonts/
│   │   │   ├── Fira_Sans,Redaction_10.zip  <-- 8.65 MB unextracted zip archive
│   │   │   └── shooting-star-personal-use/ <-- Author promotional samples (1.png-7.jpg)
│   │   ├── images/
│   │   │   ├── DSL_School_Pack_Graphic_HD_Files.zip <-- 9.39 MB unextracted zip
│   │   │   ├── test_card_strip.png         <-- Ad-hoc test crop
│   │   │   └── test_eraser.jpg             <-- Ad-hoc test crop
│   │   ├── gemini_generated_video_26e28187 - Copy.mp4 <-- 2.94 MB duplicate video
│   │   └── test_sharp.mp4                  <-- 863 KB unreferenced test video
│   └── src/
├── node_modules/                       <-- Root folder containing only .vite & .vitest-cache (0 packages)
├── public/                             <-- Accidental root public folder with 9 UI screenshots in assets/story/
├── scratch/                            <-- Scratch verification scripts, test CSVs, prompt dumps
├── scripts/                            <-- scripts/test_crop.js & scripts/capture_hero.js
├── .env.example
├── .gitignore                          <-- Only ignored 'config.bat' & 'node_modules'
├── audit_data.py                       <-- Root python audit script
├── audit_sync.py                       <-- Root python regex sync script
├── check_icons.png                     <-- Root test screenshot
├── check_icons_crop.png                <-- Root test screenshot
├── dsl_all_products.csv                <-- Primary source dataset (84 DSL products)
├── full_audit.py                       <-- Root python audit script
├── full_prompt_10.txt                  <-- Prompt transcript
├── generate_cards_svg.py               <-- SVG generator script
├── generate_svgs.py                    <-- SVG generator script
├── m1_left.jpg                         <-- Root test crop
├── m1_right.jpg                        <-- Root test crop
├── package.json                        <-- Root workspace package scripts
├── paw_check.jpg                       <-- Root test crop
├── print_all_products.py               <-- Root product printer script
├── prompt_10.txt                       <-- Prompt transcript
├── README.md                           <-- Project README
└── test_crop_right.jpg                 <-- Root test crop
```

---

## 2. Final Repository Structure

After the deep audit, safe cleanup, script reorganization, and `.gitignore` enhancement, the repository root is clean, minimal, and fully structured:

```
DSL E-com/
├── backend/                            <-- Complete NestJS Backend
│   ├── prisma/                         <-- Migrations, schema.prisma, seeds
│   ├── public/uploads/                 <-- Live database-backed uploads (banners, products)
│   ├── src/                            <-- Modules, controllers, services, guards
│   └── package.json
├── docs/                               <-- Architectural roadmaps & technical reports
│   ├── admin-backend-from-zero-checklist.md
│   ├── repository-cleanup-report.md
│   └── superpowers/plans/
├── frontend/                           <-- Complete Next.js Storefront & Admin
│   ├── public/                         <-- Clean static web assets (fonts, images, active media)
│   ├── src/                            <-- App router, components, services, types
│   └── package.json
├── scratch/                            <-- Developer verification scripts (isolated, non-polluting)
├── scripts/                            <-- Structured Maintenance & Automation Utilities
│   ├── audit/                          <-- Maintenance audit scripts
│   │   ├── audit_data.py
│   │   ├── audit_sync.py
│   │   ├── full_audit.py
│   │   └── print_all_products.py
│   └── generators/                     <-- Asset generation utilities
│       ├── generate_cards_svg.py
│       └── generate_svgs.py
├── .env.example                        <-- Preserved workspace environment template
├── .gitignore                          <-- Enhanced root ignore patterns
├── dsl_all_products.csv                <-- Preserved primary source of truth catalog
├── package.json                        <-- Root workspace runner (delegates to frontend)
└── README.md                           <-- Project overview & guidelines
```

---

## 3. Files Investigated & Cleanup Plan

| File / Folder | Original Purpose | Usage Evidence | Recommendation | Risk | Action Taken |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/.next` | Accidental root build directory | Created Nov 8; active Next.js build is at `frontend/.next` | Remove | Low | **Safely Removed** |
| `/node_modules` | Stray root directory | Contained only `.vite` & `.vitest-cache`, 0 npm packages installed | Remove | Low | **Safely Removed** |
| `/public` | Stray root folder | Contained 9 UI screenshots (`desktop-scene1.png`, etc.). Not served by Next.js | Remove | Low | **Safely Removed** |
| `m1_left.jpg`, `m1_right.jpg`, `paw_check.jpg`, `test_crop_right.jpg` | Temporary image alignment checks | Untracked, created Nov 10; zero code or script references | Remove | Low | **Safely Removed** |
| `scripts/test_crop.js`, `scripts/capture_hero.js` | Ad-hoc Playwright screenshot scripts | Ephemeral automation writing to public directory | Remove | Low | **Safely Removed** |
| `frontend/public/fonts/Fira_Sans,Redaction_10.zip` | 8.65 MB unextracted zip archive | Fonts already extracted to `Fira_Sans/` and `Redaction_10/` | Remove | Low | **Safely Removed** |
| `frontend/public/images/DSL_School_Pack_Graphic_HD_Files.zip` | 9.39 MB unextracted zip archive | Graphics already extracted to `HD_2x.png` and `UltraHD_4x.png` | Remove | Low | **Safely Removed** |
| `frontend/public/gemini_generated_video_26e28187 - Copy.mp4` | 2.94 MB duplicate video with `" - Copy"` | Zero references in frontend code | Remove | Low | **Safely Removed** |
| `frontend/public/test_sharp.mp4` | 863 KB test video | Zero references in frontend code | Remove | Low | **Safely Removed** |
| `frontend/public/images/test_card_strip.png`, `test_eraser.jpg` | Temporary test image crops | Zero references in frontend code | Remove | Low | **Safely Removed** |
| `frontend/public/fonts/shooting-star-personal-use/1.png` to `7.jpg` | 3+ MB author preview graphics from zip | Only `Shooting Star.ttf` is referenced by `globals.css` | Remove | Low | **Safely Removed** |
| `prompt_10.txt`, `full_prompt_10.txt` | Prompt transcripts from earlier sessions | Zero code references | Remove | Low | **Safely Removed** |
| `check_icons.png`, `check_icons_crop.png` | SVG generation test screenshots | Zero code references | Remove | Low | **Safely Removed** |
| `audit_data.py`, `audit_sync.py`, `full_audit.py`, `print_all_products.py` | Python maintenance audit scripts | Useful diagnostic tools for checking live catalog integrity | Keep & Relocate | Low | **Moved to `scripts/audit/`** |
| `generate_cards_svg.py`, `generate_svgs.py` | SVG generator scripts | Contains original SVG template code for stationery icons | Keep & Relocate | Low | **Moved to `scripts/generators/`** |
| `dsl_all_products.csv` | Original DSL source dataset (84 products) | Referenced as source of truth in `frontend/src/mocks/products.ts` | Keep | High | **Preserved in root** |
| `backend/public/uploads/` & `frontend/public/uploads/` | Uploaded images for banners & products | Linked to active database rows in PostgreSQL | Keep | High | **Preserved** |
| `frontend/public/assets/` (`library/`, `packs/`, `poo/`) | School pack story backgrounds & mascots | Actively imported by `PooSchoolPackStory.tsx` & related components | Keep | High | **Preserved** |
| `backend/storage/private_uploads/` | 12 files from legacy uploaded-documents | Tracked in Git, historical user data | Awaiting Approval | Med | **Preserved** |

---

## 4. Duplicate Files Identified

During SHA-256 analysis, the following exact duplicates were verified:

1. **Videos**:
   * `frontend/public/hero-video.mp4` & `frontend/public/hero-video-4k.mp4`  
     * **SHA256:** `54928FC6F3BFA8FE30F57A957B6E522955D664DD161B14635B137DC49904F823`  
     * **Status:** Both are currently referenced in `frontend/src/components/home/EditorialHero.tsx` as fallback video sources (`<source src="/hero-video-4k.mp4" />` and `<source src="/hero-video.mp4" />`). *Preserved to prevent breaking HTML video source ladder.*
2. **Logos**:
   * `frontend/public/images/dsl-logo-header.png` & `frontend/public/images/dsl-logo-official.png`  
     * **SHA256:** `CF3CB90AA93850AAEFE1A5247839157A1BDC12DC97DEA104C9CC5F32C1632E1B`  
     * **Status:** `dsl-logo-header.png` is actively imported in `Navbar.tsx` and `Footer.tsx`. `dsl-logo-official.png` is currently unreferenced. *Marked for user review/approval before deletion.*
3. **Hero Wave Images**:
   * `frontend/public/images/hero-bg-waves.jpg` & `frontend/public/images/hero-bg-waves-generated.jpg`  
     * **SHA256:** `836F95D82E1C62361AD799D64D474BF9F284E6E0D5EB7CA0E2DF8BA959445A09`  
     * **Status:** `hero-bg-waves.jpg` is actively imported in `FirstHeroSlide.tsx`. `hero-bg-waves-generated.jpg` is redundant. *Marked for user review/approval before deletion.*
4. **Fonts**:
   * `frontend/public/fonts/Heylowitch-Regular.otf` & `frontend/public/fonts/heylowitch/Heylowitch-Regular.otf`  
     * **Status:** `globals.css` references both paths in `@font-face`. *Preserved.*

---

## 5. Files Retained & Awaiting Decision

The following files are preserved in the repository awaiting explicit user decision:

1. **`backend/storage/private_uploads/documents/` (12 files)**:
   * Files: `0c93e85c...pdf`, `124ffc7d...png`, `74e010f4...pdf`, etc.
   * Reason: These are sample uploaded files from the earlier upload-stationery-list feature. Since they are tracked in git and represent historical uploads, they were not deleted automatically.
   * *Recommendation:* Remove once user confirms legacy test uploads are no longer needed.
2. **Hero Wave Variants**:
   * `frontend/public/images/hero-bg-waves-original.jpg`
   * `frontend/public/images/hero-bg-waves-v2.jpg`
   * `frontend/public/images/hero-bg-waves-v3.jpg`
   * Reason: Design iteration assets created during hero banner fine-tuning.
   * *Recommendation:* Move to design archive or remove if current `hero-bg-waves.jpg` is finalized.
3. **`dsl_all_products.csv`**:
   * Reason: Original 84-product master catalog dataset.
   * *Recommendation:* Retain permanently in repository root or in a dedicated `data/` folder.

---

## 6. Generated Files & Ignore Rules

The root `.gitignore` file was updated to cleanly ignore all build artifacts, temporary caches, python bytecode, and OS metadata:

```gitignore
config.bat
node_modules
.next
dist
.env
*.log
.DS_Store
Thumbs.db
__pycache__/
*.pyc
.vite
.vitest-cache
```

---

## 7. Verification Results

Following the safe cleanup and file reorganization, full verification was conducted:

| Test / Check | Command Executed | Result | Details |
| :--- | :--- | :--- | :--- |
| **Backend TypeScript Build** | `npm --prefix backend run build` | **Passed (Code 0)** | Zero compilation errors. NestJS dist bundle emitted. |
| **Frontend Production Build** | `npm --prefix frontend run build` | **Passed (Code 0)** | 58/58 static & dynamic pages generated. Turbopack type checking passed in 6.0s. |
| **Backend Test Suite** | `npm --prefix backend run test` | **Passed (Code 0)** | 104/104 tests passing across 8 test suites (100%). |
| **Protected Product Stock Invariant** | `scratch/check_protected.js` | **Verified** | Product `cmw0j4cro00089kusmwsbv48t` stock is strictly **10**. |
| **Store Settings Invariant** | `scratch/inspect_settings.js` | **Verified** | `StoreSettings.onlineCardEnabled` is strictly **`false`**. |
| **Git Safety** | `git status` | **Verified** | Zero destructive git commands (`git clean`, `git reset --hard`) executed. Unrelated work, user files, and database records preserved. |

---

## 8. Summary of Reclaimed Storage & Cleanup Impact

* **Large Leftover Zip Archives Removed:** ~18.0 MB (`Fira_Sans,Redaction_10.zip`, `DSL_School_Pack_Graphic_HD_Files.zip`)
* **Unreferenced Videos & Previews Removed:** ~6.8 MB (`gemini_generated_video...Copy.mp4`, `test_sharp.mp4`, `1.png`-`7.jpg`)
* **Stray Directories Removed:** Root `.next`, root `node_modules` (`.vite`), root `public/assets/story/`
* **Root Clutter Cleaned:** Maintenance scripts neatly organized into `scripts/audit/` and `scripts/generators/`
* **Zero Functional Regressions:** All storefront and admin routes compile and pass tests.

