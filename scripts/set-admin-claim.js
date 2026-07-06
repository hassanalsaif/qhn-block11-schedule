#!/usr/bin/env node
// One-off local script: grants (or revokes) the {admin:true} custom claim
// that firestore.rules checks before allowing schedule/manualUnavail writes.
// Not part of the deployed app -- run this from your own machine whenever a
// new admin needs access, or an existing one should lose it.
//
// Setup (once):
//   1. Firebase Console -> Project Settings -> Service Accounts ->
//      "Generate new private key" -> save as scripts/serviceAccountKey.json
//      (this filename is already gitignored -- never commit it)
//   2. cd scripts && npm install
//
// Usage:
//   node set-admin-claim.js <admin-email> true                # grant admin (user must already exist)
//   node set-admin-claim.js <admin-email> false                # revoke admin
//   node set-admin-claim.js <admin-email> true <new-password>  # create the account AND grant admin
//                                                                (use this for the very first admin,
//                                                                 since a fresh project has no users yet)

const path = require('path');
// firebase-admin v12+ dropped the classic admin.auth() namespaced API by
// default -- use the modular imports so this keeps working regardless of
// which version "npm install" resolves to.
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const email = process.argv[2];
const shouldBeAdmin = process.argv[3];
const newPassword = process.argv[4];

if (!email || !['true', 'false'].includes(shouldBeAdmin)) {
  console.error('Usage: node set-admin-claim.js <admin-email> <true|false> [password-if-creating]');
  process.exit(1);
}

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

initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();

async function main() {
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    if (!newPassword) {
      console.error(`No account exists for ${email} yet.`);
      console.error('Pass a password as a 3rd argument to create it: node set-admin-claim.js <email> true <password>');
      process.exit(1);
    }
    user = await auth.createUser({ email, password: newPassword });
    console.log(`Created new account for ${email} (uid: ${user.uid}).`);
  }
  await auth.setCustomUserClaims(user.uid, { admin: shouldBeAdmin === 'true' });
  console.log(`${shouldBeAdmin === 'true' ? 'Granted' : 'Revoked'} admin for ${email} (uid: ${user.uid}).`);
  console.log('They must sign out and back in (or wait for their next token refresh) for this to take effect.');
}

main().catch(e => {
  console.error('Failed:', e.message || e);
  process.exit(1);
});
