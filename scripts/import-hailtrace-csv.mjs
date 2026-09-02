#!/usr/bin/env node
/**
 * Import a HailTrace storm/address CSV export into mail_targets.
 *
 * Usage:
 *   node scripts/import-hailtrace-csv.mjs --file=./export.csv --campaign="April 2026 Hail - Springfield MO" [--storm-event-id=HT-12345] [--dry-run]
 *
 * Env required (unless --dry-run):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync, writeFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseHailTraceCsv } from '../lib/csv-import/parseHailTraceCsv.js';

function parseArgs(argv) {
  const args = {};
  for (const arg of argv.slice(2)) {
    const m = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] ?? true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.file) {
    console.error('Missing required --file=path/to/export.csv');
    process.exit(1);
  }
  if (!args.campaign && !args['campaign-id']) {
    console.error('Missing required --campaign="Name" (or --campaign-id=<uuid> for an existing campaign)');
    process.exit(1);
  }

  const dryRun = Boolean(args['dry-run']);
  const csvText = readFileSync(args.file, 'utf8');
  const result = parseHailTraceCsv(csvText);

  console.log(`Parsed ${result.totalRows} data rows from ${args.file}`);
  console.log(`Header map:`, result.headerMap);

  if (result.unmatchedRequiredFields.length > 0) {
    console.error(`\nERROR: Could not find a required column: ${result.unmatchedRequiredFields.join(', ')}`);
    console.error(`CSV headers found: ${Object.keys(result.headerMap).length ? '' : '(none matched)'}`);
    console.error('Add the actual header name as an alias in lib/csv-import/parseHailTraceCsv.js and retry.');
    process.exit(1);
  }

  console.log(`Valid rows: ${result.targets.length}`);
  console.log(`Skipped - missing address: ${result.errors.length}`);
  console.log(`Skipped - duplicate within file: ${result.duplicatesInFile.length}`);

  if (result.targets.length === 0) {
    console.log('\nNothing to import. Exiting.');
    return;
  }

  if (dryRun) {
    console.log('\n--dry-run set: not connecting to Supabase or writing anything.');
    console.log('Sample of rows that WOULD be imported:');
    console.table(result.targets.slice(0, 5));
    writeSkippedReport(args.file, result);
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('\nERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment.');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  // Resolve campaign
  let campaignId = args['campaign-id'];
  if (!campaignId) {
    const { data: existing, error: findErr } = await supabase
      .from('mail_campaigns')
      .select('id')
      .eq('name', args.campaign)
      .maybeSingle();
    if (findErr) throw findErr;

    if (existing) {
      campaignId = existing.id;
      console.log(`\nUsing existing campaign "${args.campaign}" (${campaignId})`);
    } else {
      const { data: created, error: createErr } = await supabase
        .from('mail_campaigns')
        .insert({
          name: args.campaign,
          storm_event_id: args['storm-event-id'] || null,
          status: 'draft',
        })
        .select('id')
        .single();
      if (createErr) throw createErr;
      campaignId = created.id;
      console.log(`\nCreated new campaign "${args.campaign}" (${campaignId})`);
    }
  }

  // Dedupe against what's already in the DB for this campaign
  const { data: existingTargets, error: existingErr } = await supabase
    .from('mail_targets')
    .select('address, zip')
    .eq('campaign_id', campaignId);
  if (existingErr) throw existingErr;

  const existingKeys = new Set(
    (existingTargets || []).map((t) => `${(t.address || '').toLowerCase()}|${(t.zip || '').toLowerCase()}`)
  );

  const toInsert = [];
  const skippedAsDbDuplicate = [];
  for (const t of result.targets) {
    const key = `${t.address.toLowerCase()}|${t.zip.toLowerCase()}`;
    if (existingKeys.has(key)) {
      skippedAsDbDuplicate.push(t.address);
      continue;
    }
    toInsert.push({
      campaign_id: campaignId,
      address: t.address,
      city: t.city || null,
      state: t.state || null,
      zip: t.zip || null,
      homeowner_name: t.homeowner_name || null,
      lat: t.lat,
      lng: t.lng,
      data: {},
      mail_status: 'pending',
    });
  }

  console.log(`Skipped - already in this campaign: ${skippedAsDbDuplicate.length}`);
  console.log(`Rows to insert: ${toInsert.length}`);

  const BATCH_SIZE = 500;
  let insertedCount = 0;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const { error: insertErr, data: insertedRows } = await supabase
      .from('mail_targets')
      .insert(batch)
      .select('id');
    if (insertErr) throw insertErr;
    insertedCount += insertedRows.length;
    console.log(`Inserted batch: ${insertedRows.length} rows (running total: ${insertedCount})`);
  }

  console.log(`\nDone. Campaign ${campaignId}: ${insertedCount} new mail_targets inserted.`);
  writeSkippedReport(args.file, result, skippedAsDbDuplicate);
}

function writeSkippedReport(sourceFile, result, skippedAsDbDuplicate = []) {
  const lines = ['row,address,reason'];
  for (const e of result.errors) {
    lines.push(`${e.row},"${(e.raw.address || '').replace(/"/g, '""')}",missing address`);
  }
  for (const d of result.duplicatesInFile) {
    lines.push(`${d.row},"${d.address.replace(/"/g, '""')}",duplicate within file`);
  }
  for (const addr of skippedAsDbDuplicate) {
    lines.push(`,"${addr.replace(/"/g, '""')}",already in campaign (db)`);
  }
  if (lines.length === 1) return; // nothing skipped

  const outPath = sourceFile.replace(/\.csv$/i, '') + '.skipped-report.csv';
  writeFileSync(outPath, lines.join('\n'));
  console.log(`\nSkipped-rows report written to: ${outPath}`);
}

main().catch((err) => {
  console.error('\nImport failed:', err.message || err);
  process.exit(1);
});
