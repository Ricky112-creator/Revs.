export async function onRequestGet({ env, params, request }) {
  const post = await env.DB.prepare(`SELECT * FROM posts WHERE id = ?`).bind(params.id).first();
  if (!post) return new Response('Post not found', { status: 404 });

  const url = new URL(request.url);
  const siteOrigin = `${url.protocol}//${url.host}`;
  const description = post.body.length > 160 ? post.body.slice(0, 157) + '...' : post.body;
  const isVideo = post.media_type === 'video' && post.image_url;
  const image = (!isVideo && post.image_url) || `${siteOrigin}/default-share-image.png`;
  const videoTags = isVideo
    ? `<meta property="og:video" content="${post.image_url}"><meta property="og:type" content="video.other">`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(post.title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:title" content="${escapeHtml(post.title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${image}">
<meta property="og:url" content="${siteOrigin}/post/${post.id}">
${videoTags || '<meta property="og:type" content="article">'}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(post.title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${image}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<header><a href="/" class="home-link">&larr; All posts</a></header>
<div id="app" data-post-id="${post.id}"></div>
<script src="/app.js"></script>
</body>
</html>`;

  return new Response(html, { headers: { 'content-type': 'text/html;charset=UTF-8' } });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
