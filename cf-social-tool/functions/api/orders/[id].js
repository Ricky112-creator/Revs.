const VALID_STATUSES = ['pending', 'out_for_delivery', 'delivered', 'cancelled'];

export async function onRequestPatch({ request, env, params }) {
  const auth = request.headers.get('Authorization') || '';
  if (auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { status } = body;
  if (!VALID_STATUSES.includes(status)) {
    return new Response('Invalid status', { status: 400 });
  }

  const now = new Date().toISOString();
  await env.DB.prepare(`UPDATE orders SET status = ?, updated_at = ? WHERE id = ?`)
    .bind(status, now, params.id)
    .run();

  return Response.json({ id: params.id, status, updated_at: now });
}
