# Session Handoff — Dublin Toyota Inventory Manager

**Instructions for Claude:** Read this file at the start of every session to pick up where we left off. Update the "Current Work" section before ending any session that had in-progress changes. Clear it when the work is fully shipped.

---

## Current Work
_Self-hosted AI agent (Hermes / OpenClaw) attempts on Railway — both paused mid-setup, both blocked by real upstream bugs (not our config). Two platforms, two blocking bugs, same night — see status below before trying a third._
- _"Command Center" — unified dashboard aggregating inventory/leads/calendar + a shared activity feed that Hermes/Cowork/scheduled routines could all write into. Naming settled ("Command Center"), scope not finalized — a separate conversation on the laptop proposed a different phasing (Gmail/Calendar MCP → chat in manager.html → Hermes hub) that hasn't been reconciled with this one yet. Ask Giovanni which framing to run with before building either._

### OpenClaw setup on Railway — also paused 2026-07-07, blocked on a template bug
Tried right after shelving Hermes (see below), using the `codetitlan/openclaw-railway-template` one-click Railway template (separate new project, `openclaw-production-36f8.up.railway.app`). Progress made: deployed fine, logged into the setup wizard (note: username field is ignored/decorative, only `SETUP_PASSWORD` matters — and the password typed into Railway's pre-deploy config screen didn't actually save, had to pull the real auto-generated value from Railway's Variables tab instead), picked Anthropic as provider, model `anthropic/claude-sonnet-5`, entered the same Telegram bot token.
**Blocked on**: clicking "Run Setup" crashes with `Error: Cannot find module '/app/node'` (`MODULE_NOT_FOUND`, `[setup] Onboarding exit=1 configured=false`). Root cause looks like this specific template's `OPENCLAW_ENTRY` env var is misconfigured — it's set to the literal string `"node"`, and the startup script appears to do something like `require('/app/' + OPENCLAW_ENTRY)` instead of using it as "run with the node interpreter," so it tries to load a nonexistent module path. This looks like a bug in this particular community-maintained template, not OpenClaw itself — several other OpenClaw Railway templates exist from different maintainers (arjunkomath, vignesh07, bb-claw, derekcheungsa, Dovekey) that weren't tried.
**Decision point for next time**: try a different OpenClaw template, or fix `OPENCLAW_ENTRY` by hand (needs checking this template's actual source repo for the correct entry file path — not yet investigated).
**Cost note**: this `openclaw` Railway service is still deployed and running right now, same as the Hermes one — if not picking this back up soon, worth pausing/deleting both services in Railway so they're not quietly accruing usage cost while idle.

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
