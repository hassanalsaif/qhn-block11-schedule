# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A browser-based React app for building and editing the QHN Pediatrics on-call schedule (Block 11: Jul 5 – Aug 1, 2026). The chief resident uses it to view, drag-and-drop edit, and export the duty rota.

## How to run

The app is served by a Python static HTTP server (no build step needed):

```bash
# From the CRT2 directory:
python -m http.server 3412 --directory app
```

Then open **http://localhost:3412** in a browser. The Claude preview panel is configured to start this server automatically via `.claude/launch.json`.

The app runs as a standalone HTML file (`app/index.html`) that uses **Babel Standalone** (CDN) to transpile JSX in the browser at runtime. There is no build/compile step.

## File layout

| File | Purpose |
|---|---|
| `block11_schedule.jsx` | **Source of truth** — full React app as JSX. Edit this file first. |
| `app/index.html` | **What the browser serves** — a copy of the JSX embedded inside a `<script type="text/babel">` tag with `import`/`export` lines removed. Must be kept in sync with the JSX manually. |
| `app/block11_template.docx` | Original blank Word template used by the export function as a fill-in base. |
| `block 11.docx` | The original template in the project root (same file, copied to app/). |
| `app/src/App.jsx` + `app/src/main.jsx` | Vite entry points (installed but not currently used — Python server is active). |

**When editing logic**: change `block11_schedule.jsx`, then mirror the same change into `app/index.html` (replacing `import { useState } from "react"` → `const { useState } = React;` and removing `export default`).

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
