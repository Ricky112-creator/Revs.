export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(`
    SELECT p.id, p.title, p.body, p.image_url, p.media_type, p.created_at,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
    FROM posts p
    ORDER BY p.created_at DESC
  `).all();

  for (const post of results) {
    const { results: reactions } = await env.DB.prepare(
      `SELECT type, count FROM reactions WHERE post_id = ?`
    ).bind(post.id).all();
    post.reactions = reactions;
  }

  return Response.json(results);
}

export async function onRequestPost({ request, env }) {
  const auth = request.headers.get('Authorization') || '';
  if (auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { title, body, image_url, media_type } = await request.json();
  if (!title || !body) {
    return new Response('Missing title or body', { status: 400 });
  }

  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  const safeMediaType = ['image', 'video', 'none'].includes(media_type) ? media_type : 'none';

  await env.DB.prepare(
    `INSERT INTO posts (id, title, body, image_url, media_type, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, title, body, image_url || null, safeMediaType, created_at).run();

  return Response.json({ id, title, body, image_url, media_type: safeMediaType, created_at, reactions: [], comment_count: 0 });
}
