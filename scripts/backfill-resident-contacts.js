#!/usr/bin/env node
// One-off local script: backfills `phone`/`email` on any residents/{shortName}
// Firestore doc that's missing a phone number, and defaults `role:"resident"`
// on any doc that doesn't have a `role` yet (used by the WhatsApp bot to gate
// write access -- see bot/directory.js). Not part of the deployed app.
//
// Matches by the resident doc's own `full` name field (already populated for
// residents migrated from MASTER_ROTA -- see commits 904e07f/7e88f9d/300d5a0)
// against the "Name" column of the staff-directory CSV. This is far less
// ambiguous than fuzzy-matching short names, since `full` already holds the
// same kind of full legal name the CSV uses -- exact matches only, nothing
// guessed. Residents with no `full` on file (or no CSV match) are skipped and
// listed at the end for manual follow-up.
//
// Setup (once), same as set-admin-claim.js:
//   1. Firebase Console -> Project Settings -> Service Accounts ->
//      "Generate new private key" -> save as scripts/serviceAccountKey.json
//      (this filename is already gitignored -- never commit it)
//   2. cd scripts && npm install
//
// Usage:
//   node backfill-resident-contacts.js --dry-run   # preview only, no writes
//   node backfill-resident-contacts.js              # apply the changes

const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const DRY_RUN = process.argv.includes('--dry-run');

const CSV_PATH = path.join(
  __dirname,
  '..',
  'Staff directory 2876e996e1df8079ac62ddc10ca63efc_Staff Directory 2876e996e1df800fa12f000b88b9da51.csv',
);

const keyPath = path.join(__dirname, 'serviceAccountKey.json');
let serviceAccount;
try {
  serviceAccount = require(keyPath);
} catch (e) {
  console.error('Could not load scripts/serviceAccountKey.json.');
  console.error('Download one from Firebase Console -> Project Settings ->');
  console.error('Service Accounts -> "Generate new private key", and save it');
  console.error('at that exact path. Also run "npm install" in scripts/ first.');
  console.error(String(e.message || e));
  process.exit(1);
}

// Minimal CSV parser: handles quoted fields (with embedded commas), since the
// staff directory has commas inside quoted "Academic Activities"/"Rollup"
// cells. No external dependency needed for a file this small.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Same convention as the old backend/seed/load_staff_directory.py normalizer:
// strip everything but digits, drop a leading country code or trunk zero,
// then prepend +966.
function normalizePhone(raw) {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('966')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  if (!digits) return null;
  return `+966${digits}`;
}

function normalizeName(s) {
  return (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

async function main() {
  // Strip a leading UTF-8 BOM if present -- otherwise the first header cell
  // parses as "﻿Name" instead of "Name" and the column lookup below fails.
  const csvText = fs.readFileSync(CSV_PATH, 'utf8').replace(/^﻿/, '');
  const [header, ...rows] = parseCsv(csvText);
  const nameIdx = header.indexOf('Name');
  const phoneIdx = header.indexOf('Phone');
  const emailIdx = header.indexOf('Email');
  if (nameIdx === -1 || phoneIdx === -1) {
    console.error(`Expected "Name"/"Phone" columns in the CSV header, got: ${header.join(', ')}`);
    process.exit(1);
  }

  const byName = new Map();
  for (const r of rows) {
    const name = normalizeName(r[nameIdx]);
    if (!name) continue;
    byName.set(name, { phone: r[phoneIdx], email: r[emailIdx] || null });
  }

  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  const snap = await db.collection('residents').get();
  console.log(`Found ${snap.size} resident doc(s).`);

  let phoneFilled = 0, roleFilled = 0, skippedNoFull = 0, skippedNoMatch = 0;
  const unmatched = [];
  const writes = [];

  snap.forEach((doc) => {
    const d = doc.data();
    const patch = {};

    if (!d.role) {
      patch.role = 'resident';
      roleFilled++;
    }

    if (!d.phone) {
      if (!d.full) {
        skippedNoFull++;
      } else {
        const hit = byName.get(normalizeName(d.full));
        if (!hit) {
          skippedNoMatch++;
          unmatched.push(`${doc.id} (full: "${d.full}")`);
        } else {
          const phone = normalizePhone(hit.phone);
          if (phone) {
            patch.phone = phone;
            if (hit.email && !d.email) patch.email = hit.email.trim() || null;
            phoneFilled++;
          }
        }
      }
    }

    if (Object.keys(patch).length > 0) {
      writes.push({ id: doc.id, patch });
    }
  });

  console.log(`\nPlanned changes (${writes.length} doc(s)):`);
  for (const w of writes) console.log(`  ${w.id}:`, w.patch);

  console.log(`\nPhone backfilled: ${phoneFilled}`);
  console.log(`Role defaulted:   ${roleFilled}`);
  console.log(`Skipped (no "full" name on file): ${skippedNoFull}`);
  console.log(`Skipped (no CSV match): ${skippedNoMatch}`);
  if (unmatched.length) {
    console.log('\nNo CSV match for (review manually):');
    unmatched.forEach((u) => console.log(`  - ${u}`));
  }

  if (DRY_RUN) {
    console.log('\n--dry-run: no writes performed.');
    return;
  }

  for (const w of writes) {
    await db.collection('residents').doc(w.id).set(
      { ...w.patch, updatedAt: FieldValue.serverTimestamp(), updatedBy: 'backfill-resident-contacts-script' },
      { merge: true },
    );
  }
  console.log(`\nWrote ${writes.length} doc(s).`);
}

main().catch((e) => {
  console.error('Failed:', e.message || e);
  process.exit(1);
});
