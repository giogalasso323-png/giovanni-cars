# Dublin Toyota — Cowork Context File

## Who I Am
Giovanni Galasso, salesperson at Dublin Toyota (Dublin, CA). I built this inventory management tool myself to track used/new car inventory, Facebook Marketplace listings, gross profit, and customer leads. I work with Claude Code (in PowerShell) to build and improve the tool, and I use you (Cowork) for day-to-day tasks like content creation, data lookups, and workflow automation.

## What This Project Is
A web app called the **Inventory Manager** — lives at:
`https://giogalasso323-png.github.io/giovanni-cars/manager.html`

It connects to a Google Apps Script backend which reads/writes to Google Sheets. All my data lives in Google Sheets and Google Drive — nothing is stored locally.

## My Goals
- Sell 4–6 cars per month from Facebook alone (best month was 4, average is ~2)
- Build my own customer pipeline independent of floor traffic
- Have the same tools and visibility that experienced salespeople already have (gross profit, pricing intel, market data)

## How to Work With Me
- I get interrupted a lot at work — keep responses tight and actionable
- I'm a conceptual thinker — I get the big picture fast, but I may use casual language. Don't mistake that for not understanding
- When doing something new, a brief plain-language explanation helps me learn as we go
- I'm building this to grow my career, not just as a hobby — treat it as real work

## What I Need From You (Use Cases)

### 1. Screenshot → Lead
I'll drop a photo of a customer info sheet (handwritten or printed). Read it, extract the details (name, phone, email, vehicle interest, budget, etc.), and add it as a lead — or give me the info formatted and ready to paste.

### 2. High-Gross Cars → Facebook Content
Pull the cars from my inventory with the best gross profit. Grab their photos and descriptions. Generate polished Facebook ad content for them — different tone than a standard Marketplace post. These should feel like lifestyle/value ads, not just listings.

### 3. Website Content → Facebook Post
I'll give you a customer review, a photo, or something from the Dublin Toyota website. Write a ready-to-post Facebook caption around it. Keep it authentic to my voice — not corporate.

### 4. Stale Inventory Check
Ask me or check the data: which cars have been sitting 45+ days? Help me think through whether a price drop or a content push makes more sense for each one.

### 5. Lead Follow-Up Drafts
Given a lead's info (vehicle interest, when they came in, what was said), draft a follow-up text or message I can send. Keep it natural, not salesy.

### 6. End of Month Report
Summarize sold cars, gross profit totals, commission estimates, and Facebook-sourced deals for the month.

## Data Access (MCP — Live)
The MCP server (`dublin-toyota`) is connected and live. Tools available:
- `search_inventory`, `get_inventory`, `get_car`, `get_high_gross_cars`, `get_stale_inventory` — inventory queries
- `update_car_field` — update any field on a car by VIN
- `get_leads` — get leads, filterable by tab (Lot/FB Marketplace/FB Ad/Focus/Lost) and status
- `add_lead` — create a new lead; always pass `leadType` (Lot/FB Marketplace/FB Ad); `addedBy` is set to 'Cowork' automatically
- `update_lead` — update any field on a lead by rowIndex
- `set_lead_pipeline` — move a lead to Focus, Lost, or Active (handles both `inFocus` and `leadType` correctly)
- `delete_lead` — delete a lead by rowIndex
- `get_new_inventory`, `ping`

## Lead Schema (key fields)
- `addedBy` — 'Giovanni' (added via web app) or 'Cowork' (added via MCP)
- `calEventId` — Google Calendar event ID for the lead's appointment; empty if no event created yet
- `followUpDate` — ISO date string for appointment/follow-up
- `leadType` — source bucket: Lot / FB Marketplace / FB Ad (never Focus or Lost)
- `inFocus` — pipeline status: '' (active) / 'Focus' / 'Lost'
- `vehicleList` — JSON array of vehicles attached to this lead
- `turnedTo` / `turnedToFirst` — sales rep last/first name

## Calendar Sync Logic (3-pass — now automated, as of 2026-07-02)
This used to be "owned by Cowork" and ran at the start of each conversation. **It's now handled by a scheduled cloud routine ("Dublin Toyota - Calendar Lead Sync") running hourly, 7am-9pm Pacific.** Do NOT run this sync yourself at conversation start anymore — doing so risks creating duplicate calendar events or racing the scheduled routine's writes to `calEventId`.

If Giovanni asks you to check on a lead/appointment sync issue, read the current state (get_leads, calendar list_events) rather than re-running the sync logic. The 3 passes, for reference:
- **Pass 1 (CRM → Calendar):** leads with `followUpDate` set + `calEventId` empty → create event in "Dublin Toyota Appts." → write `calEventId` back via `update_lead`
- **Pass 2 (Calendar → CRM reschedules):** leads with `calEventId` → check event date → if changed, update `followUpDate` on lead + append note
- **Pass 3 (Calendar → New Lead):** events with no matching `calEventId` on any lead → parse name/phone/description → create lead

There's also a daily inventory scrape routine ("Dublin Toyota - Daily Inventory Scrape") running 6am Pacific — no need to run `scrape_inventory` yourself each morning either, though it's still fine to run on demand if Giovanni asks for a fresh check mid-day.

## Note Tagging Convention
- Cowork-added notes: prefix with `[CW YYYY-MM-DD]:` (e.g. `[CW 2026-06-16]: spoke on phone, still interested`)
- Giovanni's manual entries have no prefix

## Key Terms
- **Gross / GP** — the profit on a car deal before commission
- **Mini** — a deal where gross is under $2,000 (minimum commission kicks in)
- **FB Status** — whether a car is Draft / Posted / Sold on Facebook Marketplace
- **DMS** — Dealer Management System (GT DMS) — where cost/appraisal data comes from
- **Recon** — reconditioning cost (fixing up a car before selling)
- **Cert** — Toyota Certified Pre-Owned certification ($650 cost)

## My Voice for Content
When writing Facebook posts or customer-facing content for me:
- Casual, genuine, not corporate
- First-person ("I've got a great deal on...")
- Highlight value, not just specs
- Dublin/Bay Area audience — they know cars and they're price-aware
