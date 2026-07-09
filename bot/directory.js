// directory.js — phone number -> {name, role} lookup against the existing
// residents/{shortName} Firestore collection.
//
// This collection already existed before the bot was built (see the "Update
// mid-build" note at the top of the approved plan -- commits
// 904e07f/7e88f9d/300d5a0 added it to the Residents tab), so no separate
// directory collection is needed. scripts/backfill-resident-contacts.js
// fills in any missing `phone` values and defaults `role:"resident"`.
//
// WhatsApp gives us the sender's phone as digits-only, no "+"
// (e.g. "9665XXXXXXXX"). Every residents/* doc's `phone` field is normalized
// to "+966XXXXXXXXX", so comparison strips both to bare digits before
// matching.

function toDigits(phone) {
  return (phone || '').replace(/\D/g, '');
}

// Simple in-memory cache, refreshed once per cold start of the function
// instance (and every CACHE_TTL_MS after that): who's a resident/chief and
// their phone number changes at "new rotation" cadence, not per-message, so
// reading the whole collection on every incoming message would be wasteful.
// A stale cache just means a very recently-added resident isn't recognized
// until the cache next refreshes -- acceptable at this volume.
let cache = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function loadDirectory(db) {
  const now = Date.now();
  if (cache && now - cacheLoadedAt < CACHE_TTL_MS) return cache;
  const snap = await db.collection('residents').get();
  const byPhone = new Map();
  snap.forEach((doc) => {
    const d = doc.data();
    if (!d.phone) return;
    byPhone.set(toDigits(d.phone), { name: doc.id, role: d.role || 'resident' });
  });
  cache = byPhone;
  cacheLoadedAt = now;
  return byPhone;
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} waPhone - sender phone number as WhatsApp sends it (digits, no "+")
 * @returns {Promise<{name: string, role: "resident"|"chief"} | null>}
 */
async function lookupSender(db, waPhone) {
  const byPhone = await loadDirectory(db);
  return byPhone.get(toDigits(waPhone)) || null;
}

module.exports = { lookupSender, toDigits };
