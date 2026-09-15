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

  const reply = body.admin_reply ? String(body.admin_reply).trim().slice(0, 1000) : null;
  const now = reply ? new Date().toISOString() : null;

  await env.DB.prepare(`UPDATE comments SET admin_reply = ?, admin_reply_at = ? WHERE id = ?`)
    .bind(reply, now, params.id)
    .run();

  return Response.json({ id: params.id, admin_reply: reply, admin_reply_at: now });
}

export async function onRequestDelete({ request, env, params }) {
  const auth = request.headers.get('Authorization') || '';
  if (auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  await env.DB.prepare(`DELETE FROM comments WHERE id = ?`).bind(params.id).run();
  return new Response('Deleted', { status: 200 });
}
