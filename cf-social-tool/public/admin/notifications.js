const NOTIF_POLL_MS = 30000;
let lastOrderCheck = localStorage.getItem('notif_last_order') || new Date().toISOString();
let lastCommentCheck = localStorage.getItem('notif_last_comment') || new Date().toISOString();
let unreadNotifs = [];

function escapeHtmlNotif(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function showBrowserNotification(title, body) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body });
  } catch (e) {
    console.error('Notification failed', e);
  }
}

function addNotification(item) {
  unreadNotifs.unshift(item);
  if (unreadNotifs.length > 20) unreadNotifs.pop();
  updateNotifBadge();
  showBrowserNotification(item.title, item.body);
}

function updateNotifBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (unreadNotifs.length === 0) {
    badge.style.display = 'none';
  } else {
    badge.style.display = 'flex';
    badge.textContent = unreadNotifs.length > 9 ? '9+' : String(unreadNotifs.length);
  }
}

function renderNotifDropdown() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  list.innerHTML = unreadNotifs.length
    ? unreadNotifs
        .map(
          (n) => `
        <div class="notif-item">
          <i class="ti ${n.icon}"></i>
          <div>
            <p class="notif-title">${escapeHtmlNotif(n.title)}</p>
            <p class="notif-body">${escapeHtmlNotif(n.body)}</p>
          </div>
        </div>
      `
        )
        .join('')
    : '<p class="muted" style="padding: 20px;">No new notifications.</p>';
}

async function pollOrderNotifs() {
  try {
    const res = await fetch('/api/orders', { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) return;
    const orders = await res.json();
    const fresh = orders.filter((o) => o.created_at > lastOrderCheck).sort((a, b) => a.created_at.localeCompare(b.created_at));
    fresh.forEach((o) => {
      addNotification({ icon: 'ti-map-pin', title: 'New order', body: `${o.customer_name} — ${o.amount}` });
      lastOrderCheck = o.created_at;
    });
    if (fresh.length) localStorage.setItem('notif_last_order', lastOrderCheck);
  } catch (e) {
    console.error(e);
  }
}

async function pollCommentNotifs() {
  try {
    const res = await fetch(`/api/comments/recent?since=${encodeURIComponent(lastCommentCheck)}&limit=20`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) return;
    const comments = await res.json();
    const fresh = [...comments].sort((a, b) => a.created_at.localeCompare(b.created_at));
    fresh.forEach((c) => {
      addNotification({
        icon: 'ti-message-circle',
        title: `New comment on "${c.post_title}"`,
        body: `${c.author}: ${c.body.slice(0, 80)}`,
      });
      lastCommentCheck = c.created_at;
    });
    if (fresh.length) localStorage.setItem('notif_last_comment', lastCommentCheck);
  } catch (e) {
    console.error(e);
  }
}

function pollAllNotifs() {
  pollOrderNotifs();
  pollCommentNotifs();
}

function initNotifications() {
  const enableBtn = document.getElementById('enable-notifs-btn');
  if (enableBtn) {
    if (typeof Notification === 'undefined' || Notification.permission === 'granted') {
      enableBtn.style.display = 'none';
    } else {
      enableBtn.addEventListener('click', async () => {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') enableBtn.style.display = 'none';
      });
    }
  }

  const bell = document.getElementById('notif-bell');
  const dropdown = document.getElementById('notif-dropdown');
  if (bell && dropdown) {
    bell.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.style.display !== 'none';
      if (isOpen) {
        dropdown.style.display = 'none';
      } else {
        renderNotifDropdown();
        dropdown.style.display = 'block';
        unreadNotifs = [];
        updateNotifBadge();
      }
    });
    document.addEventListener('click', (e) => {
      if (!bell.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  }

  pollAllNotifs();
  setInterval(pollAllNotifs, NOTIF_POLL_MS);
}

window.initNotifications = initNotifications;
