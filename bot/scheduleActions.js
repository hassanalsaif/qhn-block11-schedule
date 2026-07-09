// scheduleActions.js — read (and, in a later build step, write) access to
// schedules/block11, plus resident lookups against residents/{shortName}.
// Pure data-layer functions: no Claude/Anthropic code here, no WhatsApp code
// here -- intentParser.js wraps these as tool calls for the agent, and
// index.js wires the reply back to WhatsApp. Kept this way so the same
// functions are trivially unit-testable and so a future write path (Task 5)
// slots in next to these without touching the agent-loop code.

const { FieldValue } = require('firebase-admin/firestore');
// Shared scheduling-constraint logic. bot/checkWarnings.cjs is a byte copy of
// app/checkWarnings.js (the browser-facing source of truth), regenerated from
// it by the `functions.predeploy` hook in firebase.json before every deploy --
// a copy lives inside bot/ because Firebase Functions only bundles this
// directory, and it's a `.cjs` so Node loads it as CommonJS regardless of
// app/'s "type":"module". Never edit bot/checkWarnings.cjs directly; edit
// app/checkWarnings.js.
const { checkWarnings } = require('./checkWarnings.cjs');

const CALL_SLOTS = ['SO', 'NICU', 'PICU', 'PMW'];
const DAY_CALL_SLOTS = ['DC_PMW', 'DC_NICU'];
const ALL_SLOTS = [...CALL_SLOTS, ...DAY_CALL_SLOTS];

// The schedule's `date` field is formatted like "Jul 9" / "Aug 1" -- short
// month name, numeric day, no leading zero, no year (the block never spans
// a year boundary). Matches Date#toLocaleString('en-US', {month:'short',
// day:'numeric'}) exactly, so "today"/"tomorrow" can be computed straight
// from the server clock without a bespoke parser.
function formatAsScheduleDate(date) {
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

function todayScheduleDate() {
  return formatAsScheduleDate(new Date());
}

function tomorrowScheduleDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatAsScheduleDate(d);
}

async function getScheduleDays(db) {
  const snap = await db.collection('schedules').doc('block11').get();
  if (!snap.exists) throw new Error('schedules/block11 does not exist yet.');
  return snap.data().days || [];
}

async function getResidentDocs(db) {
  const snap = await db.collection('residents').get();
  const byName = new Map();
  snap.forEach((doc) => byName.set(doc.id, doc.data()));
  return byName;
}

/**
 * All slot assignments for one specific day.
 * @param {string} date - must exactly match a schedule `date` value, e.g. "Jul 17"
 */
async function whoIsOnCall(db, date) {
  const days = await getScheduleDays(db);
  const row = days.find((r) => r.date === date);
  if (!row) {
    return { error: `"${date}" isn't a valid Block 11 date. Valid range: ${days[0]?.date}–${days[days.length - 1]?.date}.` };
  }
  const result = { date: row.date, day: row.day, type: row.type };
  for (const slot of ALL_SLOTS) result[slot] = row[slot] || [];
  return result;
}

/**
 * Every call assignment for one resident across the whole block, in date order.
 * @param {string} name - resident short name, e.g. "H.Saif"
 */
async function getResidentCalls(db, name) {
  const days = await getScheduleDays(db);
  const calls = [];
  for (const row of days) {
    for (const slot of ALL_SLOTS) {
      if ((row[slot] || []).includes(name)) {
        calls.push({ date: row.date, day: row.day, slot });
      }
    }
  }
  return calls;
}

/**
 * The next call on or after today for one resident (or null if none remain).
 * @param {string} name - resident short name
 */
async function getNextCall(db, name) {
  const calls = await getResidentCalls(db, name);
  const days = await getScheduleDays(db);
  const dateIdx = new Map(days.map((r, i) => [r.date, i]));
  const todayIdx = dateIdx.get(todayScheduleDate()) ?? 0;
  const upcoming = calls
    .filter((c) => (dateIdx.get(c.date) ?? -1) >= todayIdx)
    .sort((a, b) => dateIdx.get(a.date) - dateIdx.get(b.date));
  return upcoming[0] || null;
}

/**
 * Fuzzy lookup: query can be a short name, a substring of the full name, or
 * a level (e.g. "R2"). Returns every resident doc that matches, so the agent
 * can disambiguate ("did you mean X or Y?") when more than one comes back.
 */
async function findResident(db, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const byName = await getResidentDocs(db);
  const hits = [];
  for (const [shortName, d] of byName) {
    const full = (d.full || '').toLowerCase();
    const level = (d.level || '').toLowerCase();
    if (
      shortName.toLowerCase().includes(q) ||
      full.includes(q) ||
      level === q
    ) {
      hits.push({ name: shortName, full: d.full || null, level: d.level || null, rotation: d.rotation || null });
    }
  }
  return hits;
}

// ─────────────────────────── write layer (chief edits) ───────────────────────────
//
// An "edit" is an ordered list of ops, applied atomically, so a swap (two
// removes + two adds) is one confirmable unit:
//   { op: "add"|"remove", name, date, slot }
// The agent constructs these from natural language (see intentParser.js write
// tools). Nothing here commits on its own -- proposeEdit stages a pending doc,
// commitPending re-reads fresh state, re-validates, writes, and audits.

function deepCloneDays(days) {
  return JSON.parse(JSON.stringify(days));
}

// Build the {rotationMap, vacationWeeks, unwantedDays} maps checkWarnings needs
// from the live residents collection (the browser app builds the same maps from
// the same collection via its onSnapshot listener).
async function buildMeta(db) {
  const byName = await getResidentDocs(db);
  const rotationMap = {}, vacationWeeks = {}, unwantedDays = {};
  for (const [name, d] of byName) {
    if (d.rotation) rotationMap[name] = d.rotation;
    if ((d.vacationWeeks || []).length) vacationWeeks[name] = d.vacationWeeks;
    if ((d.unwantedDays || []).length) unwantedDays[name] = d.unwantedDays;
  }
  return { rotationMap, vacationWeeks, unwantedDays };
}

// Apply ops to a cloned days array. Returns { days, error }. Validates only
// structure/existence here (valid date, valid slot, resident actually present
// for a remove) -- scheduling-rule *warnings* are computed separately by
// validateOps so they can be surfaced-but-overridden per the "warn, don't
// hard-block" decision.
function applyOps(days, ops) {
  const next = deepCloneDays(days);
  const byDate = new Map(next.map((r) => [r.date, r]));
  for (const op of ops) {
    const row = byDate.get(op.date);
    if (!row) return { error: `"${op.date}" isn't a valid Block 11 date.` };
    if (!ALL_SLOTS.includes(op.slot)) return { error: `"${op.slot}" isn't a valid slot. Use one of: ${ALL_SLOTS.join(', ')}.` };
    if (!Array.isArray(row[op.slot])) row[op.slot] = [];
    if (op.op === 'remove') {
      if (!row[op.slot].includes(op.name)) {
        return { error: `${op.name} isn't in ${op.slot} on ${op.date}, so can't be removed from it.` };
      }
      row[op.slot] = row[op.slot].filter((n) => n !== op.name);
    } else if (op.op === 'add') {
      if (!row[op.slot].includes(op.name)) row[op.slot] = [...row[op.slot], op.name];
    } else {
      return { error: `Unknown op "${op.op}".` };
    }
  }
  return { days: next };
}

// Run the shared checkWarnings for every "add" op against the resulting
// schedule. Advisory only -- returned to the chief for confirmation, never a
// hard block.
function validateOps(nextDays, ops, meta) {
  const warns = [];
  for (const op of ops) {
    if (op.op !== 'add') continue;
    warns.push(...checkWarnings(nextDays, op.name, op.date, op.slot, meta));
  }
  return warns;
}

// Stage a proposed edit for confirmation. Persists to pendingEdits/{proposer}
// so the *next* WhatsApp message (a separate, stateless webhook invocation)
// can commit it. Returns { summary, warnings, error }.
async function proposeEdit(db, proposer, ops, summary) {
  const days = await getScheduleDays(db);
  const applied = applyOps(days, ops);
  if (applied.error) return { error: applied.error };
  const meta = await buildMeta(db);
  const warnings = validateOps(applied.days, ops, meta);
  await db.collection('pendingEdits').doc(proposer).set({
    ops, summary: summary || null, warnings,
    proposedBy: proposer, createdAt: FieldValue.serverTimestamp(),
  });
  return { summary, warnings };
}

async function getPending(db, proposer) {
  const snap = await db.collection('pendingEdits').doc(proposer).get();
  return snap.exists ? snap.data() : null;
}

async function discardPending(db, proposer) {
  await db.collection('pendingEdits').doc(proposer).delete();
  return { discarded: true };
}

// Commit the staged edit. Re-reads the schedule FRESH (someone else may have
// edited it since the proposal), re-applies, writes schedules/block11 in the
// exact shape the app's writeSchedule() uses (so its onSnapshot listener picks
// it up with no app change), appends an immutable callAudit entry, and clears
// the pending doc. Returns { committed, summary, warnings, error }.
async function commitPending(db, proposer) {
  const pending = await getPending(db, proposer);
  if (!pending) return { error: 'There is no pending edit to confirm.' };
  const days = await getScheduleDays(db);
  const applied = applyOps(days, pending.ops);
  if (applied.error) {
    // The schedule changed underneath the proposal and it no longer applies.
    await discardPending(db, proposer);
    return { error: `That edit no longer applies (${applied.error}) — the schedule changed since you proposed it. Please ask again.` };
  }
  const meta = await buildMeta(db);
  const warnings = validateOps(applied.days, pending.ops, meta);

  await db.collection('schedules').doc('block11').set({
    days: applied.days,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: `whatsapp-bot:${proposer}`,
  }, { merge: true });

  await db.collection('callAudit').add({
    timestamp: FieldValue.serverTimestamp(),
    actor: proposer,
    summary: pending.summary || null,
    ops: pending.ops,
    warnings,
    committed: true,
  });

  await discardPending(db, proposer);
  return { committed: true, summary: pending.summary, warnings };
}

module.exports = {
  ALL_SLOTS,
  CALL_SLOTS,
  DAY_CALL_SLOTS,
  formatAsScheduleDate,
  todayScheduleDate,
  tomorrowScheduleDate,
  getScheduleDays,
  getResidentDocs,
  whoIsOnCall,
  getResidentCalls,
  getNextCall,
  findResident,
  // write layer
  buildMeta,
  applyOps,
  validateOps,
  proposeEdit,
  getPending,
  discardPending,
  commitPending,
};
