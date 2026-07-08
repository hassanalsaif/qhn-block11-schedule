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

4. **`checkWarnings(sched, name, toDate, toSlot)`** — Runs all constraint checks and returns an array of warning strings. Called every time a resident is dropped into a new slot.

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
- A. Marzooq is excluded from this block entirely (not in any data).

## DOCX template structure

`block 11.docx` has 9 grid columns and 30 table rows (2 header + 28 data). The document.xml is minified. Empty data cells end with `</w:pPr></w:p></w:tc>` — the export function injects a `<w:r>` run before `</w:p>` to fill in text.

## Live data (Firestore) — the schedule and Daytime Coverage overrides

These two are the only genuinely *live, multi-user* pieces of data, and they live in Firestore, not in the file or in localStorage:

| Firestore doc | Holds | Written by |
|---|---|---|
| `schedules/block11` | `{days: [...28 day objects...], updatedAt, updatedBy}` — the on-call grid | `writeSchedule()` in `app/index.html`, called by every schedule mutator (`handleCellClick`, `handleDelete`, `handleBatchAddDC`, `recommendDayCalls`, `handleAddToSlot`, `undo`, `reset`) |
| `manualUnavail/block11` | `{overrides: {"date\|name": status}, updatedAt, updatedBy}` — Daytime Coverage tab overrides | `writeManualUnavail()`, called by `handleSetStatus`/`handleClearAllStatus` |

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

**Resident metadata** (`rotationMap`, `levelMap`, `vacationWeeks`, `unwantedDays`, `residentProfiles`, `MASTER_ROTA`, `BLOCK_VACATIONS`, `BLOCK_DATES`) is **not** in Firestore — it's just the embedded `DEFAULT_*` constants in `app/index.html`, edited by hand and shipped via normal git commits. It changes at "new block / new resident roster" cadence, which fits a code-edit workflow fine; there was never a live-sync complaint about it, unlike the schedule.

## Retired: the old Flask/SQLite backend

`backend/` (Flask + SQLite, gitignored, never actually deployed anywhere) used to read-only-hydrate the metadata above via a `GET /api/block11/bootstrap` fetch on mount. That fetch has been removed from `app/index.html` entirely — the backend is no longer called by anything. Per the chief's own call, the files are left on disk (not deleted) in case they're useful for reference later, but they're dead code as far as the running app is concerned. `server.py`'s old `/publish` endpoint (which the static-file-publish mechanism above posted to) has likewise been removed — it's now pure static file serving with no-cache headers.
