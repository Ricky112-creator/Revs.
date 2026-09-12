function getToken() {
  return localStorage.getItem('admin_token') || '';
}

async function checkToken(token) {
  const res = await fetch('/api/admin/verify', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

async function tryUnlock(token) {
  const ok = await checkToken(token);
  if (ok) {
    localStorage.setItem('admin_token', token);
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    loadPosts();
  } else {
    localStorage.removeItem('admin_token');
    document.getElementById('login-error').style.display = 'block';
  }
}

document.getElementById('login-btn').addEventListener('click', () => {
  const val = document.getElementById('admin-token').value.trim();
  if (val) tryUnlock(val);
});

document.getElementById('admin-token').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('login-btn').click();
});

// Auto-unlock if a valid token is already saved in this browser
const savedToken = getToken();
if (savedToken) {
  checkToken(savedToken).then((ok) => {
    if (ok) {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('dashboard').style.display = 'block';
      loadPosts();
    }
  });
}

async function loadPosts() {
  const res = await fetch('/api/posts');
  const posts = await res.json();
  const list = document.getElementById('post-list');
  list.innerHTML =
    posts
      .map(
        (p) => `
    <div class="post-row">
      <div>
        <strong>${p.title}</strong><br>
        <a href="/post/${p.id}" target="_blank">/post/${p.id}</a>
      </div>
      <button data-id="${p.id}" class="delete-btn">Delete</button>
    </div>
  `
      )
      .join('') || '<p>No posts yet.</p>';

  list.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this post?')) return;
      const res = await fetch(`/api/posts/${btn.dataset.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        alert('Failed to delete: ' + (await res.text()));
        return;
      }
      loadPosts();
    });
  });
}

document.getElementById('post-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const body = {
    title: form.title.value.trim(),
    body: form.body.value.trim(),
    image_url: form.image_url.value.trim(),
  };
  const res = await fetch('/api/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    alert('Failed: ' + (await res.text()));
    return;
  }
  form.reset();
  loadPosts();
});
