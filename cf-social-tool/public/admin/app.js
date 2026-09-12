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

function unlockUI() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  loadPosts();
}

async function tryUnlock(token) {
  const ok = await checkToken(token);
  if (ok) {
    localStorage.setItem('admin_token', token);
    unlockUI();
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

const savedToken = getToken();
if (savedToken) {
  checkToken(savedToken).then((ok) => { if (ok) unlockUI(); });
}

// ---- Cloudinary setup (stored locally in this browser) ----
function getCloudinaryConfig() {
  return {
    cloudName: localStorage.getItem('cloudinary_cloud_name') || '',
    uploadPreset: localStorage.getItem('cloudinary_upload_preset') || '',
  };
}
const cfg = getCloudinaryConfig();
document.getElementById('cloud-name').value = cfg.cloudName;
document.getElementById('upload-preset').value = cfg.uploadPreset;

document.getElementById('save-cloudinary').addEventListener('click', () => {
  localStorage.setItem('cloudinary_cloud_name', document.getElementById('cloud-name').value.trim());
  localStorage.setItem('cloudinary_upload_preset', document.getElementById('upload-preset').value.trim());
  alert('Cloudinary settings saved in this browser.');
});

// ---- Media upload ----
document.getElementById('media-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const status = document.getElementById('upload-status');
  if (!file) return;

  const { cloudName, uploadPreset } = getCloudinaryConfig();
  if (!cloudName || !uploadPreset) {
    status.textContent = 'Set up your Cloudinary cloud name and upload preset above first.';
    e.target.value = '';
    return;
  }

  status.textContent = 'Uploading...';
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    document.getElementById('media-url').value = data.secure_url;
    document.getElementById('media-type').value = data.resource_type === 'video' ? 'video' : 'image';
    status.textContent = 'Uploaded ✓';
  } catch (err) {
    status.textContent = 'Upload failed. Check your Cloudinary settings.';
    console.error(err);
  }
});

// ---- Preview before publish ----
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function mediaPreviewHtml(url, type) {
  if (!url) return '';
  if (type === 'video') return `<video src="${url}" style="width:100%;border-radius:8px;margin-bottom:12px;" controls></video>`;
  return `<img src="${url}" style="width:100%;border-radius:8px;margin-bottom:12px;">`;
}

let draftPost = null;

document.getElementById('post-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  draftPost = {
    title: form.title.value.trim(),
    body: form.body.value.trim(),
    image_url: document.getElementById('media-url').value || null,
    media_type: document.getElementById('media-type').value,
  };

  document.getElementById('preview-card').innerHTML = `
    <div style="border:1px solid #eee; border-radius:12px; padding:16px;">
      ${mediaPreviewHtml(draftPost.image_url, draftPost.media_type)}
      <h2 style="margin:0 0 8px;">${escapeHtml(draftPost.title)}</h2>
      <p style="white-space:pre-wrap;">${escapeHtml(draftPost.body)}</p>
    </div>
  `;
  form.style.display = 'none';
  document.getElementById('preview-wrap').style.display = 'block';
});

document.getElementById('edit-btn').addEventListener('click', () => {
  document.getElementById('preview-wrap').style.display = 'none';
  document.getElementById('post-form').style.display = 'block';
});

document.getElementById('confirm-publish-btn').addEventListener('click', async () => {
  if (!draftPost) return;
  const res = await fetch('/api/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(draftPost),
  });
  if (!res.ok) {
    alert('Failed: ' + (await res.text()));
    return;
  }
  draftPost = null;
  document.getElementById('post-form').reset();
  document.getElementById('media-url').value = '';
  document.getElementById('media-type').value = 'none';
  document.getElementById('upload-status').textContent = '';
  document.getElementById('preview-wrap').style.display = 'none';
  document.getElementById('post-form').style.display = 'block';
  loadPosts();
});

// ---- Existing posts list ----
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
        <strong>${escapeHtml(p.title)}</strong><br>
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
