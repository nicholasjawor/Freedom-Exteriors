import Papa from 'papaparse';

/**
 * Column name aliases. HailTrace's exact export headers aren't confirmed yet
 * (no sample on hand) — this list covers the common variants roofing/storm
 * data exports use. If a real HailTrace export uses a header not listed
 * here, add it to the relevant array; nothing else needs to change.
 */
const HEADER_ALIASES = {
  address: ['address', 'streetaddress', 'propertyaddress', 'fulladdress', 'street', 'street1'],
  city: ['city'],
  state: ['state', 'st', 'province'],
  zip: ['zip', 'zipcode', 'postalcode', 'postal'],
  homeowner_name: ['ownername', 'homeowner', 'homeownername', 'owner', 'name', 'contactname', 'fullname'],
  lat: ['lat', 'latitude'],
  lng: ['lng', 'lon', 'long', 'longitude'],
};

/** Normalize a header string for matching: lowercase, strip non-alphanumerics. */
function normalizeHeader(h) {
  return String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Build a map of { targetField: sourceHeaderKey } from the CSV's actual headers. */
function resolveHeaderMap(fields) {
  const normalizedToOriginal = {};
  for (const f of fields) normalizedToOriginal[normalizeHeader(f)] = f;

  const map = {};
  for (const [targetField, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      if (normalizedToOriginal[alias]) {
        map[targetField] = normalizedToOriginal[alias];
        break;
      }
    }
  }
  return map;
}

function cleanStr(v) {
  if (v == null) return '';
  return String(v).trim().replace(/\s+/g, ' ');
}

function toNumberOrNull(v) {
  if (v == null || cleanStr(v) === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Normalized key used for in-file and in-db deduplication. */
function dedupeKey(row) {
  return `${cleanStr(row.address).toLowerCase()}|${cleanStr(row.zip).toLowerCase()}`;
}

/**
 * Parse a HailTrace CSV export into mail_targets-shaped rows.
 *
 * @param {string} csvText - raw CSV file contents
 * @returns {{
 *   headerMap: object,
 *   unmatchedRequiredFields: string[],
 *   targets: object[],
 *   errors: {row: number, reason: string, raw: object}[],
 *   duplicatesInFile: {row: number, address: string}[],
 *   totalRows: number
 * }}
 */
export function parseHailTraceCsv(csvText) {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h, // keep original; we map ourselves
  });

  const fields = parsed.meta.fields || [];
  const headerMap = resolveHeaderMap(fields);

  const unmatchedRequiredFields = [];
  if (!headerMap.address) unmatchedRequiredFields.push('address');

  const targets = [];
  const errors = [];
  const duplicatesInFile = [];
  const seenKeys = new Set();

  parsed.data.forEach((raw, idx) => {
    const rowNum = idx + 2; // +1 for header row, +1 for 1-indexing

    if (unmatchedRequiredFields.length > 0) {
      // Can't process any rows meaningfully without an address column.
      return;
    }

    const address = cleanStr(raw[headerMap.address]);
    if (!address) {
      errors.push({ row: rowNum, reason: 'missing address', raw });
      return;
    }

    const row = {
      address,
      city: headerMap.city ? cleanStr(raw[headerMap.city]) : '',
      state: headerMap.state ? cleanStr(raw[headerMap.state]) : '',
      zip: headerMap.zip ? cleanStr(raw[headerMap.zip]) : '',
      homeowner_name: headerMap.homeowner_name ? cleanStr(raw[headerMap.homeowner_name]) : '',
      lat: headerMap.lat ? toNumberOrNull(raw[headerMap.lat]) : null,
      lng: headerMap.lng ? toNumberOrNull(raw[headerMap.lng]) : null,
    };

    const key = dedupeKey(row);
    if (seenKeys.has(key)) {
      duplicatesInFile.push({ row: rowNum, address: row.address });
      return;
    }
    seenKeys.add(key);
    targets.push(row);
  });

  return {
    headerMap,
    unmatchedRequiredFields,
    targets,
    errors,
    duplicatesInFile,
    totalRows: parsed.data.length,
  };
}

export { dedupeKey };
