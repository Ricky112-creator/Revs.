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

function myReactionKey(postId) {
  return `myreaction:${postId}`;
}

async function react(postId, type, container) {
  const current = localStorage.getItem(myReactionKey(postId));

  if (current === type) {
    // Clicking the same reaction again removes it
    const counts = await fetchJSON('/api/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, type, action: 'remove' }),
    });
    localStorage.removeItem(myReactionKey(postId));
    renderReactionCounts(container, postId, counts);
    return;
  }

  if (current) {
    // Remove old reaction first
    await fetchJSON('/api/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, type: current, action: 'remove' }),
    });
  }

  const counts = await fetchJSON('/api/react', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postId, type, action: 'add' }),
  });
  localStorage.setItem(myReactionKey(postId), type);
  renderReactionCounts(container, postId, counts);
}

function renderReactionCounts(container, postId, counts) {
  const map = {};
  (counts || []).forEach((c) => (map[c.type] = c.count));
  const mine = localStorage.getItem(myReactionKey(postId));
  container.innerHTML = REACTIONS.map(
    (r) => `
    <button class="reaction-btn ${mine === r.type ? 'reacted' : ''}" data-type="${r.type}">
      ${r.emoji} <span>${map[r.type] || 0}</span>
    </button>
  `
  ).join('');
  container.querySelectorAll('.reaction-btn').forEach((btn) => {
    btn.addEventListener('click', () => react(postId, btn.dataset.type, container));
  });
}

function commentHtml(c) {
  const reply = c.admin_reply
    ? `<div class="admin-reply"><strong>Reply from admin</strong><p>${escapeHtml(c.admin_reply)}</p></div>`
    : '';
  return `
    <div class="comment">
      <strong>${escapeHtml(c.author)}</strong>
      <span class="time">${timeAgo(c.created_at)}</span>
      <p>${escapeHtml(c.body)}</p>
      ${reply}
    </div>
  `;
}

async function loadCommentsPreview(postId, listEl, viewAllEl) {
  const comments = await fetchJSON(`/api/comments?postId=${postId}`);
  const preview = comments.slice(-2);
  listEl.innerHTML = preview.map(commentHtml).join('') || '<p class="muted">No comments yet. Be the first.</p>';

  if (comments.length > preview.length) {
    viewAllEl.style.display = 'block';
    viewAllEl.textContent = `View all ${comments.length} comments`;
    viewAllEl.onclick = () => {
      listEl.innerHTML = comments.map(commentHtml).join('');
      viewAllEl.style.display = 'none';
    };
  } else {
    viewAllEl.style.display = 'none';
  }
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

function mediaHtml(post) {
  // image_url is escaped here even though it currently only ever comes from
  // the admin's own Cloudinary upload — the moment any user-submitted URL
  // reaches this field (comments, orders, etc.), an unescaped attribute
  // becomes a stored-XSS path straight to the admin token in localStorage.
  if (post.media_type === 'video' && post.image_url) {
    return `<video src="${escapeHtml(post.image_url)}" class="post-media" controls playsinline></video>`;
  }
  if (post.image_url) {
    return `<img src="${escapeHtml(post.image_url)}" class="post-media" alt="">`;
  }
  return '';
}

function postCardHtml(post) {
  return `
    <article class="post-card" data-id="${post.id}">
      ${mediaHtml(post)}
      <h2>${escapeHtml(post.title)}</h2>
      <p>${escapeHtml(post.body)}</p>
      <div class="reactions" id="reactions-${post.id}"></div>
      <div class="actions">
        <button class="share-btn">🔗 Share</button>
      </div>
      <div class="comments-section">
        <div class="comments-list"></div>
        <a class="view-all-comments" style="display:none"></a>
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

  const list = el.querySelector('.comments-list');
  const viewAll = el.querySelector('.view-all-comments');
  loadCommentsPreview(post.id, list, viewAll);

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
    await loadCommentsPreview(post.id, list, viewAll);
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
