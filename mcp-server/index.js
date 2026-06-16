import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const env = readFileSync(join(__dirname, '.env'), 'utf8');
  env.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length) process.env[key.trim()] = val.join('=').trim();
  });
} catch {}

const SCRIPT_URL = process.env.SCRIPT_URL || '';

async function callScript(action, body = {}) {
  const response = await fetch(`${SCRIPT_URL}?action=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
    redirect: 'follow'
  });
  return response.json();
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

// Strip heavy text fields — keeps token usage low for list/search results
function slim(car) {
  const { fbDescription, features, vehicleInfo, vehicleHistory, carfaxUrl, websiteUrl, ...rest } = car;
  return rest;
}

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
      description: 'Trigger a website sync — scrapes dublintoyota.com for current prices, availability, and sold status, then updates the inventory sheet. This is the same as clicking the Sync button in the web app. Takes 2-5 minutes to complete. Run this to detect price drops, sold cars, and cars removed from the website.',
      inputSchema: { type: 'object', properties: {} }
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
          days: { type: 'number', description: 'Days on lot threshold (default 45)' }
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
          pipeline: { type: 'string', description: 'Focus, Lost, or Active (Active returns it to its source tab)' }
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
      name: 'import_cost_data',
      description: 'Import cost/appraisal data from a parsed DMS XLS export. Updates appraisedValue and certCost on existing inventory cars matched by VIN or stock number. This is the same as the "Import Cost Data" button in the web app — use this instead of calling update_car_field per car.',
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
      description: 'Bulk upsert used car inventory from parsed CSV/XLS data. Each car object should include vin plus any available fields (year, make, model, trim, color, mileage, price, stock, etc.). Existing cars are updated by VIN; new VINs are added. Use this after parsing a DMS or inventory export file.',
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
      description: 'Import new car inventory from parsed CSV data. Replaces the New Inventory sheet by default. Use this after parsing a new car CSV export from the DMS.',
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

      case 'scrape_inventory':
        result = await callScript('scrapeVehicles');
        break;

      case 'ping':
        result = await callScript('ping');
        break;

      case 'search_inventory': {
        const data = await callScript('getAll');
        let cars = data.cars || [];

        // Keyword search across key fields
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
        result = { count: cars.length, cars };
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
        if (pipeline === 'Focus' || pipeline === 'Lost') {
          await callScript('updateLead', { rowIndex: rIdx, field: 'inFocus', value: pipeline });
          result = { ok: true, moved: pipeline };
        } else {
          // Active — clear inFocus so it returns to its source tab
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

const transport = new StdioServerTransport();
await server.connect(transport);
