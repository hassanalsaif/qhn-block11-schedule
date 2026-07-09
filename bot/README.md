# WhatsApp on-call bot (`bot/`)

A Firebase Cloud Function (2nd gen) that lets residents ask about the Block 11
on-call schedule over WhatsApp, and lets **chief residents** edit it from chat.
It reads/writes the same Firestore project (`qhn-block11`) as `app/index.html`,
so a chief's edit shows up live in the web app via its existing `onSnapshot`
listeners — no app change needed.

## How it fits together

| File | Role |
|---|---|
| `index.js` | Webhook entry point. GET = Meta verification; POST = verifies the `X-Hub-Signature-256` HMAC on the raw body, identifies the sender, runs the agent, replies. |
| `directory.js` | Maps the sender's phone → `{name, role}` by scanning the existing `residents/{shortName}` collection (cached 5 min). |
| `intentParser.js` | The Claude (`claude-haiku-4-5`) tool-use loop. Read tools for everyone; write tools (`propose_edit`/`confirm_edit`/`discard_edit`) only added when `role === "chief"`. |
| `scheduleActions.js` | Pure data layer over Firestore: reads, plus the write flow (`proposeEdit` → `commitPending`), validation via the shared `checkWarnings`, and audit logging. |
| `checkWarnings.cjs` | **Generated** byte-copy of `app/checkWarnings.js` (the source of truth). Refreshed by the `predeploy` hook in `firebase.json`. Never edit directly. |
| `whatsappClient.js` | Sends the reply via the Meta Graph API. |

Two bot-only Firestore collections (locked to Admin-SDK-only in
`firestore.rules`): `callAudit/{autoId}` (append-only edit log) and
`pendingEdits/{chiefShortName}` (transient "awaiting confirmation" state).

## One-time prerequisites

1. **Blaze plan** on `qhn-block11` (Cloud Functions requires it; stays $0 within
   the free tier). Firebase Console → Upgrade.
2. **Resident phone numbers + roles.** Run the contact backfill once (needs
   `scripts/serviceAccountKey.json`, same key as `set-admin-claim.js`):
   ```bash
   cd scripts && npm install
   node backfill-resident-contacts.js --dry-run   # preview
   node backfill-resident-contacts.js             # apply
   ```
   Then set your chief(s): in the Firebase console, edit the relevant
   `residents/{shortName}` doc(s) and set `role: "chief"`.
3. **Meta WhatsApp** — a Meta Business app with the WhatsApp product, a phone
   number, a permanent access token, and the app secret. See `.env.example`.

## Local testing (Firebase emulator)

Never touches production. From the repo root:
```bash
cp bot/.env.example bot/.env      # fill in real values (bot/.env is gitignored)
cd bot && npm install && cd ..
npx firebase-tools emulators:start --project=qhn-block11
```
Expose the local function to Meta with a tunnel (`cloudflared tunnel --url
http://localhost:5001` or `ngrok http 5001`) and register that URL as a test
webhook. Send yourself a WhatsApp message; watch the emulator logs.

## Deploy to production

```bash
# set each secret once (stored in Google Secret Manager, not in code):
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase functions:secrets:set WHATSAPP_TOKEN
firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID
firebase functions:secrets:set WHATSAPP_VERIFY_TOKEN
firebase functions:secrets:set WHATSAPP_APP_SECRET

firebase deploy --only functions,firestore:rules --project=qhn-block11
```
The `predeploy` hook refreshes `bot/checkWarnings.cjs` from
`app/checkWarnings.js` automatically. `firestore:rules` ships the new
`callAudit`/`pendingEdits` lockdown rules.

After deploy, take the function's HTTPS URL and register it in the Meta App
dashboard (Webhooks → WhatsApp → Callback URL + your `WHATSAPP_VERIFY_TOKEN`),
then subscribe to the `messages` field.

## Production smoke test

1. From a **resident** number: "who's on call today?" → correct answer.
2. From a resident number: "move Dina to NICU tomorrow" → politely refused
   (read-only).
3. From a **chief** number: "swap …" → bot describes the change + any warnings
   and asks to confirm; reply "yes" → the web app updates live, and a
   `callAudit` doc appears.
4. POST to the webhook with a bad `X-Hub-Signature-256` → `403`, no processing.
