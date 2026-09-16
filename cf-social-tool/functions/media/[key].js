export async function onRequestGet({ env, params }) {
  const { value, metadata } = await env.MEDIA.getWithMetadata(params.key, 'arrayBuffer');
  if (!value) {
    return new Response('Not found', { status: 404 });
  }

  const headers = new Headers();
  headers.set('Content-Type', (metadata && metadata.contentType) || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(value, { headers });
}
