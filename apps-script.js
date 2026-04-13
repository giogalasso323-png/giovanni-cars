// ============================================================
//  DUBLIN TOYOTA INVENTORY — Google Apps Script Backend v6
//  Added: New Inventory sheet support
// ============================================================

const SHEET_NAME = 'Inventory';
const NEW_INV_SHEET = 'New Inventory';

const NEW_INV_COLUMNS = [
  'vin','year','modelName','modelCode','stock','category',
  'extColor','intColor','accessories','dis','totalSrp','advertised',
  'onlineStatus','promotable','campaign','presold','reserved',
  'comments','rdr','addedDate','notes'
];

const COLUMNS = [
  'vin','year','make','model','trim','color','mileage','price',
  'stock','fbStatus','websiteStatus','websitePrice','fbDescription',
  'carfaxUrl','edmundsLabel','edmundsBelow','vehicleInfo',
  'vehicleHistory','features','certification','addedDate',
  'lastChecked','fbPostedDate','soldDate','websiteUrl','fbPostedPrice','priceDropped','dis','currentFbPrice','originalPrice','drivePhotoFolder','drivePhotoCount'
];

const LEADS_COLUMNS = [
  'timestamp','firstName','lastName','phone','vehicle','vin',
  'timeframe','source','status','notes','followUpDate'
];

function doGet(e)     { return handleRequest(e); }
function doPost(e)    { return handleRequest(e); }
function doOptions(e) { return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT); }

function handleRequest(e) {
  var params = e.parameter || {};
  var body   = parseBody(e);
  var action = params.action || body.action || '';
  try {
    var result;
    switch (action) {
      case 'getAll':         result = getAllInventory();                            break;
      case 'upsert':         result = upsertMany([body.car]);                      break;
      case 'upsertMany':     result = upsertMany(body.cars);                       break;
      case 'updateField':    result = updateField(body.vin, body.field, body.value); break;
      case 'scrapeVehicles': result = scrapeVehicles(body.vins);                   break;
      case 'savePhotos':     result = savePhotosToDrive(body.vin, body.stock, body.title); break;
      case 'uploadPhotos':   result = uploadPhotosToDrive(body.vin, body.stock, body.photos); break;
      case 'deletePhotos':   result = deletePhotoFolder(body.vin);                 break;
      case 'submitLead':     result = submitLead(body);                            break;
      case 'getLeads':       result = getLeads();                                  break;
      case 'updateLead':     result = updateLead(body.rowIndex, body.field, body.value); break;
      case 'deleteLead':       result = deleteLead(body.rowIndex);                      break;
      case 'getNewInventory':  result = getNewInventory();                             break;
      case 'importNewCars':    result = importNewCars(body.cars, body.replace);         break;
      case 'updateNewCar':     result = updateNewCar(body.vin, body.field, body.value); break;
      case 'ping':           result = { ok: true };                                break;
      default:               result = { error: 'Unknown action: ' + action };
    }
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function parseBody(e) {
  try { if (e.postData && e.postData.contents) return JSON.parse(e.postData.contents); } catch(_) {}
  try { if (e.parameter && e.parameter.payload) return JSON.parse(e.parameter.payload); } catch(_) {}
  return {};
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Leads Sheet ───────────────────────────────────────────────
function getLeadsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Leads');
  if (!sh) {
    sh = ss.insertSheet('Leads');
    sh.getRange(1, 1, 1, LEADS_COLUMNS.length).setValues([LEADS_COLUMNS]);
    sh.getRange(1, 1, 1, LEADS_COLUMNS.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function submitLead(data) {
  if (!data.firstName && !data.lastName && !data.phone) {
    return { error: 'Missing lead data' };
  }
  var sh = getLeadsSheet();
  var row = [
    new Date().toISOString(),
    data.firstName  || '',
    data.lastName   || '',
    data.phone      || '',
    data.vehicle    || '',
    data.vin        || '',
    data.timeframe  || '',
    data.source     || 'website',
    data.status     || 'New',
    data.notes      || '',
    ''
  ];
  sh.appendRow(row);
  return { ok: true };
}

function deleteLead(rowIndex) {
  if (!rowIndex) return { error: 'Missing rowIndex' };
  var sh = getLeadsSheet();
  sh.deleteRow(Number(rowIndex));
  return { ok: true };
}

function getLeads() {
  var sh   = getLeadsSheet();
  var last = sh.getLastRow();
  if (last < 2) return { leads: [] };
  var numCols = LEADS_COLUMNS.length;
  var data = sh.getRange(2, 1, last - 1, numCols).getValues();
  var leads = data.map(function(row, i) {
    var obj = { rowIndex: i + 2 };
    LEADS_COLUMNS.forEach(function(col, j) {
      var val = row[j];
      if (val instanceof Date) val = val.toISOString();
      obj[col] = (val === null || val === undefined) ? '' : val;
    });
    return obj;
  }).filter(function(l) { return l.firstName || l.lastName || l.phone; });
  return { leads: leads };
}

function updateLead(rowIndex, field, value) {
  if (!rowIndex || !field) return { error: 'Missing rowIndex or field' };
  var sh  = getLeadsSheet();
  var col = LEADS_COLUMNS.indexOf(field);
  if (col < 0) return { error: 'Unknown field: ' + field };
  sh.getRange(rowIndex, col + 1).setValue(value);
  return { ok: true };
}

// ── Inventory Sheet ───────────────────────────────────────────
function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
    sh.getRange(1, 1, 1, COLUMNS.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function getHeaderMap(sh) {
  var last = Math.max(sh.getLastColumn(), 1);
  var headers = sh.getRange(1, 1, 1, last).getValues()[0];
  var missing = COLUMNS.filter(function(c) { return headers.indexOf(c) < 0; });
  if (missing.length) {
    sh.getRange(1, last + 1, 1, missing.length).setValues([missing]);
    missing.forEach(function(h) { headers.push(h); });
  }
  var map = {};
  headers.forEach(function(h, i) { if (h) map[String(h)] = i; });
  return map;
}

// ── Read ──────────────────────────────────────────────────────
function getAllInventory() {
  var sh   = getSheet();
  var map  = getHeaderMap(sh);
  var last = sh.getLastRow();
  if (last < 2) return { cars: [] };
  var numCols = sh.getLastColumn();
  var data = sh.getRange(2, 1, last - 1, numCols).getValues();
  var cars = data
    .filter(function(row) { return row[map['vin']] && String(row[map['vin']]).trim(); })
    .map(function(row) { return rowToObj(row, map); });
  return { cars: cars };
}

// ── Upsert ────────────────────────────────────────────────────
function upsertMany(cars) {
  if (!cars || !cars.length) return { added: 0, updated: 0 };
  var sh      = getSheet();
  var map     = getHeaderMap(sh);
  var numCols = sh.getLastColumn();
  var last    = sh.getLastRow();

  var vinCol = map['vin'] + 1;
  var vinIndex = {};
  if (last >= 2) {
    var vins = sh.getRange(2, vinCol, last - 1, 1).getValues();
    vins.forEach(function(v, i) {
      var vin = norm(v[0]);
      if (vin) vinIndex[vin] = i + 2;
    });
  }

  var toAppend = [];
  var toUpdate = [];
  var added = 0, updated = 0;

  cars.forEach(function(car) {
    var vin = norm(car.vin);
    if (!vin) return;
    var rowData = objToRow(car, map, numCols);
    if (vinIndex[vin]) {
      toUpdate.push({ rowNum: vinIndex[vin], rowData: rowData });
      updated++;
    } else {
      toAppend.push(rowData);
      vinIndex[vin] = last + toAppend.length;
      added++;
    }
  });

  toUpdate.forEach(function(item) {
    var existing = sh.getRange(item.rowNum, 1, 1, numCols).getValues()[0];
    item.rowData.forEach(function(val, i) {
      if (val !== '' && val !== null && val !== undefined) existing[i] = val;
    });
    sh.getRange(item.rowNum, 1, 1, numCols).setValues([existing]);
  });

  if (toAppend.length) {
    sh.getRange(sh.getLastRow() + 1, 1, toAppend.length, numCols).setValues(toAppend);
  }

  return { added: added, updated: updated };
}

// ── Update single field ───────────────────────────────────────
function updateField(vin, field, value) {
  if (!vin || !field) return { error: 'Missing vin or field' };
  var sh   = getSheet();
  var map  = getHeaderMap(sh);
  var last = sh.getLastRow();
  if (last < 2) return { error: 'No data' };
  var vins = sh.getRange(2, map['vin'] + 1, last - 1, 1).getValues();
  for (var i = 0; i < vins.length; i++) {
    if (norm(vins[i][0]) === norm(vin)) {
      var col = map[field];
      if (col === undefined) return { error: 'Unknown field: ' + field };
      sh.getRange(i + 2, col + 1).setValue(value);
      return { ok: true };
    }
  }
  return { error: 'VIN not found: ' + vin };
}

// ── Server-side scraping ──────────────────────────────────────
function decodeHtmlEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-fA-F]+);/g, function(_, h) { return String.fromCharCode(parseInt(h, 16)); })
    .replace(/&#([0-9]+);/g, function(_, d) { return String.fromCharCode(parseInt(d, 10)); })
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function fetchWithRetry(url, retries) {
  retries = retries || 2;
  var opts = {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120', 'Accept-Language': 'en-US,en;q=0.9' }
  };
  for (var i = 0; i <= retries; i++) {
    try {
      var resp = UrlFetchApp.fetch(url, opts);
      var code = resp.getResponseCode();
      if (code < 400) return resp.getContentText() || '';
      if (i === retries) return '';
    } catch(e) {
      if (i === retries) return '';
      Utilities.sleep(500);
    }
  }
  return '';
}

function scrapeVehicles(vins) {
  if (!vins || !vins.length) return { results: [] };

  var sitemapHtml = fetchWithRetry('https://www.dublintoyota.com/sitemap.aspx', 2);
  if (!sitemapHtml) return { error: 'Sitemap fetch failed' };

  var decodedSitemap = decodeHtmlEntities(sitemapHtml);
  var results = [];

  vins.forEach(function(vin) {
    vin = norm(vin);
    if (!vin) return;

    var vehicleUrl = '';
    var locMatch  = decodedSitemap.match(new RegExp('<loc>([^<]*' + vin + '[^<]*)<\/loc>', 'i'));
    var hrefMatch = decodedSitemap.match(new RegExp('href="([^"]*' + vin + '[^"]*)"', 'i'));
    if (locMatch && locMatch[1]) {
      vehicleUrl = decodeHtmlEntities(locMatch[1]).trim();
    } else if (hrefMatch && hrefMatch[1]) {
      var u = decodeHtmlEntities(hrefMatch[1]).trim();
      vehicleUrl = u.indexOf('http') === 0 ? u : 'https://www.dublintoyota.com' + u;
    }

    if (!vehicleUrl) {
      results.push({ vin: vin, websiteStatus: 'Check FB — Delist', websiteUrl: '' });
      return;
    }

    var html = fetchWithRetry(vehicleUrl, 1);
    if (!html) {
      results.push({ vin: vin, websiteStatus: 'Fetch Error', websiteUrl: vehicleUrl });
      return;
    }

    var parsed = parseVehiclePage(html, vehicleUrl);
    parsed.vin = vin;
    results.push(parsed);
  });

  return { results: results };
}

function parseVehiclePage(html, vehicleUrl) {
  var lo = html.toLowerCase();

  if (lo.indexOf('this vehicle is no longer available') >= 0 ||
      lo.indexOf('this vehicle has been sold') >= 0) {
    return { websiteStatus: 'Sold/Unavailable', websiteUrl: vehicleUrl };
  }
  if (lo.indexOf('page not found') >= 0 || lo.indexOf('error 404') >= 0) {
    return { websiteStatus: 'Not Found', websiteUrl: vehicleUrl };
  }

  var price = 0;
  var pm = html.match(/Internet\s*Price[\s\S]{0,300}?\$\s*([0-9]{1,3}(?:,[0-9]{3})+)/i) ||
           html.match(/"price"\s*:\s*"?([0-9]{4,6})"?/i);
  if (pm && pm[1]) price = parseInt(pm[1].replace(/,/g, ''), 10);

  var sm = html.match(/Stock\s*#\s*([A-Za-z0-9-]{2,20})/i);
  var cf = html.match(/href="(https?:\/\/www\.carfax\.com\/vehiclehistory\/[^"]+)"/i);
  var cert = (lo.indexOf('toyota certified') >= 0 || lo.indexOf('tcuv') >= 0) ? 'Toyota Certified Used Vehicle' : '';
  var text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  return {
    websiteStatus:   price ? 'Live' : 'Live (No Price)',
    websiteUrl:      vehicleUrl,
    websitePrice:    price,
    stock:           sm ? sm[1].trim() : '',
    carfaxUrl:       cf ? cf[1] : '',
    certification:   cert,
    vehicleInfo:     parseVehicleInfo(html),
    vehicleHistory:  parseVehicleHistory(text),
    features:        parseFeatures(html)
  };
}

function parseVehicleInfo(html) {
  var text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|tr|td|th|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();

  function extractLabel(label) {
    var re = new RegExp('\\b' + label.replace(/\s/g, '\\s+') + '\\s*\\n\\s*([^\\n]{1,80})', 'i');
    var m = text.match(re);
    if (m && m[1]) {
      var val = m[1].trim();
      if (val && val.indexOf('dataset') < 0 && val.indexOf('{') < 0 && val.length > 1) return val;
    }
    return '';
  }

  var out = [];
  var bodyStyle    = extractLabel('Body Style');
  var extColor     = extractLabel('Exterior Color');
  var intColor     = extractLabel('Interior Color');
  var mileage      = extractLabel('Mileage');
  var engine       = extractLabel('Engine');
  var transmission = extractLabel('Transmission');
  var fuelType     = extractLabel('Fuel Type');

  if (bodyStyle)    out.push('Body Style: ' + bodyStyle);
  if (extColor)     out.push('Exterior Color: ' + extColor);
  if (intColor)     out.push('Interior Color: ' + intColor);
  if (mileage) {
    var mi = Number(mileage.replace(/[^0-9]/g, '') || 0);
    if (mi > 0) out.push('Mileage: ' + mi.toLocaleString());
  }
  if (engine)       out.push('Engine: ' + engine);
  if (transmission) out.push('Transmission: ' + transmission);
  if (fuelType)     out.push('Fuel Type: ' + fuelType);
  return out.join('\n');
}

function parseVehicleHistory(text) {
  var out = [];
  if (/clean\s+carfax/i.test(text))         out.push('\u2022 Clean CARFAX');
  if (/carfax\s+one[- ]owner/i.test(text))  out.push('\u2022 CARFAX One-Owner');
  if (/\bno\s+accidents\b/i.test(text))     out.push('\u2022 No Accidents Reported');
  if (/\bpersonal\s+vehicle\b/i.test(text)) out.push('\u2022 Personal Vehicle');
  if (/well.?maintained/i.test(text))       out.push('\u2022 Well Maintained');
  if (/low miles/i.test(text))              out.push('\u2022 Low Miles');
  return out.join('\n');
}

function parseFeatures(html) {
  var lo  = html.toLowerCase();
  var idx = lo.indexOf('highlighted features');
  if (idx < 0) return '';
  var slice = html.slice(Math.max(0, idx - 500), idx + 40000);
  var lis = (slice.match(/<li[^>]*>[\s\S]*?<\/li>/gi) || [])
    .map(function(li) { return li.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); })
    .filter(function(s) { return s.length > 2 && s.length < 120 && !/cookie|privacy|terms|call|email/i.test(s); });
  var seen = {}, out = [];
  for (var i = 0; i < lis.length; i++) {
    var k = lis[i].toLowerCase();
    if (seen[k]) continue;
    seen[k] = true;
    out.push('\u2022 ' + lis[i]);
    if (out.length >= 25) break;
  }
  return out.join('\n');
}

// ── Row converters ────────────────────────────────────────────
function rowToObj(row, map) {
  var obj = {};
  COLUMNS.forEach(function(col) {
    var idx = map[col];
    if (idx !== undefined) {
      var val = row[idx];
      if (val instanceof Date) val = val.toISOString();
      obj[col] = (val === null || val === undefined) ? '' : val;
    } else {
      obj[col] = '';
    }
  });
  return obj;
}

function objToRow(car, map, numCols) {
  var row = new Array(numCols).fill('');
  COLUMNS.forEach(function(col) {
    var idx = map[col];
    if (idx !== undefined && car[col] !== undefined && car[col] !== null) {
      row[idx] = car[col];
    }
  });
  return row;
}

function norm(v) {
  return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
}

// ── One-time utility functions ────────────────────────────────
function backfillPostedDates() {
  var sh  = getSheet();
  var map = getHeaderMap(sh);
  var last = sh.getLastRow();
  if(last < 2) return;
  var numCols = sh.getLastColumn();
  var data = sh.getRange(2, 1, last-1, numCols).getValues();
  var fbStatusCol = map['fbStatus'];
  var fbPostedCol = map['fbPostedDate'];
  if(fbStatusCol===undefined||fbPostedCol===undefined) return;
  var fixed = 0;
  data.forEach(function(row,i){
    if(String(row[fbStatusCol]).toLowerCase()==='posted' && !row[fbPostedCol]){
      sh.getRange(i+2, fbPostedCol+1).setValue(new Date().toISOString());
      fixed++;
    }
  });
  Logger.log('Backfilled posted dates for '+fixed+' rows');
}

function clearBadVehicleInfo() {
  var sh  = getSheet();
  var map = getHeaderMap(sh);
  var last = sh.getLastRow();
  if (last < 2) return;
  var numCols = sh.getLastColumn();
  var data = sh.getRange(2, 1, last - 1, numCols).getValues();
  var col = map['vehicleInfo'];
  if (col === undefined) return;
  var cleared = 0;
  data.forEach(function(row, i) {
    var val = String(row[col] || '');
    if (val.indexOf('dataset') >= 0 || val.indexOf('vehicleBody') >= 0 || val.indexOf('vehicleEngine }') >= 0) {
      sh.getRange(i + 2, col + 1).setValue('');
      cleared++;
    }
  });
  Logger.log('Cleared bad vehicleInfo from ' + cleared + ' rows');
}

// ── Photo saving to Google Drive ──────────────────────────────
function uploadPhotosToDrive(vin, stock, photos) {
  if (!vin || !photos || !photos.length) return { error: 'Missing vin or photos' };
  vin = norm(vin);

  var root = getOrCreateRootFolder();
  var folderName = vin + (stock ? ' - ' + stock : '');

  var folder;
  var existing = root.getFoldersByName(folderName);
  if (existing.hasNext()) {
    folder = existing.next();
  } else {
    folder = root.createFolder(folderName);
  }

  var saved = 0;
  var errors = [];

  photos.forEach(function(photo) {
    try {
      var decoded = Utilities.base64Decode(photo.data);
      var blob = Utilities.newBlob(decoded, photo.mimeType || 'image/jpeg', photo.name || (saved+1)+'.jpg');
      folder.createFile(blob);
      saved++;
    } catch(e) {
      errors.push(photo.name + ': ' + e.message);
    }
  });

  var files = folder.getFiles();
  var total = 0;
  while(files.hasNext()){ files.next(); total++; }

  return {
    ok: true,
    folderUrl: folder.getUrl(),
    folderName: folderName,
    saved: saved,
    total: total,
    errors: errors
  };
}

var DEALER_ID = '13444';
var DRIVE_FOLDER_NAME = 'Dublin Toyota Inventory Photos';

function getOrCreateRootFolder() {
  var folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

function savePhotosToDrive(vin, stock, title) {
  if (!vin) return { error: 'No VIN provided' };
  vin = norm(vin);
  var vinLower = vin.toLowerCase();

  var root = getOrCreateRootFolder();
  var folderName = vin + (stock ? ' - ' + stock : '');
  var existing = root.getFoldersByName(folderName);
  if (existing.hasNext()) {
    var existingFolder = existing.next();
    return { ok: true, folderUrl: existingFolder.getUrl(), folderName: folderName, count: 0, alreadyExisted: true };
  }

  var folder = root.createFolder(folderName);
  var saved = 0;
  var failed = 0;

  for (var i = 1; i <= 50; i++) {
    var url = 'https://www.dublintoyota.com/inventoryphotos/' + DEALER_ID + '/' + vinLower + '/ip/' + i + '.jpg';
    try {
      var resp = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        followRedirects: true,
        headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120' }
      });
      if (resp.getResponseCode() !== 200) break;
      var blob = resp.getBlob().setName(i + '.jpg');
      folder.createFile(blob);
      saved++;
    } catch(e) {
      failed++;
      if (failed >= 3) break;
    }
  }

  if (saved === 0) {
    folder.setTrashed(true);
    return { error: 'No photos found for this VIN', vin: vin };
  }

  return { ok: true, folderUrl: folder.getUrl(), folderName: folderName, count: saved };
}

function deletePhotoFolder(vin) {
  if (!vin) return { error: 'No VIN' };
  vin = norm(vin);
  try {
    var root = getOrCreateRootFolder();
    var deleted = 0;
    var allFolders = root.getFolders();
    while (allFolders.hasNext()) {
      var f = allFolders.next();
      if (f.getName().indexOf(vin) === 0) {
        f.setTrashed(true);
        deleted++;
      }
    }
    return { ok: true, deleted: deleted };
  } catch(e) {
    return { error: e.message };
  }
}

// ============================================================
//  NEW INVENTORY
// ============================================================

function getNewInventory() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(NEW_INV_SHEET);
  if (!sh) return { cars: [] };
  var last = sh.getLastRow();
  if (last < 2) return { cars: [] };
  var data = sh.getRange(2, 1, last - 1, NEW_INV_COLUMNS.length).getValues();
  var cars = data.map(function(row) {
    var obj = {};
    NEW_INV_COLUMNS.forEach(function(col, i) { obj[col] = row[i] !== undefined ? String(row[i]) : ''; });
    return obj;
  }).filter(function(c) { return c.vin; });
  return { cars: cars };
}

function importNewCars(cars, replace) {
  if (!cars || !cars.length) return { imported: 0 };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(NEW_INV_SHEET);
  if (!sh) {
    sh = ss.insertSheet(NEW_INV_SHEET);
    sh.getRange(1, 1, 1, NEW_INV_COLUMNS.length).setValues([NEW_INV_COLUMNS]);
    sh.setFrozenRows(1);
  }
  // Only clear on first batch (replace=true)
  if (replace !== false) {
    var last = sh.getLastRow();
    if (last > 1) sh.getRange(2, 1, last - 1, NEW_INV_COLUMNS.length).clearContent();
  }
  var rows = cars.map(function(car) {
    return NEW_INV_COLUMNS.map(function(col) { return car[col] !== undefined ? car[col] : ''; });
  });
  // Append after existing data
  var nextRow = sh.getLastRow() + 1;
  if (rows.length > 0) sh.getRange(nextRow, 1, rows.length, NEW_INV_COLUMNS.length).setValues(rows);
  return { imported: rows.length };
}

function updateNewCar(vin, field, value) {
  if (!vin || !field) return { error: 'Missing vin or field' };
  var col = NEW_INV_COLUMNS.indexOf(field);
  if (col < 0) return { error: 'Unknown field: ' + field };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(NEW_INV_SHEET);
  if (!sh) return { error: 'Sheet not found' };
  var last = sh.getLastRow();
  if (last < 2) return { error: 'No data' };
  var vins = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < vins.length; i++) {
    if (String(vins[i][0]).toUpperCase() === String(vin).toUpperCase()) {
      sh.getRange(i + 2, col + 1).setValue(value);
      return { ok: true };
    }
  }
  return { error: 'VIN not found' };
}
