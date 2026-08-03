# Session Handoff — Dublin Toyota Inventory Manager

**Instructions for Claude:** Read this file at the start of every session to pick up where we left off. Update the "Current Work" section before ending any session that had in-progress changes. Clear it when the work is fully shipped.

---

## Current Work

### Shipped 2026-08-02

**Vehicle match system:**
- `check_vehicle_matches` MCP tool in mcp-server/index.js — returns all `vehicleNotAvailable: true` leads with keyword/price-filtered potential inventory matches
- "Check Matches" button in Waiting board column → client-side modal using in-memory leadsData + inventory
- SKILL.md: morning agent instructions to run vehicle match after scrape and output a daily report

**New car daily scrape:**
- `scrape_new_inventory` MCP tool in mcp-server/index.js — same offset/limit paging as used car scrape, limit 4 per call, filters online + stop-sale cars only
- `saveNewScrapeResults()` in apps-script.js — batch saves websiteUrl/websiteStatus/websitePrice/lastChecked for a chunk in one sheet pass (replaces 4 individual updateNewCar calls per car)
- SKILL.md updated: morning agent runs Part 1B (new car scrape) after used car scrape, before vehicle match phase
- Giovanni updated the "Dublin Toyota — Daily Inventory Scrape" agent in Claude.ai to include Part 1B

**Notes in new car drawer:**
- `notes` field (from Dealer Daily imports — deposits, holds, remarks) now shows as editable textarea in new car drawer
- `saveNewCarNote()` already existed; just wired up the UI

**Zombie leads via calendar sync — FIXED:**
- Root cause: Calendar Lead Sync Pass 3 was recreating deleted leads from orphaned calendar events (~30 min after deletion)
- Fix: Giovanni replaced the calendar sync agent prompt in Claude.ai — Pass 3 (Calendar→New Lead) removed entirely
- Sync now only runs Pass 1 (CRM→Calendar) and Pass 2 (Calendar reschedules→CRM)
- Leads now only enter the system through Cowork conversations or the manager app

**New inventory category badges + Est. Arrival:**
- G/F/A category field now displays as styled badges: G = blue circle, F = grey box, A = green box
- Badges show next to model name in list view; full label shown in drawer ("Ground — at dealership", "In transit", "Allocated by Toyota")
- `estArrival` field added to NEW_INV_COLUMNS in apps-script.js; shows under DIS in list and as dedicated field in drawer
- SKILL.md: explicit CSV column→field mappings added for new car import (Cat.→category, Est. Arrival→estArrival, etc.)

**All fully deployed — Apps Script redeployed and new car CSV reimported 2026-08-02.**

### Discord Bot — SCOPED, NOT BUILT YET
Next build: Discord bot on always-on home PC that relays messages to Claude Code.
- Different Discord channels = different agent contexts (#cowork, #briefing, #alerts, #inventory)
- No timeout issue (Discord message listener uses persistent WebSocket, unlike Telegram's 60s webhook)
- Uses Pro subscription (flat rate), not Anthropic API key — no per-token cost
- Bot runs locally on PC alongside Claude Code, no Railway needed
- Long responses split into chunks (Discord 2000 char limit per message)
- **Not started** — scope the build next session on desktop

### OpenClaw — BACK BURNERED 2026-07-11
Paused due to API cost ($10/day testing). Plan: revisit when running a local model (Mistral Small 24B on RTX 5070 Ti gaming PC). For now, Cowork stays on Claude.ai web.
- URL: `openclaw-production-36f8.up.railway.app` (still deployed, just not actively used)
- Telegram bot: token `8826631621:AAGfdu9ivfm0PD1C9KjDFwGqhhaRgwa7sbU`
- Model: `anthropic/claude-sonnet-4-6` ← must stay Sonnet; Haiku does not follow skill instructions reliably
- MCP server: `https://dublin-toyota-inventory-production.up.railway.app/mcp` (18 tools, streamable-http)
- Skill: `dublin-toyota` installed at `/data/workspace/skills/dublin-toyota`
- Access control: approval-based (users must request access, Giovanni approves via `openclaw pairing approve telegram <code>`)

**Skill update process (when SKILL.md changes):**
1. Edit `skill-extract/dublin-toyota/SKILL.md` locally
2. `MSYS_NO_PATHCONV=1 railway volume files -v openclaw-volume upload ./skill-extract/dublin-toyota/SKILL.md /workspace/skills/dublin-toyota/SKILL.md --overwrite`
3. `railway redeploy --service openclaw --yes`
(No need to repackage the .skill zip — upload directly to the volume)

**lup trigger — how it works:**
- Skill description includes "lup" as a keyword so the skill activates on it
- Shortcut `lup` fires and sends an explicit prompt so Sonnet knows exactly what to do
- Do NOT use `/lup` (Telegram slash command format) — it creates a session conflict in OpenClaw
- Do NOT switch to Haiku — it ignores skill instructions

**Setup bugs worked around (for reference if re-deploying):**
1. `OPENCLAW_ENTRY` env var set to `"node"` by template → delete it entirely from Railway Variables
2. Setup wizard writes wrong model prefix (`openai/claude-sonnet-4-6`) → fix with `openclaw config set agents.defaults.model.primary anthropic/claude-sonnet-4-6`
3. Setup wizard adds invalid `streamMode` to Telegram config → use `openclaw channels add --channel telegram --token <token>` instead
4. Skill install: `.skill` file is a ZIP → download + unzip + `openclaw skills install /tmp/dublin-toyota --as dublin-toyota`
5. Web Control UI doesn't work from browser (gateway bound to loopback) → expected, use Telegram instead

**Still to verify:** calendar `calEventId` write-back (create event + write ID to lead in one flow)

### Hermes Agent on Railway — paused 2026-07-07, blocked on upstream bugs
Deployed via Railway's official template (`railway.com/deploy/hermes-agent-nousresearch`), new separate project from the MCP server. Progress made:
- Dashboard username/password set, deployed successfully, public URL live at `hermes-agent-production-ce01.up.railway.app`
- Anthropic API key added (separate ~$20 prepaid credit, own billing, not tied to claude.ai subscription) and confirmed saved
- Model set to `claude-sonnet-5` via Anthropic (both in dashboard Settings and via CLI `hermes model`)
- Telegram bot created via @BotFather, token entered, channel shows "2 of 31 configured"
- `GATEWAY_ALLOW_ALL_USERS` left at its template default (`true`) — **not yet locked down to Giovanni's Telegram user ID only**, worth fixing before this goes live for real, since anyone finding the bot's username could currently use it against dealership data

**Three real upstream bugs hit in a row (confirmed via GitHub issues, not our misconfiguration):**
1. Hermes dashboard crashes (`NotImplementedError: BasicAuthProvider is password-only`) on any admin action (Restart Gateway, Save channel config) when using basic username/password auth on a non-loopback (remote/Railway) deployment. Known, unfixed upstream (GitHub #57294 + 5 duplicate issues). Workaround found: use Railway's own service-level Restart (Deployments tab → ⋮ → Restart) instead of Hermes's in-dashboard button — that bypasses the buggy code path.
2. Tried pinning an older Docker image tag (`v2026.6.19`) hoping to dodge bug #1 — made things worse (container now gets SIGTERM'd by Railway almost immediately after boot, total failure). Reverted back to `latest`, which returned to the "mostly works, specific actions crash" state from bug #1.
3. **Currently blocking**: sending a Telegram message returns "provider authentication failed." Root cause confirmed via request debug dump: when Hermes can't cleanly resolve the Anthropic credential on the direct-Anthropic adapter, it silently falls back to a broken OpenAI-style request (`POST https://api.anthropic.com/chat/completions` instead of the real `/v1/messages`, with `Authorization: Bearer None`) instead of erroring clearly. Known, unfixed upstream (GitHub #12905, #54206) — a related PR (#54221) exists but its merge status is unclear, no fix timeline found. **Confirmed this bug is deployment-agnostic — it would also hit a local/desktop Hermes install, not just Railway**, since it's a credential-resolution bug in request-building, not a network/binding issue (unlike bug #1, which specifically requires non-loopback binding).

**Not yet tried:** switching the provider from direct Anthropic to **OpenRouter** (a real OpenAI-style `/chat/completions` API) and selecting Claude through that instead — since bug #3 is specifically about the direct-Anthropic adapter using the wrong endpoint shape, routing through OpenRouter (which genuinely uses that endpoint shape) would likely sidestep it entirely. Requires a separate OpenRouter account/API key/billing. This is the most promising next step if picking this back up.

**Decision point for next time:** try the OpenRouter route, wait for upstream fixes to bugs #1/#3 and retry direct Anthropic, or shelve Hermes entirely. Not decided — Giovanni paused here after hitting three real bugs in one sitting, reasonably frustrated with the state of the software tonight.

**Cross-machine note:** Giovanni works from this desktop and a separate work laptop, each with its own independent git clone AND its own independent Claude Code memory — memory does not sync between machines, only this file (and code) does via git. `git pull` before starting work on either machine; update this file before ending a session that had real changes.

---

## Recently Completed (2026-07-20 to 07-31)

**Zombie leads — actual root cause found and fixed (2026-07-31):**
- The real bug: Apps Script always answers HTTP 200 even on a logical failure (e.g. "Lead not found"), so the frontend's `fetch()` never rejected for that case, and most call sites never checked the response body for an `error` field. Deleting a lead, and dragging a card to a new board column, both updated the screen (or removed the card) *before* the write finished, with several paths having zero error handling — so a failed write looked identical to a successful one until a real reload pulled the untouched row back.
- Fixed centrally in `apiFetch` (throws on any response with `.error`, one fix instead of patching every call site) + added recovery (toast + reload from server) to the two board-move paths and the Focus toggle that had no error handling.
- This superseded an earlier (2026-07-20) fix that switched lead identity from raw sheet row number to a persistent `leadId` — real bug in its own right (row numbers shift on delete, corrupting concurrent operations), but not the one actually causing the reported symptom.
- Added duplicate-lead protection as a secondary hardening: `submitLead` rejects a same-phone resubmission within 2 minutes (catches retried Cowork calls / double-clicks), Add Lead modal disables its submit button while in flight. Confirmed via live data pull (fetched the Leads sheet directly) that zero actual duplicate rows exist — so this wasn't the cause of what Giovanni saw, but closes off a real gap regardless.

**New "Turned" pipeline column:**
- Leads created with `turnedTo`/`turnedToFirst` set and no explicit pipeline stage now land in a dedicated "Turned" board column (New Lead → Working → Turned → Appt → Be Back → Waiting → Cold) instead of "New Lead", and stay there until manually moved. Covered in the Add Lead modal, the backend default, and Cowork's `add_lead` MCP tool.

**New Cars tab — photo download + web link parity with used inventory:**
- Bulk-select checkboxes + Download Photos action bar, same zero-padded/order-prefixed zip approach as used inventory (see below), backed by a new `photosDownloadedDate` field.
- Fixed a real pre-existing bug found along the way: the New Inventory sheet wrote fields by hardcoded array position but read them back by header-text lookup, so any newly-added field would write successfully but silently never read back. Added the same header auto-repair `getNewInventory`/used-Inventory already had.
- The "Live" status badge in the New Cars table is now a clickable link straight to the DublinToyota.com listing (was previously a dead-end label — had to open the drawer to get the link). Requires "Refresh Web Data" to have been run at least once per car; the FB description does not (builds entirely from CSV-imported fields).
- New Cars are NOT covered by the automated morning scrape — only `scrape_inventory` (used cars) is exposed as an MCP tool. See Current Work above.

**FB Posted 2 tab + bulk photo download fixes:**
- The amber "Downloaded" badge was checking the primary account's posted status even on the FB Posted 2 tab, so it never lit up there — now account-aware.
- Bulk photo ZIP download: photo filenames are now zero-padded (`01.jpg` not `1.jpg`) and each car's folder gets a `01 -`, `02 -`... selection-order prefix. The actual fetch/assembly order was always correct — the scrambling was Explorer/Finder re-sorting alphabetically on extraction, which mangles unpadded numbers (`1, 10, 11, 2, 3...`).

**Railway/claude.ai OAuth reconnect fix:**
- claude.ai's custom-connector flow started assuming every remote MCP server requires OAuth with no "no auth" opt-out in its UI (confirmed via multiple open `anthropics/claude-ai-mcp` GitHub issues, e.g. #402) — was 404ing on `/authorize` against our server, which was built with no auth (long URL = the security model). Added a minimal OAuth 2.1 shim (discovery metadata, dynamic client registration, auto-approve `/authorize`, `/oauth/token`) so the handshake completes; doesn't change `/mcp`'s actual (still unauthenticated) behavior.

---

## Recently Completed (2026-07-11 — desktop session)

**Claude.ai project instructions fully rebuilt:**
- Merged OpenClaw SKILL.md changes into Claude.ai project instructions
- Added: Stock Number Guide, lup workflow, gc trigger, Be Back text template, appointment rescheduling, inventory matching with linking + follow-up draft
- Added: Car Availability Rules — "Check FB — Delist" = 99% sold, never recommend. Upcoming = flag as "coming soon" not P2/P3. Always pass `excludeSold: true` for P2/P3 searches.
- Added: Non-Toyota make fallback — if brand search returns 0, search by model name; if still 0, search "other"
- Updated P2/P3 report cards to show ✅ On Lot / ⏳ Coming Soon label
- Removed get_high_gross_cars from tools list (use search_inventory by model instead)
- Desktop instructions saved to `new-project-instructions.txt` on Desktop for reference

**MCP server fixes (deployed to Railway):**
- Raised search_inventory + get_inventory default limit from 100 → 2000 — was silently missing cars beyond position 100
- Simulation confirmed: Outback search by model name now works, brand name search returns 0 as expected (make = "Other" is a DMS data issue, not fixable here)

**Architecture decisions:**
- OpenClaw back-burnered — API costs too high ($10/day). Cowork stays on Claude.ai web.
- Local model (Mistral 24B on 5070 Ti) ruled out for skill-following tasks — same reliability as Haiku, which already fails skill instructions
- Claude Pro flat rate beats API key for cost. Always-on PC + Claude Code = scheduled automation; Claude.ai mobile = interactive use on the lot.
- Discord bot concept scoped as next build — channels as agent contexts, no timeout issue, no API costs

**Memories saved:**
- `project_new_inventory_roadmap.md` — CSV upload stale, future = website scrape
- `project_battle_station.md` — daily dashboard concept, channel ideas, subagent architecture notes

---

## Recently Completed (2026-07-07 — laptop session)

**Cross-machine sync resolved:**
- Laptop had been behind since 2026-06-29 (22 commits on origin it didn't have). Committed the local `getSpreadsheet()` fix + `dublin-toyota.skill` + `facebook-posts-2026-06-23.md`, fetched, merged cleanly (no conflicts), pushed. Desktop and laptop are now fully in sync at `3ceb801`.

**Research session (no code changes):**
- Hermes Agent — researched in depth: persistent memory (3-layer), YOLO mode for permissions, Railway deployment templates, local Ollama setup on 5070 Ti (Mistral Small 24B recommended). Confirmed RTX 5070 Ti = 16GB VRAM, fits Mistral 24B at Q4.
- Cross-machine building: established that Railway-hosted Hermes is edit-from-anywhere via git (same as MCP server), whereas local Hermes requires Tailscale to reach from laptop/phone.
- Claude Managed Agents — Anthropic's native equivalent (persistent memory, cron scheduling, "Dreaming" self-improving memory). Public beta April 2026. API-level/platform product, not on $20 Pro plan.
- GoHighLevel — full CRM/marketing platform, automotive dealership templates, official MCP server (21 tools, roadmap 250+). $97/month minimum + SMS usage. Powerful for automated follow-ups + two-way texting but expensive for one salesperson.
- Unified dashboard ("Command Center") — three-phase approach proposed from laptop: (1) Gmail + Google Calendar MCP into Cowork, (2) AI chat panel embedded in manager.html, (3) Hermes dashboard as long-term hub. Not yet reconciled with the desktop's framing — see Current Work above.

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
