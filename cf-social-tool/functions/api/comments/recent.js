export async function onRequestGet({ request, env }) {
  const auth = request.headers.get('Authorization') || '';
  if (auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const since = url.searchParams.get('since'); // ISO timestamp, optional
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 50);

  let query = `
    SELECT c.id, c.post_id, c.author, c.body, c.created_at, p.title as post_title
    FROM comments c
    JOIN posts p ON p.id = c.post_id
  `;
  const binds = [];
  if (since) {
    query += ` WHERE c.created_at > ?`;
    binds.push(since);
  }
  query += ` ORDER BY c.created_at DESC LIMIT ?`;
  binds.push(limit);

  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return Response.json(results);
}
