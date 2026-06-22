# Session Handoff — Dublin Toyota Inventory Manager

**Instructions for Claude:** Read this file at the start of every session to pick up where we left off. Update the "Current Work" section before ending any session that had in-progress changes. Clear it when the work is fully shipped.

---

## Current Work
_Nothing in progress. Ask Giovanni what to work on._

---

## Recently Completed (2026-06-22)

**New inventory organization tabs:**
- **Not Listed tab** — shows cars where websiteStatus === 'Not on Website' after a scrape. Excludes 'Check FB — Delist' (those need one-at-a-time Facebook cleanup). Has "Mark All Sold" amber button that bulk-marks all visible cars as Sold/Unavailable.
- **Upcoming tab** — shows pre-lot cars: `appraisedValue > 0 && !color`. The `!color` check is the key: cost import CSV never sets color, but regular used car CSV always sets it from the `Ext` column. When a CSV import enriches a stub, it gets a color and automatically exits Upcoming.
- Upcoming tab default sort: newest inventory date first, preserving import file row order within the same date via `_importOrder` index.
- Upcoming tab shows appraiser name in amber (both `Appraiser` and `Appr. Salesperson` columns joined with ` · `).

**Cost import upgrades:**
- `importCostData` in apps-script.js now creates stub rows for VINs not found in inventory (instead of silently skipping). Stub includes: vin, stock, year, make, model, mileage, price, appraisedValue, certCost, appraiser, addedDate.
- Frontend parses these extra fields from the cost CSV: Vehicle (→ year/make/model), Odometer (→ mileage), Price, Inventory Date (→ addedDate), Appraiser + Appr. Salesperson (→ appraiser display).
- Existing stubs get enriched on re-import: fills in missing year/make/model/mileage/price/appraiser via upsertMany.
- Import preview now shows "X update existing / Y new → Upcoming tab" and labels each row as ✓ Match or + Upcoming.

**`lastEdited` timestamping on leads (2026-06-21):**
- `updateLead()` in apps-script.js auto-stamps `lastEdited` on every field update.
- Leads table: staleness dot (green ≤2d, amber ≤7d, red >7d) + `↻ date` second line.
- Lead drawer: Created + Last Edit bar with staleness dot.

**Schema additions:**
- `lastEdited` added to LEADS_COLUMNS
- `appraiser` added to COLUMNS (used car inventory)
- Both require the `appraiser` column header in the Google Sheet (added manually after last `certCost` column)
- Apps Script new version deployed ✓

---

## Future Features — Upcoming Tab
1. **FB posting from Upcoming** — post to Facebook from the Upcoming tab, with the post carrying over continuity when the car goes live on the website (stock #, price, description preserved)
2. **Search by appraiser name** — can't currently search/filter Upcoming by who took the trade
3. **Cowork MCP tool** — `get_upcoming_inventory` so Cowork can search pre-lot cars for customer matches

---

## Known Issues / Next Up
- `scrape_inventory` MCP tool requires Cowork restart after each code push (local process)
- Google Drive "Lead Inbox" folder not yet created (for phone screenshot → lead workflow)

---

## How to Update This File
At the end of a session, update "Current Work" with:
- What was being changed and why
- Which section of manager.html (use the section name)
- What's done vs. what's still left
- Any gotchas or decisions made along the way
