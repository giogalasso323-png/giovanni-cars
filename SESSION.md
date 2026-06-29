# Session Handoff — Dublin Toyota Inventory Manager

**Instructions for Claude:** Read this file at the start of every session to pick up where we left off. Update the "Current Work" section before ending any session that had in-progress changes. Clear it when the work is fully shipped.

---

## Current Work
_Nothing in progress. Ask Giovanni what to work on._

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
2. **Daily scheduled agent** — morning inventory scrape + stale car report
3. **Follow-up reminders** — surfaces leads with past-due follow-up dates each morning
4. **Multi-rep Cowork** — other salespeople connect their own Claude.ai to same Railway server
5. **FB posting from Upcoming** — post to Facebook from the Upcoming tab
6. **Search by appraiser name** — filter Upcoming by who took the trade
7. **Google Drive "Lead Inbox" folder** — not yet created (for phone screenshot → lead workflow — now less needed since Claude.ai handles it directly)

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
