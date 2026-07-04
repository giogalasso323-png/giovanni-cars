import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import express from 'express';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const env = readFileSync(join(__dirname, '.env'), 'utf8');
  env.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length) process.env[key.trim()] = val.join('=').trim();
  });
} catch {}

const SCRIPT_URL  = process.env.SCRIPT_URL  || '';
const AUTH_TOKEN  = process.env.AUTH_TOKEN  || '';
const PORT        = process.env.PORT        || 3000;

async function callScript(action, body = {}, attempt = 1) {
  const response = await fetch(`${SCRIPT_URL}?action=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
    redirect: 'follow'
  });
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.includes('application/json')) {
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 500 * attempt));
      return callScript(action, body, attempt + 1);
    }
    throw new Error(`Apps Script returned non-JSON (status ${response.status}) after ${attempt} attempts for action "${action}"`);
  }
  return JSON.parse(text);
}

function getMileageAdder(car) {
  const mileage = Number(car.mileage) || 0;
  const age = new Date().getFullYear() - (Number(car.year) || new Date().getFullYear());
  const mBracket = mileage < 30000 ? 0 : mileage < 60000 ? 1 : mileage < 90000 ? 2 : mileage < 120000 ? 3 : 4;
  const aBracket = age <= 3 ? 0 : age <= 6 ? 1 : age <= 10 ? 2 : 3;
  const matrix = [
    [0,    300,  750,  1250, 2000],
    [300,  600,  1100, 1700, 2500],
    [600,  1000, 1600, 2200, 2500],
    [1000, 1500, 2200, 2500, 2500],
  ];
  return Math.min(matrix[aBracket][mBracket], 2500);
}

function calcGross(car) {
  const price = Number(car.price) || 0;
  const appraised = Number(car.appraisedValue) || 0;
  const cert = Number(car.certCost) || 0;
  const totalCost = appraised + 2000 + 500 + cert;
  const adder = getMileageAdder(car);
  const topGross = price - totalCost;
  const bottomGross = topGross - adder;
  const status = topGross < 2000 ? 'Mini' : bottomGross < 2000 ? 'Saveable' : 'Has Money';
  return { topGross, bottomGross, totalCost, adder, status };
}

function slim(car) {
  const { fbDescription, features, vehicleInfo, vehicleHistory, carfaxUrl, websiteUrl, ...rest } = car;
  return rest;
}

function createMcpServer() {
  const server = new Server(
    { name: 'dublin-toyota', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'ping',
        description: 'Check if the Dublin Toyota inventory system is online.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'scrape_inventory',
        description: 'Sync inventory with dublintoyota.com — checks current prices, availability, and sold status, then updates the sheet. Run in chunks of 15 (default) to avoid timeouts — do not pass a larger limit, each call already does one full sitemap fetch. Call repeatedly with offset to cover all cars. Returns { scraped, newDelistCount, errors, errorMessages, total, done } — newDelistCount is only vehicles newly flagged as delisted this run, not previously-known ones. done:true means all cars covered.',
        inputSchema: {
          type: 'object',
          properties: {
            limit:  { type: 'number', description: 'Cars to scrape per call (default 15, do not increase — see tool description)' },
            offset: { type: 'number', description: 'Start from this car index (default 0). Increment by limit each call to page through all inventory.' }
          }
        }
      },
      {
        name: 'search_inventory',
        description: 'Search used car inventory by model name, keyword, status, or price. Returns slim summaries (no FB descriptions). Use this for most searches — faster and more complete than get_inventory.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Keyword search across year, make, model, trim, color, stock (e.g. "RAV4 hybrid", "4Runner", "T50283A")' },
            fbStatus: { type: 'string', description: 'Filter by FB status: Draft, Posted, Sold' },
            excludeSold: { type: 'boolean', description: 'Set true to exclude sold cars (default false)' },
            minPrice: { type: 'number' },
            maxPrice: { type: 'number' },
            minDaysOnLot: { type: 'number' },
            withGross: { type: 'boolean', description: 'Set true to include gross profit calculation for each car' },
            limit: { type: 'number', description: 'Max results (default 100)' }
          }
        }
      },
      {
        name: 'get_inventory',
        description: 'Get used car inventory with filters. Returns slim summaries. Use search_inventory if you need keyword/model search.',
        inputSchema: {
          type: 'object',
          properties: {
            fbStatus: { type: 'string', description: 'Filter by FB status: Draft, Posted, Sold' },
            excludeSold: { type: 'boolean', description: 'Set true to exclude sold cars' },
            minPrice: { type: 'number' },
            maxPrice: { type: 'number' },
            minDaysOnLot: { type: 'number', description: 'Cars sitting at least this many days' },
            limit: { type: 'number', description: 'Max results (default 100)' }
          }
        }
      },
      {
        name: 'get_high_gross_cars',
        description: 'Get used cars sorted by highest gross profit. Only returns cars with cost data imported. Excludes sold cars by default.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Max results (default 10)' },
            minBottomGross: { type: 'number', description: 'Minimum bottom gross to include' },
            includeSold: { type: 'boolean', description: 'Set true to include sold cars (default false)' }
          }
        }
      },
      {
        name: 'get_stale_inventory',
        description: 'Get cars that have been on the lot longer than a given number of days, sorted oldest first. Excludes sold cars.',
        inputSchema: {
          type: 'object',
          properties: {
            days: { type: 'number', description: 'Days on lot threshold (default 45)' },
            limit: { type: 'number', description: 'Max results (default 30)' }
          }
        }
      },
      {
        name: 'get_car',
        description: 'Get full details for a single car by VIN or stock number.',
        inputSchema: {
          type: 'object',
          properties: {
            vin: { type: 'string', description: 'VIN number (e.g. 4T3R6RFV8MU015327)' },
            stock: { type: 'string', description: 'Stock number (e.g. T50283A) — use if VIN is unknown' }
          }
        }
      },
      {
        name: 'update_car_field',
        description: 'Update a single field on a car (price, fbStatus, fbDescription, notes, etc.).',
        inputSchema: {
          type: 'object',
          properties: {
            vin: { type: 'string' },
            field: { type: 'string' },
            value: { type: 'string' }
          },
          required: ['vin', 'field', 'value']
        }
      },
      {
        name: 'get_leads',
        description: 'Get customer leads from the CRM. Filter by tab: Lot, FB Marketplace, FB Ad, Focus, Lost. Each lead includes leadType (source bucket), inFocus (pipeline status), vehicleList, vehicleInterest, timeframe, status, and sales rep info.',
        inputSchema: {
          type: 'object',
          properties: {
            tab: { type: 'string', description: 'Filter by tab: Lot, FB Marketplace, FB Ad, Focus, Lost. Omit to get all.' },
            status: { type: 'string', description: 'Filter by status: New, One Way Communication, Two Way Communication, Cold, Appt, Sold, Lost' }
          }
        }
      },
      {
        name: 'add_lead',
        description: 'Add a new customer lead. Use when extracting info from a photo, screenshot, or conversation. leadType sets which source tab it appears in.',
        inputSchema: {
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            phone: { type: 'string' },
            vehicle: { type: 'string', description: 'Vehicle they are interested in (free text)' },
            vin: { type: 'string' },
            timeframe: { type: 'string', description: 'e.g. 3d, 1w, 2w, 1m, 3m' },
            leadType: { type: 'string', description: 'Source bucket: Lot, FB Marketplace, FB Ad (default: Lot)' },
            vehicleInterest: { type: 'string', description: 'Notes about what vehicle they are looking for' },
            notes: { type: 'string' }
          },
          required: ['firstName', 'phone']
        }
      },
      {
        name: 'update_lead',
        description: 'Update a field on an existing lead by row index. Common fields: firstName, lastName, phone, timeframe, status, vehicleInterest, notes, followUpDate, turnedTo, turnedToFirst.',
        inputSchema: {
          type: 'object',
          properties: {
            rowIndex: { type: 'number' },
            field: { type: 'string' },
            value: { type: 'string' }
          },
          required: ['rowIndex', 'field', 'value']
        }
      },
      {
        name: 'set_lead_pipeline',
        description: 'Move a lead to Focus or Lost, or return it to its source tab (Lot/FB Marketplace/FB Ad). Use this instead of update_lead for pipeline status changes — it correctly handles both inFocus and leadType fields.',
        inputSchema: {
          type: 'object',
          properties: {
            rowIndex: { type: 'number', description: 'Lead row index from get_leads' },
            pipeline: { type: 'string', description: 'Focus, Lost, Sold, or Active (Active returns it to its source tab)' }
          },
          required: ['rowIndex', 'pipeline']
        }
      },
      {
        name: 'delete_lead',
        description: 'Delete a lead by row index.',
        inputSchema: {
          type: 'object',
          properties: {
            rowIndex: { type: 'number' }
          },
          required: ['rowIndex']
        }
      },
      {
        name: 'get_new_inventory',
        description: 'Get all new car inventory.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'get_upcoming_inventory',
        description: 'Get pre-lot cars that have cost data but are not yet live on the website. These are trade-ins and acquisitions captured via cost import before they appear on dublintoyota.com. Useful for matching customers to incoming vehicles. Each car includes vin, stock, year, make, model, mileage, price, appraisedValue, appraiser, and addedDate. Optionally filter by a search query (year, make, model, or VIN substring).',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Optional search string — filters by year, make, model, or VIN (case-insensitive substring match).' }
          }
        }
      },
      {
        name: 'import_cost_data',
        description: 'Import cost/appraisal data from a parsed DMS XLS export. Updates appraisedValue and certCost on existing inventory cars matched by VIN or stock number.',
        inputSchema: {
          type: 'object',
          properties: {
            records: {
              type: 'array',
              description: 'Array of cost records. Each must have vin or stock, plus appraisedValue and certCost.',
              items: { type: 'object' }
            }
          },
          required: ['records']
        }
      },
      {
        name: 'import_used_cars',
        description: 'Bulk upsert used car inventory from parsed CSV/XLS data. Each car object should include vin plus any available fields. Existing cars are updated by VIN; new VINs are added.',
        inputSchema: {
          type: 'object',
          properties: {
            cars: {
              type: 'array',
              description: 'Array of car objects. Each must have a vin field.',
              items: { type: 'object' }
            }
          },
          required: ['cars']
        }
      },
      {
        name: 'import_new_cars',
        description: 'Import new car inventory from parsed CSV data. Replaces the New Inventory sheet by default.',
        inputSchema: {
          type: 'object',
          properties: {
            cars: {
              type: 'array',
              description: 'Array of new car objects from the parsed CSV.',
              items: { type: 'object' }
            },
            replace: {
              type: 'boolean',
              description: 'If true (default), clears the sheet before importing. Set false to append.'
            }
          },
          required: ['cars']
        }
      }
    ]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result;

      switch (name) {

        case 'scrape_inventory': {
          const limit  = args.limit  || 15;
          const offset = args.offset || 0;

          const allData = await callScript('getAll');
          const allCars = allData.cars || [];
          // scrapeVehicles() returns "Check FB — Delist" for any VIN not found in the
          // sitemap -- including cars already flagged that way from a previous scrape.
          // Track prior status so we only count NEW delistings, not daily reconfirmations
          // of already-known ones (otherwise the count balloons with stale backlog).
          const priorStatusByVin = {};
          allCars.forEach(c => { if (c.vin) priorStatusByVin[c.vin] = c.websiteStatus || ''; });
          const vinsToScrape = allCars
            .filter(c => c.websiteStatus !== 'Sold/Unavailable' && c.fbStatus !== 'sold' && c.vin)
            .map(c => c.vin);
          if (!vinsToScrape.length) { result = { scraped: 0, total: 0, done: true, message: 'No active vehicles' }; break; }

          const chunk = vinsToScrape.slice(offset, offset + limit);
          let scraped = 0, newDelistCount = 0, errors = 0;
          const errorMessages = [];

          // One scrapeVehicles call per chunk (not sub-batched) — scrapeVehicles refetches
          // the full site sitemap on every call, so sub-batching multiplied that redundant
          // fetch 5x per request and was the cause of requests hanging past client timeouts.
          try {
            const res = await callScript('scrapeVehicles', { vins: chunk });
            const results = (res.results || []).map(r => ({ ...r, lastChecked: new Date().toISOString() }));
            scraped += results.length;
            newDelistCount += results.filter(r => {
              const isDelistedNow = (r.websiteStatus || '').includes('Delist');
              const wasDelistedBefore = (priorStatusByVin[r.vin] || '').includes('Delist');
              return isDelistedNow && !wasDelistedBefore;
            }).length;
            if (results.length) await callScript('upsertMany', { cars: results });
          } catch (e) { errors++; errorMessages.push(e.message); }

          result = {
            scraped, newDelistCount, errors, errorMessages,
            total: vinsToScrape.length,
            offset, limit,
            done: (offset + limit) >= vinsToScrape.length,
            nextOffset: (offset + limit) >= vinsToScrape.length ? null : offset + limit
          };
          break;
        }

        case 'ping':
          result = await callScript('ping');
          break;

        case 'search_inventory': {
          const data = await callScript('getAll');
          let cars = data.cars || [];

          if (args.query) {
            const q = args.query.toLowerCase();
            cars = cars.filter(c =>
              [c.year, c.make, c.model, c.trim, c.color, c.stock, c.vin, c.certification]
                .some(f => String(f || '').toLowerCase().includes(q))
            );
          }

          if (args.fbStatus) cars = cars.filter(c => c.fbStatus === args.fbStatus);
          if (args.excludeSold) cars = cars.filter(c => !c.soldDate && c.fbStatus !== 'Sold');
          if (args.minPrice) cars = cars.filter(c => Number(c.price) >= args.minPrice);
          if (args.maxPrice) cars = cars.filter(c => Number(c.price) <= args.maxPrice);
          if (args.minDaysOnLot) {
            const now = Date.now();
            cars = cars.filter(c => {
              if (!c.addedDate) return false;
              return (now - new Date(c.addedDate).getTime()) / 86400000 >= args.minDaysOnLot;
            });
          }

          cars = cars.slice(0, args.limit || 100).map(c => {
            const s = slim(c);
            return args.withGross && Number(c.appraisedValue) > 0 ? { ...s, ...calcGross(c) } : s;
          });

          result = { count: cars.length, cars };
          break;
        }

        case 'get_inventory': {
          const data = await callScript('getAll');
          let cars = data.cars || [];
          if (args.fbStatus) cars = cars.filter(c => c.fbStatus === args.fbStatus);
          if (args.excludeSold) cars = cars.filter(c => !c.soldDate && c.fbStatus !== 'Sold');
          if (args.minPrice) cars = cars.filter(c => Number(c.price) >= args.minPrice);
          if (args.maxPrice) cars = cars.filter(c => Number(c.price) <= args.maxPrice);
          if (args.minDaysOnLot) {
            const now = Date.now();
            cars = cars.filter(c => {
              if (!c.addedDate) return false;
              return (now - new Date(c.addedDate).getTime()) / 86400000 >= args.minDaysOnLot;
            });
          }
          cars = cars.slice(0, args.limit || 100).map(slim);
          result = { count: cars.length, cars };
          break;
        }

        case 'get_high_gross_cars': {
          const data = await callScript('getAll');
          let cars = (data.cars || []).filter(c => Number(c.appraisedValue) > 0);
          if (!args.includeSold) cars = cars.filter(c => !c.soldDate && c.fbStatus !== 'Sold');
          cars = cars.map(c => ({ ...slim(c), ...calcGross(c) }));
          if (args.minBottomGross) cars = cars.filter(c => c.bottomGross >= args.minBottomGross);
          cars.sort((a, b) => b.topGross - a.topGross);
          cars = cars.slice(0, args.limit || 10);
          result = { count: cars.length, cars };
          break;
        }

        case 'get_stale_inventory': {
          const days = args.days || 45;
          const data = await callScript('getAll');
          const now = Date.now();
          const cars = (data.cars || [])
            .filter(c => c.addedDate && !c.soldDate && c.fbStatus !== 'Sold')
            .map(c => ({
              ...slim(c),
              daysOnLot: Math.floor((now - new Date(c.addedDate).getTime()) / 86400000)
            }))
            .filter(c => c.daysOnLot >= days)
            .sort((a, b) => b.daysOnLot - a.daysOnLot);
          const staleTotal = cars.length;
          const staleLimited = cars.slice(0, args.limit || 30);
          result = { count: staleLimited.length, totalMatching: staleTotal, cars: staleLimited };
          break;
        }

        case 'get_car': {
          const data = await callScript('getAll');
          let car;
          if (args.vin) {
            car = (data.cars || []).find(c => c.vin.toUpperCase() === args.vin.toUpperCase());
          } else if (args.stock) {
            car = (data.cars || []).find(c => String(c.stock || '').toUpperCase() === args.stock.toUpperCase());
          }
          if (car && Number(car.appraisedValue) > 0) car = { ...car, ...calcGross(car) };
          result = car ? { car } : { error: `Not found: ${args.vin || args.stock}` };
          break;
        }

        case 'update_car_field':
          result = await callScript('updateField', { vin: args.vin, field: args.field, value: args.value });
          break;

        case 'get_leads': {
          const allLeads = await callScript('getLeads');
          if (!Array.isArray(allLeads)) { result = allLeads; break; }
          let leads = allLeads.map(l => {
            const inFocus = l.inFocus || '';
            const lt = l.leadType || '';
            let tab;
            if (inFocus === 'Focus' || inFocus === true || inFocus === 'true' || lt === 'Focus') tab = 'Focus';
            else if (inFocus === 'Lost' || lt === 'Lost') tab = 'Lost';
            else if (lt && lt !== 'Focus' && lt !== 'Lost') tab = lt;
            else if (l.source === 'FB Marketplace' || l.source === 'FB Ad') tab = l.source;
            else tab = 'Lot';
            const sourceType = (lt && lt !== 'Focus' && lt !== 'Lost') ? lt : (l.source === 'FB Marketplace' || l.source === 'FB Ad' ? l.source : 'Lot');
            return { ...l, _tab: tab, _sourceType: sourceType };
          });
          if (args.tab) leads = leads.filter(l => l._tab === args.tab);
          if (args.status) leads = leads.filter(l => l.status === args.status);
          result = leads;
          break;
        }

        case 'add_lead':
          result = await callScript('submitLead', {
            ...args,
            leadType: args.leadType || 'Lot',
            source: args.leadType || 'Cowork',
            addedBy: 'Cowork'
          });
          break;

        case 'update_lead':
          result = await callScript('updateLead', { rowIndex: args.rowIndex, field: args.field, value: args.value });
          break;

        case 'set_lead_pipeline': {
          const pipeline = args.pipeline;
          const rIdx = args.rowIndex;
          if (pipeline === 'Focus' || pipeline === 'Lost' || pipeline === 'Sold') {
            await callScript('updateLead', { rowIndex: rIdx, field: 'inFocus', value: pipeline });
            result = { ok: true, moved: pipeline };
          } else {
            await callScript('updateLead', { rowIndex: rIdx, field: 'inFocus', value: '' });
            result = { ok: true, moved: 'Active' };
          }
          break;
        }

        case 'delete_lead':
          result = await callScript('deleteLead', { rowIndex: args.rowIndex });
          break;

        case 'get_new_inventory':
          result = await callScript('getNewInventory');
          break;

        case 'get_upcoming_inventory': {
          const data = await callScript('getAll');
          const ws = c => (c.websiteStatus || '').toLowerCase();
          let upcoming = (data.cars || []).filter(c =>
            Number(c.appraisedValue || 0) > 0 && !c.color &&
            !ws(c).includes('live') && !ws(c).includes('sold') &&
            !ws(c).includes('delist') && c.fbStatus !== 'sold'
          );
          if (args.query) {
            const q = args.query.toLowerCase();
            upcoming = upcoming.filter(c =>
              (c.year  && String(c.year).includes(q))  ||
              (c.make  && c.make.toLowerCase().includes(q))  ||
              (c.model && c.model.toLowerCase().includes(q)) ||
              (c.vin   && c.vin.toLowerCase().includes(q))   ||
              (c.stock && c.stock.toLowerCase().includes(q))
            );
          }
          upcoming.sort((a, b) => new Date(b.addedDate || 0) - new Date(a.addedDate || 0));
          result = {
            count: upcoming.length,
            cars: upcoming.map(c => ({
              vin: c.vin, stock: c.stock, year: c.year, make: c.make, model: c.model,
              mileage: c.mileage, price: c.price, appraisedValue: c.appraisedValue,
              appraiser: c.appraiser, addedDate: c.addedDate
            }))
          };
          break;
        }

        case 'import_cost_data':
          if (!args.records || !args.records.length) { result = { error: 'No records provided' }; break; }
          result = await callScript('importCostData', { records: args.records });
          break;

        case 'import_used_cars':
          if (!args.cars || !args.cars.length) { result = { error: 'No cars provided' }; break; }
          result = await callScript('upsertMany', { cars: args.cars });
          break;

        case 'import_new_cars':
          if (!args.cars || !args.cars.length) { result = { error: 'No cars provided' }; break; }
          result = await callScript('importNewCars', { cars: args.cars, replace: args.replace !== false });
          break;

        default:
          result = { error: 'Unknown tool: ' + name };
      }

      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };

    } catch (err) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
        isError: true
      };
    }
  });

  return server;
}

const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
  if (AUTH_TOKEN) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${AUTH_TOKEN}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }
  // Ensure the Accept header satisfies the MCP SDK's requirement
  if (!req.headers.accept || !req.headers.accept.includes('text/event-stream')) {
    req.headers.accept = 'application/json, text/event-stream';
  }
  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => server.close().catch(() => {}));
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Dublin Toyota MCP server running on port ${PORT}`));
