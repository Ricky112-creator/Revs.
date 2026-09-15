// Public by design -- the WhatsApp business number isn't a secret, it's
// meant to be dialed. Keeping it in an env var instead of hardcoded in
// public/track.js means changing it doesn't require a code change.
export async function onRequestGet({ env }) {
  return Response.json({ whatsappNumber: env.WHATSAPP_NUMBER || '' });
}
