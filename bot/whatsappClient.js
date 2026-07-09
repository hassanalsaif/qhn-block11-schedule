// whatsappClient.js — thin wrapper over the Meta WhatsApp Cloud API's
// send-message endpoint. See index.js for the inbound webhook side.
//
// Uses Node 20's built-in global fetch (no extra HTTP dependency needed).

const GRAPH_API_VERSION = 'v21.0';

/**
 * @param {{accessToken: string, phoneNumberId: string}} config
 * @param {string} to - recipient phone number, digits only (no "+")
 * @param {string} body - message text
 */
async function sendWhatsAppText({ accessToken, phoneNumberId }, to, body) {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`WhatsApp send failed (${resp.status}): ${text}`);
  }
  return resp.json();
}

module.exports = { sendWhatsAppText };
