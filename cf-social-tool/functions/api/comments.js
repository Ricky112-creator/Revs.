export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const postId = url.searchParams.get('postId');
  if (!postId) return new Response('Missing postId', { status: 400 });

  const { results } = await env.DB.prepare(
    `SELECT id, author, body, created_at, admin_reply, admin_reply_at FROM comments WHERE post_id = ? ORDER BY created_at ASC`
  ).bind(postId).all();

  return Response.json(results);
}

export async function onRequestPost({ request, env }) {
  const { postId, author, body } = await request.json();
  if (!postId || !body || body.trim().length === 0) {
    return new Response('Missing fields', { status: 400 });
  }

  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  const safeAuthor = (author || 'Anonymous').slice(0, 60);
  const safeBody = body.slice(0, 1000);

  await env.DB.prepare(
    `INSERT INTO comments (id, post_id, author, body, created_at) VALUES (?, ?, ?, ?, ?)`
  ).bind(id, postId, safeAuthor, safeBody, created_at).run();

  return Response.json({ id, author: safeAuthor, body: safeBody, created_at });
}
