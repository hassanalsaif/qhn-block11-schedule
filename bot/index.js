// index.js — WhatsApp Cloud API webhook: Cloud Function (2nd gen) entry point.
//
// GET  -> Meta's one-time webhook verification handshake.
// POST -> incoming message notifications. Verifies Meta's HMAC signature
//         against the RAW body before parsing anything, identifies the
//         sender against the existing residents/{shortName} collection, and
//         replies via the WhatsApp Graph API.
//
// Processing happens fully inside the request handler, and the webhook POST
// is only ack'd (res.sendStatus(200)) once the WhatsApp reply has actually
// been sent -- a Cloud Function instance isn't guaranteed to keep running
// after its HTTP response is flushed, so "ack immediately, reply later in
// the background" is not a safe pattern here.
//
// Read-only Q&A (intentParser.js/scheduleActions.js) lands in the next build
// step; for now this scaffolds the webhook plumbing + signature verification
// + sender identification, with a placeholder reply so the round trip can be
// verified end-to-end before the Claude-powered logic is wired in.

const crypto = require('crypto');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { lookupSender } = require('./directory');
const { sendWhatsAppText } = require('./whatsappClient');
const { handleMessage } = require('./intentParser');

initializeApp();
const db = getFirestore();

// Secrets, set once per environment via:
//   firebase functions:secrets:set WHATSAPP_TOKEN
//   firebase functions:secrets:set WHATSAPP_VERIFY_TOKEN
//   firebase functions:secrets:set WHATSAPP_APP_SECRET
//   firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID
//   firebase functions:secrets:set ANTHROPIC_API_KEY
// (stored in Google Secret Manager, not committed). See .env.example for
// what each one is and for local-emulator testing.
const WHATSAPP_TOKEN = defineSecret('WHATSAPP_TOKEN');
const WHATSAPP_VERIFY_TOKEN = defineSecret('WHATSAPP_VERIFY_TOKEN');
const WHATSAPP_APP_SECRET = defineSecret('WHATSAPP_APP_SECRET');
const WHATSAPP_PHONE_NUMBER_ID = defineSecret('WHATSAPP_PHONE_NUMBER_ID');
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

function verifySignature(req, appSecret) {
  const signature = req.get('X-Hub-Signature-256');
  if (!signature || !signature.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');
  const given = signature.slice('sha256='.length);
  // Constant-time comparison -- avoids leaking the expected signature via
  // response-timing differences.
  let a, b;
  try {
    a = Buffer.from(expected, 'hex');
    b = Buffer.from(given, 'hex');
  } catch {
    return false;
  }
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

exports.whatsappWebhook = onRequest(
  { secrets: [WHATSAPP_TOKEN, WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_PHONE_NUMBER_ID, ANTHROPIC_API_KEY] },
  async (req, res) => {
    if (req.method === 'GET') {
      // Meta's webhook verification handshake -- run once, when you register
      // the deployed function's URL in the Meta App dashboard.
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN.value()) {
        res.status(200).send(challenge);
      } else {
        res.sendStatus(403);
      }
      return;
    }

    if (req.method !== 'POST') {
      res.sendStatus(405);
      return;
    }

    if (!verifySignature(req, WHATSAPP_APP_SECRET.value())) {
      console.warn('Rejected webhook POST: signature mismatch.');
      res.sendStatus(403);
      return;
    }

    try {
      const entry = req.body?.entry?.[0];
      const change = entry?.changes?.[0]?.value;
      const message = change?.messages?.[0];

      if (!message) {
        // Delivery/read receipts (change.statuses) and other non-message
        // webhook events land here -- nothing to do, just acknowledge.
        res.sendStatus(200);
        return;
      }

      if (message.type !== 'text') {
        res.sendStatus(200);
        return;
      }

      const fromPhone = message.from; // digits only, no "+", e.g. "9665XXXXXXXX"
      const text = message.text?.body || '';
      const sender = await lookupSender(db, fromPhone);

      const replyText = await handleMessage(db, sender, text, ANTHROPIC_API_KEY.value());

      await sendWhatsAppText(
        { accessToken: WHATSAPP_TOKEN.value(), phoneNumberId: WHATSAPP_PHONE_NUMBER_ID.value() },
        fromPhone,
        replyText,
      );

      res.sendStatus(200);
    } catch (err) {
      console.error('whatsappWebhook error:', err);
      // Still 200 -- a 5xx here makes Meta retry-deliver the same message,
      // which would just repeat whatever just failed. Log and move on;
      // retry/backoff/alerting hardening is a later step (see plan roadmap).
      res.sendStatus(200);
    }
  },
);
