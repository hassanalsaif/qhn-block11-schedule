#!/usr/bin/env node
// Regenerates bot/checkWarnings.cjs from app/checkWarnings.js (the source of
// truth) before every functions deploy -- see the `functions.predeploy` hook
// in firebase.json. Kept as a real script file rather than an inline
// `node -e "..."` one-liner, because shell quoting for an embedded script
// differs between POSIX shells and Windows cmd.exe (which is what
// firebase-tools' predeploy runner uses on Windows) -- a quoted one-liner
// that works in Bash silently breaks there.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'app', 'checkWarnings.js');
const dest = path.join(__dirname, '..', 'bot', 'checkWarnings.cjs');
fs.copyFileSync(src, dest);
console.log(`Synced ${path.relative(process.cwd(), src)} -> ${path.relative(process.cwd(), dest)}`);
