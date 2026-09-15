const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 8;

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { orderId, email } = body;
  if (!orderId || !email) {
    return new Response('Order ID and email are both required', { status: 400 });
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  if (await isThrottled(env, ip)) {
    return new Response('Too many attempts. Try again later.', { status: 429 });
  }
  await recordAttempt(env, ip);

  const order = await env.DB.prepare(`
    SELECT id, customer_name, items, amount, status, created_at
    FROM orders WHERE id = ? AND customer_email = ?
  `).bind(String(orderId).trim(), String(email).trim().toLowerCase()).first();

  if (!order) {
    // Deliberately generic -- never say "wrong email" vs "wrong order ID",
    // or this endpoint becomes a tool for confirming someone's email is a
    // customer, or for brute-forcing which order ID belongs to a known email.
    return new Response('No matching order found', { status: 404 });
  }

  let items = [];
  try {
    items = JSON.parse(order.items);
  } catch {
    items = [];
  }

  return Response.json({ ...order, items });
}

async function isThrottled(env, ip) {
  const row = await env.DB.prepare(
    `SELECT count, window_start FROM lookup_attempts WHERE key = ?`
  ).bind(ip).first();
  if (!row) return false;
  if (Date.now() - new Date(row.window_start).getTime() > WINDOW_MS) return false;
  return row.count >= MAX_ATTEMPTS;
}

async function recordAttempt(env, ip) {
  const row = await env.DB.prepare(
    `SELECT count, window_start FROM lookup_attempts WHERE key = ?`
  ).bind(ip).first();
  const now = new Date().toISOString();

  if (!row || Date.now() - new Date(row.window_start).getTime() > WINDOW_MS) {
    await env.DB.prepare(`
      INSERT INTO lookup_attempts (key, count, window_start) VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET count = 1, window_start = ?
    `).bind(ip, now, now).run();
  } else {
    await env.DB.prepare(`UPDATE lookup_attempts SET count = count + 1 WHERE key = ?`)
      .bind(ip).run();
  }
}
