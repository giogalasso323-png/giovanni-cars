# Session Handoff — Dublin Toyota Inventory Manager

**Instructions for Claude:** Read this file at the start of every session to pick up where we left off. Update the "Current Work" section before ending any session that had in-progress changes. Clear it when the work is fully shipped.

---

## Current Work
_Nothing in progress. Ask Giovanni what to work on._

---

## Recently Completed
- 2026-06-15: Built MCP server (`mcp-server/`) connecting Claude Cowork (desktop app) to inventory via Google Apps Script. 11 tools: search_inventory, get_car (VIN or stock#), get_high_gross_cars, get_stale_inventory, get_leads, add_lead, update_lead, delete_lead, update_car_field, get_new_inventory, ping. Config at `C:\Users\gioga\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json`. Also fixed 3 gaps: stock# lookup, keyword/model filtering, slim records.
- 2026-06-15: Redesigned Leads tab — 5 type tabs (Lot, FB Marketplace, FB Ad, Focus, Lost), origin tag badge, Move to Focus/Lost buttons, multi-vehicle drawer with commission range (bottom–top) sorted high to low, + Add Car / remove per car. Also updated apps-script.js LEADS_COLUMNS to include leadType, inFocus, turnedTo.
- 2026-06-14: Added section markers (`// ===== SECTION: NAME =====`) throughout manager.html for fast navigation. Updated CLAUDE.md with full section/function map. Created this SESSION.md file.

---

## Known Issues / Next Up
- Apps Script needs to be redeployed (new version) after LEADS_COLUMNS change so new fields (leadType, inFocus, turnedTo) are recognized server-side
- MCP server: sync_inventory tool (web scrape from Cowork) not yet built
- Cowork integration: add_lead in MCP should include leadType field

---

## How to Update This File
At the end of a session, update "Current Work" with:
- What was being changed and why
- Which section of manager.html (use the section name)
- What's done vs. what's still left
- Any gotchas or decisions made along the way
