# Session Handoff — Dublin Toyota Inventory Manager

**Instructions for Claude:** Read this file at the start of every session to pick up where we left off. Update the "Current Work" section before ending any session that had in-progress changes. Clear it when the work is fully shipped.

---

## Current Work
_Nothing in progress. Two open threads under discussion (not started building):_
- _Whether to stand up Hermes Agent (self-hosted, Nous Research) for SMS/Telegram/WhatsApp access to the same MCP tools, powered by Claude via a separate Anthropic API key. Researched, not decided._
- _A "Command Center" — unified dashboard aggregating inventory/leads/calendar + a shared activity feed that Hermes/Cowork/scheduled routines could all write into. Naming settled ("Command Center"), scope not finalized — a separate conversation on the laptop proposed a different phasing (Gmail/Calendar MCP → chat in manager.html → Hermes hub) that hasn't been reconciled with this one yet. Ask Giovanni which framing to run with before building either._

**Cross-machine note:** Giovanni works from this desktop and a separate work laptop, each with its own independent git clone AND its own independent Claude Code memory — memory does not sync between machines, only this file (and code) does via git. `git pull` before starting work on either machine; update this file before ending a session that had real changes.

---

## Recently Completed (2026-07-05 to 07-07)

**isUpcoming migration + Upcoming tab overhaul:**
- Replaced the old fragile `appraisedValue>0 && !color` inference with an explicit, persisted `isUpcoming` boolean column — set true on cost-import stub creation, cleared false the moment a regular used-car CSV import matches/enriches that VIN (the real "graduation" event). Backfilled ~198 pre-existing colorless stub rows that had been invisible to every tab.
- Rebuilt the Upcoming tab as an actual 4-column table (Stock#/Make-Model/Details/Appraisal Values) matching Giovanni's real vAuto Appraisals view, with alternating row shading — replaced two earlier card-based attempts once he shared a screenshot of the real DMS layout.
- Added persisted `importBatchTime`/`importRowOrder` fields (one shared timestamp per cost-import call + each record's position in it), replacing the old `_importOrder` (never persisted, lost on reload) and `addedDate`-based sort (each car's own DMS date, not import recency) — re-stamped on every re-import of a VIN so a car freshly modified in vAuto jumps back near the top on the next import.
- Added `disp`/`apprStatus`/`apprCertified` columns — display-only context, deliberately never used for filtering (Giovanni confirmed the DMS "Disp: Wholesale/Retail" field is an unreliable manual toggle: "thats bullshit it means nothing").
- Added two view-only Upcoming tab filters: "Price or Certified only" checkbox + "last N days" input (default 90) — both purely display-level, never hide/delete underlying data.
- **Bug found & fixed 2026-07-07:** the Upcoming tab's new sort was dead code — a generic `sortKey==='date-desc'` check earlier in the same sort function always fired first (sortKey defaults to `'date-desc'` app-wide, nothing reset it per-tab), so the import-batch sort never actually ran. Fixed by moving the upcoming-specific check ahead of the generic one.
- Confirmed a specific "missing" car report (stock T50439A) was correct behavior, not a bug — it had genuinely graduated (color assigned via a real inventory import) and moved to Unposted/All as expected.

**getSpreadsheet() reliability fix (from the laptop, merged in 2026-07-07):**
- Replaced all 6 `SpreadsheetApp.getActiveSpreadsheet()` call sites (Leads/Settings/Inventory/New-Inventory get/import/update) with a `getSpreadsheet()` helper backed by a hardcoded `SPREADSHEET_ID` constant — `getActiveSpreadsheet()` is unreliable when the script runs as a deployed web app / automated trigger rather than from an open browser tab. Merged cleanly with this week's other apps-script.js changes (different regions of the file), redeployed, confirmed working via `get_car`.
- Also brought in two new files from the laptop: `dublin-toyota.skill`, `facebook-posts-2026-06-23.md` — not yet reviewed in depth on the desktop.

**Other fixes this week (see `project_data_integrity_fixes_2026-07.md` in Claude's memory on this desktop for full detail — not synced to the laptop):**
- LockService added to upsertMany/updateField/importCostData (race condition on concurrent sheet writes)
- Fixed case-sensitive fbStatus 'Sold' vs 'sold' availability leak in search/recommendation tools
- Fixed Not Listed tab (was checking a cosmetic label that was never actually written to data)
- Fixed days-on-lot using addedDate instead of DMS-sourced `dis`
- Fixed blank-price CSV re-import bug (blank cell parsed as 0, overwrote a real price)

---

## Recently Completed (2026-06-29)

**Cloud portability upgrade (Option 2):**
- New Google account created for project (separate from personal Gmail)
- Apps Script redeployed on new account — same Sheet (shared), new URL now hardcoded in manager.html
- Setup screen and localStorage URL override removed from manager.html — URL is baked in
- MCP server converted from stdio → HTTP (StreamableHTTPServerTransport + Express)
- MCP server deployed to Railway: `https://dublin-toyota-inventory-production.up.railway.app`
- Claude.ai connected to Railway via Settings → Integrations
- Cowork now works from phone, tablet, or any computer — no PC required
- Image → lead workflow works directly in Claude.ai (attach photo → "add as lead")

**Railway config:**
- Repo: `giovanni-cars`, Root Directory: `mcp-server`, Port: 8080
- Env var: `SCRIPT_URL` = new Apps Script deployment URL
- Cost: ~$5/month

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

---

## Future Features
1. **Claude.ai Project for Cowork** — load skill instructions automatically, no copy-paste each session
2. ~~**Daily scheduled agent** — morning inventory scrape + stale car report~~ — scrape + calendar sync routines built and running (see cloud routines)
3. **Follow-up reminders** — surfaces leads with past-due follow-up dates each morning
4. **Multi-rep Cowork** — other salespeople connect their own Claude.ai to same Railway server
5. **FB posting from Upcoming** — post to Facebook from the Upcoming tab
6. **Search by appraiser name** — filter Upcoming by who took the trade
7. **Google Drive "Lead Inbox" folder** — not yet created (for phone screenshot → lead workflow — now less needed since Claude.ai handles it directly)
8. **"Command Center" dashboard** — under discussion, not started. Unified view of inventory + leads + calendar + a new shared activity feed (new sheet tab + `log_activity`/`get_activity_feed` MCP tools) that Hermes, Cowork, and scheduled routines could all write into. See "Current Work" above for the unreconciled competing framing from the laptop.
9. **Hermes Agent integration** — researched, not decided. Self-hosted (Railway, ~$5-10/mo) + Claude via separate Anthropic API key (~$15-60/mo est. usage) would give SMS/Telegram/WhatsApp access to the same MCP tools. Keep any actual codebase/deploy work exclusively in Claude Code sessions regardless — Hermes would only read/write data through the MCP server.

---

## Known Issues / Notes
- `scrape_inventory` MCP tool requires Cowork restart after each code push (local process) — no longer relevant, Railway auto-restarts on push
- No AUTH_TOKEN on Railway MCP server currently — security through obscurity (long URL). Add OAuth later if needed.

---

## How to Update This File
At the end of a session, update "Current Work" with:
- What was being changed and why
- Which section of manager.html (use the section name)
- What's done vs. what's still left
- Any gotchas or decisions made along the way
