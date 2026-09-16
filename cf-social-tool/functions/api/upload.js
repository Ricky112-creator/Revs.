const MAX_BYTES = 25 * 1024 * 1024; // 25MB — also Workers KV's per-value ceiling, not just a nice round number
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
];

export async function onRequestPost({ request, env }) {
  const auth = request.headers.get('Authorization') || '';
  if (auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return new Response('Invalid form data', { status: 400 });
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return new Response('No file provided', { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return new Response('File too large (25MB max)', { status: 413 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return new Response(`Unsupported file type: ${file.type}`, { status: 415 });
  }

  const extFromName = (file.name || '').split('.').pop();
  const ext = /^[a-z0-9]{2,5}$/i.test(extFromName) ? extFromName.toLowerCase() : file.type.split('/')[1] || 'bin';
  const key = `${crypto.randomUUID()}.${ext}`;

  const buffer = await file.arrayBuffer();
  await env.MEDIA.put(key, buffer, {
    metadata: { contentType: file.type },
  });

  return Response.json({
    url: `/media/${key}`,
    mediaType: file.type.startsWith('video/') ? 'video' : 'image',
  });
}
