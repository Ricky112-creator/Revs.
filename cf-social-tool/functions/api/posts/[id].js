export async function onRequestGet({ env, params }) {
  const post = await env.DB.prepare(`SELECT * FROM posts WHERE id = ?`).bind(params.id).first();
  if (!post) return new Response('Not found', { status: 404 });

  const { results: reactions } = await env.DB.prepare(
    `SELECT type, count FROM reactions WHERE post_id = ?`
  ).bind(params.id).all();

  return Response.json({ ...post, reactions });
}

export async function onRequestDelete({ request, env, params }) {
  const auth = request.headers.get('Authorization') || '';
  if (auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  await env.DB.prepare(`DELETE FROM posts WHERE id = ?`).bind(params.id).run();
  await env.DB.prepare(`DELETE FROM comments WHERE post_id = ?`).bind(params.id).run();
  await env.DB.prepare(`DELETE FROM reactions WHERE post_id = ?`).bind(params.id).run();

  return new Response('Deleted', { status: 200 });
}
