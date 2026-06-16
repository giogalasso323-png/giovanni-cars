# Session Handoff — Dublin Toyota Inventory Manager

**Instructions for Claude:** Read this file at the start of every session to pick up where we left off. Update the "Current Work" section before ending any session that had in-progress changes. Clear it when the work is fully shipped.

---

## Current Work
_Nothing in progress. Ask Giovanni what to work on._

---

## Apps Script — Deploy Reminder ⚠️
**Still needs a NEW VERSION deployment.** New columns won't write server-side until this is done:
- `addedBy`, `calEventId` (new this session)
- `leadType`, `inFocus`, `turnedTo`, `vehicleNotAvailable`, `vehicleInterest`, `turnedToFirst` (from previous sessions)

Go to Apps Script editor → Deploy → Manage Deployments → New Version

---

## Recently Completed (2026-06-16)

**Leads system overhaul:**
- Fixed "lead trays stuck" bug — `lead.phone` came from Sheets as a number, `.replace()` crashed. Fixed with `String()` coerce.
- Added `addedBy` + `calEventId` fields to LEADS_COLUMNS in manager.html and apps-script.js
- Manual leads tagged `addedBy: 'Giovanni'`, MCP leads tagged `addedBy: 'Cowork'`, website form leads tagged `addedBy: 'Website'`
- Added **Website tab** to leads (6 tabs total: Lot/FB Marketplace/FB Ad/Website/Focus/Lost), green color
- Website form leads (index.html) now pass `leadType: 'Website'` and `addedBy: 'Website'`

**MCP server upgrades:**
- Added `import_cost_data` — single-call DMS XLS cost import via importCostData action
- Added `import_used_cars` — bulk upsert used cars from parsed CSV/XLS
- Added `import_new_cars` — bulk import new car CSV
- Added `scrape_inventory` — website sync, paginated (25 cars/call, offset parameter), returns nextOffset so Cowork loops until done:true
- Added `set_lead_pipeline` — moves lead to Focus/Lost/Active correctly
- Updated `get_leads` — tab + status filters, _tab and _sourceType fields on each lead
- Updated `add_lead` — leadType, addedBy fields added
- Updated COWORK.md with full MCP tool list, lead schema, calendar sync instructions, note tagging convention

**Cowork import session:**
- Cowork successfully imported: 165 used cars updated, 487 cost records (batched), 407 new cars
- Scrape ran (timed out on Cowork side but completed on Google's servers) — data updated in app
- Scrape tool now paginated to avoid future timeouts

---

## Known Issues / Next Up
- Apps Script new version deployment (see above — still pending)
- Google Drive "Lead Inbox" folder not yet created (for phone screenshot → lead workflow)
- `scrape_inventory` MCP tool requires Cowork restart after each code push (local process)

---

## How to Update This File
At the end of a session, update "Current Work" with:
- What was being changed and why
- Which section of manager.html (use the section name)
- What's done vs. what's still left
- Any gotchas or decisions made along the way
