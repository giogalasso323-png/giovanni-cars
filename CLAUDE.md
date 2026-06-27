# Dublin Toyota Inventory Manager — Claude Code Context

## Session Start Instructions
When Giovanni opens this project or asks to work on it, immediately read `SESSION.md` and give a briefing in this exact format — do this automatically, don't wait to be asked:

**Project:** One sentence describing what this is.

**Core Working Components:**
- Bullet each major feature that is fully built and stable

**New Additions:**
- Bullet anything recently completed (pull from SESSION.md "Recently Completed")

**Currently In Progress:**
- Bullet any active work-in-progress (pull from SESSION.md "Current Work"), or state "Nothing in progress — ask Giovanni what to work on."

## Who This Is For
Giovanni Galasso, salesperson at Dublin Toyota (Dublin, CA). Not a developer by trade — built this tool himself to manage inventory and Facebook Marketplace listings. He works with Claude Code to add features and fix bugs.

## Project Overview
A single-page web app for managing used and new car inventory, Facebook posting, leads/CRM, and gross profit analysis. Deployed on GitHub Pages, backed by Google Apps Script + Google Sheets.

**Live URL:** https://giogalasso323-png.github.io/giovanni-cars/manager.html

## File Structure
```
giovanni-cars/
├── manager.html        ← THE LIVE APP — always edit this one
├── apps-script.js      ← Google Apps Script backend (copy/paste into Google Apps Script)
├── inventory-app.html  ← OLD FILE — never edit, ignore completely
├── index.html          ← redirect page
└── WINDOWS-SETUP.md   ← setup instructions for new machines
```

## Stack
- **Frontend:** Single HTML file (`manager.html`) — dark-themed SPA, ~3800 lines
  - Fonts: DM Mono + Syne (Google Fonts)
  - XLS parsing: SheetJS `xlsx-0.20.2` via CDN
  - No build step, no npm, no framework — pure HTML/CSS/JS
- **Backend:** Google Apps Script (`apps-script.js`) — deployed as a web app
- **Database:** Google Sheets ("Inventory" sheet, "New Inventory" sheet, "Leads" sheet)
- **Storage:** Google Drive ("Dublin Toyota Inventory Photos" folder)
- **Hosting:** GitHub Pages (auto-deploys on push to main)

## Deployment
- **Frontend changes** (`manager.html`): `git add manager.html && git commit -m "..." && git push` — live within ~2 minutes
- **Backend changes** (`apps-script.js`): Copy the entire file into Google Apps Script editor → Deploy → Manage deployments → create a **New Version** — the URL stays the same

## How the App Works

### Setup Screen
On first load, the app shows a setup screen asking for the Google Apps Script web app URL and a password. Once connected, it stores these in `localStorage` and goes straight to the main app on future visits.

### Tabs
- **All / Available / Price Drop / No Photo / Sold** — filter tabs for used inventory
- **Leads** — CRM tab for tracking customer leads and matching them to vehicles
- **Floor** — floor traffic log
- **New Cars** — separate inventory tab for new vehicles (CSV import from DMS)

### Toolbar Actions
- **Sync** — scrapes dublintoyota.com for price/stock/features updates
- **Import Cost Data** — imports GT DMS XLS export for gross analysis (SheetJS parsing)
- **Sort dropdown** — sort by Date, Price, Mileage, Gross High–Low

### Car Drawer (detail panel)
Each car has a slide-in drawer with:
- Full vehicle info, photos, CARFAX link, Edmunds badge
- Facebook status management (Draft / Posted / Sold)
- **Gross Analysis section** — see below
- Photo upload/management

## Gross Analysis Feature
Triggered when cost data is imported from GT DMS export XLS.

**Costs calculated:**
- Appraised Value (from DMS import, stored as `appraisedValue`)
- $2,000 recon (flat)
- $500 detail (flat)
- $650 cert (only if Toyota Certified — stored as `certCost`)

**Mileage/age recon adder matrix (capped at $2,500):**
```
             <30K   30-60K  60-90K  90-120K  120K+
0–3 yrs:        0      300     750    1,250   2,000
4–6 yrs:      300      600   1,100    1,700   2,500
7–10 yrs:     600    1,000   1,600    2,200   2,500
10+ yrs:    1,000    1,500   2,200    2,500   2,500
```

**Gross range:**
- `bottomGross` = price − total cost − mileage/age adder
- `topGross` = price − total cost (no adder)

**Commission:** 25% of gross, floored at $500 mini

**Status badges:**
- 🔴 **Mini** — topGross < $2,000
- 🟡 **Saveable** — bottomGross < $2,000 but topGross ≥ $2,000
- 🟢 **Has Money** — bottomGross ≥ $2,000

**Live inputs in drawer:**
- **Protection Product** sell price (dealer cost $750, so net gross = sell price − $750)
- **Car Discount** (reduces gross dollar-for-dollar)

**Table view:** GP column shows color-coded bottom–top range bars; hover to reveal numbers.

## Google Apps Script Actions
The backend (`apps-script.js`) handles these actions via GET/POST:
| Action | What it does |
|---|---|
| `getAll` | Returns all inventory rows |
| `upsert` | Upsert one car by VIN |
| `upsertMany` | Upsert array of cars |
| `updateField` | Update a single field on a car |
| `scrapeVehicles` | Scrapes dublintoyota.com for VINs |
| `savePhotos` | Saves Google Drive photo links |
| `uploadPhotos` | Uploads base64 photos to Drive |
| `deletePhotos` | Deletes a car's Drive photo folder |
| `ping` | Health check |
| `importCostData` | Writes appraisedValue + certCost from DMS import |
| `getLeads` | Returns all leads |
| `searchLeads` | Search leads by phone or name — returns matches with rowIndex |
| `submitLead` | Add a new lead row |
| `updateLead` | Update a single field on a lead by rowIndex |
| `importNewCars` | Imports new car inventory CSV |

**Apps Script URL:**
`https://script.google.com/macros/s/AKfycbwKodPA7tuxeblfpakHxSd0XFu5MkCguo7rIjBltynkiDEQZky3qCck6_C0sftzgF9Qhg/exec`

**POST format:** Send JSON body `{"action": "actionName", ...fields}` with `Content-Type: application/json`.
**GET format:** Append `?action=actionName` to the URL.

---

## Lead Inbox Workflow

When Giovanni says **"check lead inbox"** or **"check leads folder"**:

1. **Find files** — list contents of Google Drive folder "Leads" (ID: `1Mj0gQ14sAqA-wn_083kj3-ThqqG4EDa3`)
2. **Read each file** — use `read_file_content` for images/docs. Extract: first name, last name, phone, vehicle interest, source (Text / FB Marketplace / FB Ad / Website), any notes or timeframe
3. **Search for existing lead** — POST `searchLeads` with the phone number and name. Phone match is most reliable.
4. **If match found** — show Giovanni the existing lead and the new info. Ask if he wants to update notes or vehicle interest (use `updateLead`). Do NOT create a duplicate.
5. **If no match** — confirm the extracted details with Giovanni, then POST `submitLead` to create the lead.

**submitLead fields:** `firstName`, `lastName`, `phone`, `vehicle` (vehicle interest text), `source`, `timeframe`, `notes`, `status` (default `"New"`), `addedBy` (use `"Giovanni"`)

After processing a file, tell Giovanni it's been handled. A "Processed" subfolder for archiving is planned but not yet built.

## Data Fields Per Used Car
`vin, year, make, model, trim, color, mileage, price, stock, fbStatus, websiteStatus, websitePrice, fbDescription, carfaxUrl, edmundsLabel, edmundsBelow, vehicleInfo, vehicleHistory, features, certification, addedDate, lastChecked, fbPostedDate, soldDate, websiteUrl, fbPostedPrice, priceDropped, dis, currentFbPrice, originalPrice, drivePhotoFolder, drivePhotoCount, appraisedValue, certCost`

## Key Conventions
- `manager.html` is one large file — all HTML, CSS, and JS in one place. No modules.
- Dark theme color variables defined in `:root` at the top of `<style>`.
- The app uses `localStorage` for the Apps Script URL and password.
- `inventory-app.html` is an old version — **never touch it**.
- Giovanni prefers working code with no unnecessary abstractions or comments.

## Section Map — manager.html
Grep for `// ===== SECTION:` to jump to any section. Sections in file order:

| Grep pattern | Approx line | What's there |
|---|---|---|
| `SECTION: AUTH` | ~664 | Password hashing, session check (hashPassword, isAuthed, checkPassword) |
| `SECTION: INIT/BOOT` | ~710 | init(), bootApp(), testAndSaveUrl(), showApp(), resetSetup() |
| `SECTION: API / DATA LAYER` | ~746 | apiFetch(), loadFromSheet(), setSyncInfo(), statusBadge() |
| `SECTION: CSV PARSING UTILITIES` | ~815 | parseCSV(), splitCSV(), findCol(), rowToCar(), mergeImport() |
| `SECTION: FILTERING & RENDERING` | ~892 | applyFilters(), render(), renderTable(), renderCards(), updateCounts(), setView(), sortBy() |
| `SECTION: BULK SELECTION` | ~1074 | toggleSelect/All, clearSelection, updateActionBar, bulkMarkPosted/Sold, downloadPhotosZip |
| `SECTION: USED CARS CSV IMPORT` | ~1182 | openUploadModal, readCSVFile, doImport |
| `SECTION: SCRAPE / WEBSITE SYNC` | ~1228 | openScrapeModal, startScrape (hits dublintoyota.com) |
| `SECTION: FACEBOOK DESCRIPTION` | ~1327 | buildFBDesc() — builds FB Marketplace post text |
| `SECTION: DRAWER` | ~1356 | openDrawer, renderDrawer, setFbStatus, photo upload/delete, saveFbPrice, copyFB, closeDrawer |
| `SECTION: BULK VIN MODAL` | ~1969 | openBulkVinModal, applyBulkVinSelect |
| `SECTION: LEAD MATCHING ENGINE` | ~2029 | scoreVehicleForLead, findMatchesForLead, runMatchingForAllLeads, showMatchBanner |
| `SECTION: LEADS / CRM TAB` | ~2201 | showLeadsView, loadLeads, renderLeads, addLead, deleteLead, updateLeadStatus, vehicle search |
| `SECTION: NEW CARS TAB` | ~2636 | showNewCarsView, renderNewCarsView, openNewCarDrawer, renderNewCarDrawer, startNewScrape |
| `SECTION: GROSS ANALYSIS` | ~3258 | getMileageBracket, calcGrossData, buildGrossSection, recalcGross, grossTableCell, cost import |
| `SECTION: FLOOR TAB` | ~3636 | showFloorView, renderFloorCards, openFloorDrawer, renderFloorDrawer |
| `SECTION: LEAD PICKER MODAL` | ~3824 | openLeadPickerForCar, renderLeadPickerResults, selectLeadForCar |

## Session Handoff
See `SESSION.md` in this directory for active work-in-progress notes. Update it at the end of each working session so the next session can pick up immediately.

## Current State (as of 2026-06-14)
- Gross Analysis feature is fully built and working
- Floor tab is built (floor traffic log)
- Leads/CRM tab is working with vehicle matching
- New Cars tab works with CSV import
- Mobile layout has been tuned for overflow/drawer issues
- GP column in table view shows colored bars, reveal-on-hover
- Section markers added to manager.html (`// ===== SECTION: NAME =====`) for fast navigation
- Last commit: fixed mobile overflow, floor search, drawer layout, vehicle list in leads
