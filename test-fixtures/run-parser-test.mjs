import { readFileSync } from 'fs';
import { parseHailTraceCsv } from '../lib/csv-import/parseHailTraceCsv.js';

const csv = readFileSync(new URL('./sample_export.csv', import.meta.url), 'utf8');
const result = parseHailTraceCsv(csv);

console.log('--- Header map ---');
console.log(result.headerMap);

console.log('\n--- Targets (valid, deduped rows) ---');
console.table(result.targets);

console.log('\n--- Errors ---');
console.table(result.errors.map(e => ({ row: e.row, reason: e.reason })));

console.log('\n--- Duplicates in file ---');
console.table(result.duplicatesInFile);

console.log(`\nTotal data rows in CSV: ${result.totalRows}`);
console.log(`Valid targets: ${result.targets.length}`);
console.log(`Errors: ${result.errors.length}`);
console.log(`Duplicates skipped: ${result.duplicatesInFile.length}`);

// --- Assertions ---
const checks = [];
checks.push(['4 valid targets', result.targets.length === 4]);
checks.push(['1 missing-address error', result.errors.length === 1 && result.errors[0].reason === 'missing address']);
checks.push(['1 in-file duplicate detected', result.duplicatesInFile.length === 1]);
checks.push(['quoted comma in address preserved', result.targets.some(t => t.address === '123 Main St, Unit 4')]);
checks.push(['whitespace trimmed/collapsed', result.targets.some(t => t.address === '321 Pine Rd' && t.homeowner_name === 'Dave Lee')]);
checks.push(['alt header "Property Address" mapped to address', result.headerMap.address === 'Property Address']);
checks.push(['alt header "Zip Code" mapped to zip', result.headerMap.zip === 'Zip Code']);
checks.push(['lat/lng parsed as numbers', result.targets.find(t => t.address === '123 Main St, Unit 4').lat === 37.2153]);
checks.push(['empty lat/lng parsed as null', result.targets.find(t => t.address === '789 Elm St').lat === null]);

console.log('\n--- Assertions ---');
let allPassed = true;
for (const [label, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} - ${label}`);
  if (!passed) allPassed = false;
}

process.exit(allPassed ? 0 : 1);
