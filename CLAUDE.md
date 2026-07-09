# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A browser-based React app for building and editing the QHN Pediatrics on-call schedule (Block 11: Jul 5 – Aug 1, 2026). The chief resident uses it to view, drag-and-drop edit, and export the duty rota.

## How to run

The app is served by a Python static HTTP server (no build step needed):

```bash
# From the CRT2 directory:
python -m http.server 3412 --directory app
# or: python server.py (same thing, plus no-cache headers)
```

Then open **http://localhost:3412** in a browser. The Claude preview panel is configured to start this server automatically via `.claude/launch.json`.

The app runs as a standalone HTML file (`app/index.html`) that uses **Babel Standalone** (CDN) to transpile JSX in the browser at runtime. There is no build/compile step.

**To test admin login / schedule edits locally**, also run the Firebase Local Emulator Suite (needs a JRE installed — the Firestore emulator is Java-based):
```bash
npx firebase-tools emulators:start --project=qhn-block11
```
The app auto-detects `localhost`/`127.0.0.1` and points at the emulators (ports 8080 Firestore, 9099 Auth) instead of real Firebase — see the `firebaseConfig` block in `app/index.html`'s `<head>`. Local dev can never touch production data this way; it's a different process/port, not a config flag that could be left on by accident.

## File layout

| File | Purpose |
|---|---|
| `block11_schedule.jsx` | **Source of truth** — full React app as JSX. Edit this file first. |
| `app/index.html` | **What the browser serves** — a copy of the JSX embedded inside a `<script type="text/babel">` tag with `import`/`export` lines removed. Must be kept in sync with the JSX manually. |
| `app/checkWarnings.js` | **Shared scheduling-constraint logic** — `checkWarnings()` + its constant deps (`slots`, `slotMax`, `getWeek`, `noSaturdayRes`, `noMondayRes`, `noSundayRes`, `r1Res`, `nicuUnit`, `picuUnit`). Loaded as a classic `<script>` in `app/index.html` (sets `window.*`) **and** required by the WhatsApp bot (via a generated `.cjs` copy — see the bot section). This is the single source of truth for the rules; both surfaces enforce them identically. See "The shared constraint module" below. |
| `app/block11_template.docx` | Original blank Word template used by the export function as a fill-in base. |
| `block 11.docx` | The original template in the project root (same file, copied to app/). |
| `app/src/App.jsx` + `app/src/main.jsx` | Vite entry points (installed but not currently used — Python server is active). |
| `deploy/index.html` | **What production (GitHub Pages) actually serves** — a separate copy of `app/index.html`, not a build artifact. Must be kept in sync manually; see "Deploying to production" below. |

**When editing logic**: change `block11_schedule.jsx`, then mirror the same change into `app/index.html` (replacing `import { useState } from "react"` → `const { useState } = React;` and removing `export default`).

**Known divergence**: `app/index.html` has drifted ahead of `block11_schedule.jsx` in *data* (not just logic) — it has its own hand-curated `MASTER_ROTA` (full 13-block rotation per resident), `BLOCK_VACATIONS`, `BLOCK_DATES`, a whole Master Rota browsing page, and `DC_NICU`/`DC_PMW` day-coverage call slots that the jsx doesn't have at all. Treat `app/index.html` as the more current data source until this is reconciled back into the jsx.

## Deploying to production

Production is GitHub Pages, deployed by `.github/workflows/deploy-pages.yml` from the **`deploy/`** folder — not `app/`. Critically, that workflow only triggers `on: push` with `paths: ['deploy/**', ...]`, so **a commit that only touches `app/index.html` (or `block11_schedule.jsx`) does not deploy, silently.** There's no error, no failed check — the workflow simply never runs, and production keeps serving the old build.

After changing `app/index.html`, copy it over `deploy/index.html` (`cp app/index.html deploy/index.html`), commit, and push to `main` before considering the change shipped. Verify a deploy actually happened by checking that the latest "Deploy to GitHub Pages" run's commit SHA matches your push (`https://github.com/hassanalsaif/qhn-block11-schedule/actions`), not just that `git push` succeeded.

## Architecture

Everything lives in a single React component file (`block11_schedule.jsx`). Key sections in order:

1. **`initialSchedule`** (lines 3–32) — Array of 28 day objects, one per day. Each row: `{ date, greg, hijri, day, type:"WD"|"WE", SO:[], NICU:[], PICU:[], PMW:[] }`. This is the actual schedule data — editing these arrays changes the schedule.

2. **Resident metadata** — `rotationMap` (which unit each resident rotates through), `levelMap` (R1/R2/R3/R4), `filterGroups`, `filterColors`, `rotColors` (badge styling per rotation).

3. **Constraint data** — `noSaturdayRes`, `noMondayRes`, `noSundayRes`, `r1Res`, `nicuUnit`, `picuUnit`, `unwantedDays`, `vacationWeeks`. These drive the warnings shown when a resident is moved to an invalid slot.

4. **`checkWarnings(sched, name, toDate, toSlot)`** — Runs all constraint checks and returns an array of warning strings. Called every time a resident is dropped into a new slot. **Note the divergence:** in `block11_schedule.jsx` this is still an inline function that closes over module-level constraint constants. In `app/index.html` it has been extracted to `app/checkWarnings.js` (loaded as a `<script>`), and its call sites now pass `{rotationMap, vacationWeeks, unwantedDays}` as an explicit 5th `meta` argument instead of closing over globals — because the same function is also required server-side by the WhatsApp bot, where those maps come from a fresh Firestore read rather than a browser-held `let`. See "The shared constraint module" below.

5. **`exportDocx(sched)`** — Fetches `block11_template.docx`, opens it with JSZip (CDN), injects resident names into the correct XML cells, and downloads the filled DOCX. Column mapping:
   - Weekdays (Sun–Thu): col 6=SO, 7=NICU, 8=PICU, 9=PMW
   - Weekends (Fri–Sat): cols 4+5 are merged/grey; col 5=SO, 6=NICU, 7=PICU, 8=PMW
   - Last row (Aug 1 Sat) cell 8 is skipped — it contains the department disclaimer text.

6. **`ResidentPanel`** — Shown when a name badge is clicked. Displays the resident's full call schedule for the block with gap indicators. Clicking a row in the panel selects that slot for editing.

7. **`App`** — Main component. Manages `sched` (schedule state), `selected` (the resident+slot being moved from), `spotlight` (which resident's panel is open), `warnings`, `filter`. The schedule table is rendered from `sched`; clicking a badge sets `selected`, then clicking a slot cell moves the resident.

## Scheduling rules encoded in constraints

- **Weekend**: Thu/Fri/Sat (`type:"WE"`). Weekday: Sun–Mon–Tue–Wed (`type:"WD"`).
- **No Saturday**: NICU/PICU team residents + H.Saif + Maab.
- **No Monday**: Dina, Mustafa, H.Saif, Maab (daytime unit conflicts).
- **No Sunday**: Reem.
- **R1 exclusion**: R1 residents cannot cover Jul 5, 6, or 7.
- **Min gap**: 4 days between any two calls for the same resident.
- **Slot max**: SO=2, NICU=2, PICU=2, PMW=3 per day.
- **Vacations**: stored per resident as week codes W1–W4 in `vacationWeeks`. Source: `Vacations-schedule,2026 updated.xlsx` (NOT Master Rota /V notations).
- 13 Master Rota residents (Maab, A.Marzooq, Dana, Hanan, Rawan, Jenan, Z.Abass, Z.Khowaildi, Erum, Safa, H.Salman, Z.Alsaleh, Entisar) aren't part of Block 11's active on-call roster at all — their current-block rotation (Elective/ER/Vacation/PHC/etc.) doesn't take pediatric ward on-call, so they're absent from `rotationMap`/`levelMap`/`residentProfiles` and every scheduling picker, but they still appear in the Residents tab (via `residents/{name}`'s `excludedFromBlock11` field) since that tab is a full resident database, not just the active roster.

## DOCX template structure

`block 11.docx` has 9 grid columns and 30 table rows (2 header + 28 data). The document.xml is minified. Empty data cells end with `</w:pPr></w:p></w:tc>` — the export function injects a `<w:r>` run before `</w:p>` to fill in text.

## Live data (Firestore) — the schedule, Daytime Coverage overrides, and resident database

These pieces of data live in Firestore, not in the file or in localStorage:

| Firestore doc/collection | Holds | Written by |
|---|---|---|
| `schedules/block11` | `{days: [...28 day objects...], updatedAt, updatedBy}` — the on-call grid | `writeSchedule()` in `app/index.html`, called by every schedule mutator (`handleCellClick`, `handleDelete`, `handleBatchAddDC`, `recommendDayCalls`, `handleAddToSlot`, `undo`, `reset`) |
| `manualUnavail/block11` | `{overrides: {"date\|name": status}, updatedAt, updatedBy}` — Daytime Coverage tab overrides | `writeManualUnavail()`, called by `handleSetStatus`/`handleClearAllStatus` |
| `consultantSchedules/block11` | `{values: {"specKey\|date\|colKey": {status,text}}, updatedAt, updatedBy}` — Subspecialty Consultant Schedules cells | `writeConsultantSchedules()`, called by `handleSetConsultantCell` |
| `residents/{name}` (collection, one doc per resident, doc ID = short name e.g. `residents/M.Khadhrawi`) | `{full, level, type, rotation, phone, email, vacationWeeks, unwantedDays, masterRota, excludedFromBlock11, constraints, notes, role, updatedAt, updatedBy}` — the resident database shown on the Residents tab. `role: "resident"\|"chief"` (added for the WhatsApp bot) gates who can edit the schedule from chat. `phone` (already admin-editable on the Residents tab) is how the bot identifies an incoming WhatsApp sender. | `writeResident(id, patch)` in `app/index.html`; `role`/`phone` also backfilled by `scripts/backfill-resident-contacts.js` |
| `callAudit/{autoId}` (collection, auto-ID docs, append-only) | `{timestamp, actor, summary, ops, warnings, committed}` — one entry per chief schedule edit made via WhatsApp | The bot's Cloud Function (Admin SDK). **Bot-only** — `firestore.rules` denies all client read/write. |
| `pendingEdits/{chiefShortName}` (collection, doc ID = proposing chief's short name) | `{ops, summary, warnings, proposedBy, createdAt}` — transient "awaiting confirmation" state for a chief's proposed edit, between the propose message and the confirm message | The bot's Cloud Function (Admin SDK). **Bot-only** — `firestore.rules` denies all client read/write. |

**The resident database and the six legacy bindings**: `App()` has a single `onSnapshot` listener on the `residents` collection that rebuilds the six module-level bindings described below (`rotationMap`, `levelMap`, `vacationWeeks`, `unwantedDays`, `residentProfiles`, `MASTER_ROTA`) from the live documents on every change — falling back to the embedded `DEFAULT_residentProfiles`/`DEFAULT_levelMap`/`DEFAULT_rotationMap` EXT entries only for any External Rotator not yet migrated into Firestore (all 53 residents are migrated as of this writing, so this fallback is currently a no-op, but it keeps future partial rollouts safe — a resident never vanishes mid-migration). This means every existing consumer of those six bindings (add-to-slot pickers, `buildFilterGroups()`, Daytime Coverage's `COVERAGE_TEAMS`, `checkWarnings()`, `exportDocx`'s badge coloring, `MasterRotaPage`) needed zero changes. If the `residents` collection is empty, every binding falls back to its `DEFAULT_*` baseline, so this is safe to deploy well ahead of running the one-time seed. A resident's `excludedFromBlock11:true` flag (see the "Scheduling rules" section above) removes them from `rotationMap`/`levelMap` (so they're not offered for scheduling) but not from `residentProfiles`/`MASTER_ROTA` (so they still show up in the Residents tab and Master Rota page). `masterRota:null` (External Rotators only, since they aren't part of the 13-block long-term rotation) excludes a resident from the `MASTER_ROTA` rebuild entirely, same as today.

**Why**: this replaced a fragile static-file-publish mechanism (bake schedule into the HTML's own `DEFAULT_initialSchedule` constant, git commit + push) that caused repeated "my edit isn't showing up" bugs — every browser's `localStorage` could silently diverge from what was actually published, with no way to reconcile except manually clearing storage. Firestore's `onSnapshot` listeners mean every viewer's screen updates live, the instant an edit is saved — no publish step, no cache, nothing to diverge.

**Security model**: anyone can read both docs (matches the app's historical fully-public behavior — no viewer login needed). Only a signed-in user carrying the `{admin: true}` custom claim can write — enforced server-side by `firestore.rules`, not just by the client's `isAdmin` UI flag (which only hides/shows edit buttons; the real check is in the rules).

**Local dev never touches production Firestore.** `app/index.html`'s `firebaseConfig` script block auto-detects `localhost`/`127.0.0.1` and calls `useEmulator(...)` for both Firestore and Auth — a completely different local process (`npx firebase-tools emulators:start`, needs Java), not a flag that could be left pointed at prod by accident.

**Granting admin access**: `scripts/set-admin-claim.js` (needs `scripts/serviceAccountKey.json`, a service account key downloaded from Firebase Console → Project Settings → Service Accounts — gitignored, never commit it):
```bash
cd scripts && npm install
node set-admin-claim.js someone@example.com true                # grant (account must already exist)
node set-admin-claim.js someone@example.com true somepassword    # create the account AND grant (first admin)
node set-admin-claim.js someone@example.com false                # revoke
```

**Resident metadata** for all 53 residents — the 49 Master Rota residents plus the 4 External Rotators (Musawi, Malak, F.Hamood, O.Alsaihati) — lives in the `residents` Firestore collection described above, admin-editable from the Residents tab. External Rotators have `full:null` (no full legal name was available anywhere in the codebase to migrate) and `masterRota:null` (they were never part of the 13-block long-term rotation). `BLOCK_VACATIONS` and `BLOCK_DATES` (the other 12 blocks' data, used only by the Master Rota browsing page) are still embedded `DEFAULT_*` constants, not Firestore — they change at "new block" cadence, which fits a code-edit workflow fine.

## WhatsApp on-call bot (`bot/`)

A Firebase **Cloud Function (2nd gen)** that lets residents ask about the schedule over WhatsApp, and lets chief residents edit it from chat. It reads/writes the **same Firestore project (`qhn-block11`)** as `app/index.html`, so a chief's chat edit lands in `schedules/block11` in the exact shape `writeSchedule()` uses and shows up live in every open browser tab via the app's existing `onSnapshot` listener — **the app's read side needs zero changes for this to work.** Full deploy/local-test runbook: `bot/README.md`.

**Why this shape (and not the earlier plan):** an earlier iteration assumed the retired Flask/SQLite backend held phone numbers. It doesn't — and by the time the bot was built, the `residents/{name}` collection already existed and already stored `phone`/`email` per resident. So the bot has **no separate directory collection and no CSV name-matching**: it identifies a sender by scanning `residents` for a matching `phone`, and reads schedule/resident data straight from Firestore.

### Auth model — the bot is a second trusted writer

`firestore.rules` requires a `{admin:true}` custom claim to write the schedule — that's a *browser-session* concept (sign in → ID token → claim). A server bot has no user to sign in as, so it authenticates as a **service account via the Firebase Admin SDK, which bypasses security rules entirely by design** (same mechanism as `scripts/set-admin-claim.js`). `firestore.rules` is unchanged for the existing collections; the bot is simply a second writer at the same trust tier as an admin browser, authenticated a different way. The bot replicates the *intent* of the rule in application logic: only a sender whose `residents` doc has `role:"chief"` is offered the write tools (enforced server-side in `intentParser.js`, not just by prompt).

### The shared constraint module

`checkWarnings()` and its constant dependencies were extracted from `app/index.html` into **`app/checkWarnings.js`** so the app and the bot enforce the *same* scheduling rules with no risk of drift. It's environment-dual: a classic `<script>` in the browser (assigns `window.*`), and `module.exports` when required by Node. `checkWarnings(sched, name, toDate, toSlot, meta)` takes the resident-derived maps (`{rotationMap, vacationWeeks, unwantedDays}`) as an explicit `meta` arg rather than closing over mutable state — the browser passes its live `let` bindings; the bot passes a fresh Firestore read (`buildMeta()` in `scheduleActions.js`).

**Two gotchas that dictate the `.cjs` copy** (`bot/checkWarnings.cjs`):
1. `app/package.json` declares `"type":"module"`, so Node would parse `app/checkWarnings.js` as ESM and the `module.exports` branch would never run.
2. Firebase Functions only bundles files inside the `source` dir (`bot/`), so `require('../app/checkWarnings')` would break in production anyway.

So `bot/checkWarnings.cjs` is a **byte copy** of `app/checkWarnings.js` (`.cjs` forces CommonJS regardless of the ESM package), regenerated from the source by the `functions.predeploy` hook in `firebase.json` before every deploy. **Never edit `bot/checkWarnings.cjs` directly — edit `app/checkWarnings.js`.**

### File breakdown (`bot/`)

| File | Role |
|---|---|
| `index.js` | Webhook entry (`exports.whatsappWebhook`, `onRequest`). GET = Meta verification handshake; POST = verifies Meta's `X-Hub-Signature-256` HMAC against `req.rawBody` (constant-time) **before parsing anything**, identifies the sender, runs the agent, sends the reply, then acks 200. Secrets via `defineSecret` (Google Secret Manager), not committed. |
| `directory.js` | `lookupSender(db, waPhone)` → `{name, role}` by scanning `residents` for a matching normalized phone (5-min in-memory cache). |
| `intentParser.js` | The Claude (`claude-haiku-4-5`) tool-use loop. Read tools for everyone; the three write tools (`propose_edit`/`confirm_edit`/`discard_edit`) are appended **only when `role==="chief"`**. `runTool()` re-checks the role defensively. |
| `scheduleActions.js` | Pure Firestore data layer: reads (`whoIsOnCall`, `getResidentCalls`, `getNextCall`, `findResident`) + the write flow (`proposeEdit` → `commitPending`), constraint validation via the shared module, and `callAudit` logging. No Claude/WhatsApp code here. |
| `checkWarnings.cjs` | Generated copy of `app/checkWarnings.js` (see above). |
| `whatsappClient.js` | Sends the reply via the Meta Graph API (`v21.0`), using Node's built-in `fetch`. |
| `README.md` | Prereqs, local-emulator testing, deploy commands, smoke test. |

### The chief write flow: propose → confirm → commit → audit

WhatsApp is stateless per message (each inbound message is a separate webhook invocation), so a "propose then confirm" exchange persists its state in Firestore:

1. **propose** — the agent resolves the edit to an ordered list of `ops` (`{op:"add"|"remove", name, date, slot}`; a swap = two removes + two adds, applied atomically), stages it in `pendingEdits/{chief}` with the computed warnings, and replies asking the chief to confirm. **Nothing is written to the schedule yet.**
2. **confirm** — on the next message, `index.js` loads the pending doc and injects it into the agent's context; if the chief confirms, `commitPending()` **re-reads the schedule fresh** (in case it changed since the proposal — if the ops no longer apply, it aborts and discards), re-validates, writes `schedules/block11`, appends a `callAudit` entry, and clears the pending doc.
3. **Warnings are advisory, not blocking** — matching the app's own behavior, where an admin can complete a drag-and-drop despite a warning banner. The bot surfaces warnings and lets the chief proceed through them.

### Local test & deploy (summary — full detail in `bot/README.md`)

- **Local:** `cp bot/.env.example bot/.env` (fill in), then run the bot in the Firebase emulator alongside the app; expose it to a Meta test webhook via a tunnel (`cloudflared`/`ngrok`). Emulator = never touches prod, same as the app.
- **Deploy:** requires the project on the **Blaze** plan (Cloud Functions needs it; $0 within free tier). Set the five secrets with `firebase functions:secrets:set`, then `firebase deploy --only functions,firestore:rules`. Register the function URL as the Meta webhook and subscribe to `messages`.
- **One-time data prep:** `scripts/backfill-resident-contacts.js` fills any missing `residents/{name}.phone` (matched against the staff-directory CSV by each doc's existing `full` name) and defaults `role:"resident"`; then set `role:"chief"` on the chief doc(s) in the Firebase console.
- **Cost:** Cloud Functions + Firestore both stay within free tiers at this volume; the only real cost is the Claude API (~$5–20/mo). WhatsApp inbound Q&A and chief edits are free (user-initiated).

## Retired: the old Flask/SQLite backend

`backend/` (Flask + SQLite, gitignored, never actually deployed anywhere) used to read-only-hydrate the metadata above via a `GET /api/block11/bootstrap` fetch on mount. That fetch has been removed from `app/index.html` entirely — the backend is no longer called by anything. Per the chief's own call, the files are left on disk (not deleted) in case they're useful for reference later, but they're dead code as far as the running app is concerned. `server.py`'s old `/publish` endpoint (which the static-file-publish mechanism above posted to) has likewise been removed — it's now pure static file serving with no-cache headers.
