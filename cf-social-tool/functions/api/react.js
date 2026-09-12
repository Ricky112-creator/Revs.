const VALID_TYPES = ['like', 'love', 'haha', 'wow'];

export async function onRequestPost({ request, env }) {
  const { postId, type } = await request.json();
  if (!postId || !VALID_TYPES.includes(type)) {
    return new Response('Invalid request', { status: 400 });
  }

  await env.DB.prepare(`
    INSERT INTO reactions (post_id, type, count) VALUES (?, ?, 1)
    ON CONFLICT(post_id, type) DO UPDATE SET count = count + 1
  `).bind(postId, type).run();

  const { results } = await env.DB.prepare(
    `SELECT type, count FROM reactions WHERE post_id = ?`
  ).bind(postId).all();

  return Response.json(results);
}
