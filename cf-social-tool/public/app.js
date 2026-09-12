async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

const REACTIONS = [
  { type: 'like', emoji: '👍' },
  { type: 'love', emoji: '❤️' },
  { type: 'haha', emoji: '😂' },
  { type: 'wow', emoji: '😮' },
];

function reactedKey(postId, type) {
  return `reacted:${postId}:${type}`;
}

async function react(postId, type, container) {
  if (localStorage.getItem(reactedKey(postId, type))) return;
  const counts = await fetchJSON('/api/react', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postId, type }),
  });
  localStorage.setItem(reactedKey(postId, type), '1');
  renderReactionCounts(container, postId, counts);
}

function renderReactionCounts(container, postId, counts) {
  const map = {};
  (counts || []).forEach((c) => (map[c.type] = c.count));
  container.innerHTML = REACTIONS.map(
    (r) => `
    <button class="reaction-btn ${localStorage.getItem(reactedKey(postId, r.type)) ? 'reacted' : ''}" data-type="${r.type}">
      ${r.emoji} <span>${map[r.type] || 0}</span>
    </button>
  `
  ).join('');
  container.querySelectorAll('.reaction-btn').forEach((btn) => {
    btn.addEventListener('click', () => react(postId, btn.dataset.type, container));
  });
}

async function loadComments(postId, container) {
  const comments = await fetchJSON(`/api/comments?postId=${postId}`);
  container.innerHTML =
    comments
      .map(
        (c) => `
    <div class="comment">
      <strong>${escapeHtml(c.author)}</strong>
      <span class="time">${timeAgo(c.created_at)}</span>
      <p>${escapeHtml(c.body)}</p>
    </div>
  `
      )
      .join('') || '<p class="muted">No comments yet. Be the first.</p>';
}

function shareLink(postId) {
  const url = `${location.origin}/post/${postId}`;
  if (navigator.share) {
    navigator.share({ url, title: 'Check this out' }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url);
    alert('Link copied: ' + url);
  }
}

function postCardHtml(post) {
  return `
    <article class="post-card" data-id="${post.id}">
      ${post.image_url ? `<img src="${post.image_url}" class="post-image" alt="">` : ''}
      <h2>${escapeHtml(post.title)}</h2>
      <p>${escapeHtml(post.body)}</p>
      <div class="reactions" id="reactions-${post.id}"></div>
      <div class="actions">
        <button class="comment-toggle">💬 Comment</button>
        <button class="share-btn">🔗 Share</button>
      </div>
      <div class="comments-section" style="display:none">
        <div class="comments-list"></div>
        <form class="comment-form">
          <input type="text" name="author" placeholder="Your name (optional)" maxlength="60">
          <textarea name="body" placeholder="Write a comment..." required maxlength="1000"></textarea>
          <button type="submit">Post comment</button>
        </form>
      </div>
    </article>
  `;
}

function wireCard(el, post) {
  renderReactionCounts(el.querySelector(`#reactions-${post.id}`), post.id, post.reactions || []);
  el.querySelector('.share-btn').addEventListener('click', () => shareLink(post.id));

  const toggle = el.querySelector('.comment-toggle');
  const section = el.querySelector('.comments-section');
  const list = el.querySelector('.comments-list');
  let loaded = false;

  toggle.addEventListener('click', async () => {
    section.style.display = section.style.display === 'none' ? 'block' : 'none';
    if (!loaded && section.style.display === 'block') {
      await loadComments(post.id, list);
      loaded = true;
    }
  });

  el.querySelector('.comment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const author = form.author.value.trim();
    const body = form.body.value.trim();
    if (!body) return;
    await fetchJSON('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: post.id, author, body }),
    });
    form.body.value = '';
    await loadComments(post.id, list);
  });
}

async function initHome() {
  const app = document.getElementById('app');
  app.innerHTML = '<p class="muted">Loading posts...</p>';
  const posts = await fetchJSON('/api/posts');
  app.innerHTML = posts.map(postCardHtml).join('') || '<p class="muted">No posts yet.</p>';
  posts.forEach((post) => wireCard(app.querySelector(`[data-id="${post.id}"]`), post));
}

async function initSinglePost(postId) {
  const app = document.getElementById('app');
  app.innerHTML = '<p class="muted">Loading...</p>';
  const post = await fetchJSON(`/api/posts/${postId}`);
  app.innerHTML = postCardHtml(post);
  wireCard(app.querySelector(`[data-id="${post.id}"]`), post);
}

const appEl = document.getElementById('app');
if (appEl.dataset.postId) {
  initSinglePost(appEl.dataset.postId);
} else {
  initHome();
}
