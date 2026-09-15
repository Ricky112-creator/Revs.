export async function onRequestGet({ request, env }) {
  const auth = request.headers.get('Authorization') || '';
  if (auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { results } = await env.DB.prepare(`
    SELECT id, customer_name, customer_email, customer_phone, items, amount, status, created_at, updated_at
    FROM orders ORDER BY created_at DESC
  `).all();

  return Response.json(results.map(parseItems));
}

// Public: called by client.com's checkout flow when an order is placed.
// This endpoint has no admin-token gate by design -- it's the write path
// for customers completing a purchase, not an admin action.
export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { customer_name, customer_email, customer_phone, items, amount } = body;

  if (!customer_name || !customer_email || !customer_phone) {
    return new Response('Missing customer details', { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return new Response('Order must include at least one item', { status: 400 });
  }
  if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
    return new Response('Invalid amount', { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const safeName = String(customer_name).slice(0, 100);
  const safeEmail = String(customer_email).trim().toLowerCase().slice(0, 200);
  const safePhone = String(customer_phone).slice(0, 30);
  const safeItems = JSON.stringify(items).slice(0, 5000);

  await env.DB.prepare(`
    INSERT INTO orders (id, customer_name, customer_email, customer_phone, items, amount, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).bind(id, safeName, safeEmail, safePhone, safeItems, amount, now, now).run();

  return Response.json({ id, status: 'pending', created_at: now });
}

function parseItems(row) {
  let items = [];
  try {
    items = JSON.parse(row.items);
  } catch {
    items = [];
  }
  return { ...row, items };
}
