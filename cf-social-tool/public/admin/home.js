function fmtMoney(n) {
  return (n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function isSameDay(iso, ref) {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

function daysAgo(iso, n) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - n);
  return new Date(iso) >= cutoff;
}

async function loadHome() {
  const el = document.getElementById('home-content');
  if (!el) return;
  el.innerHTML = '<p class="muted">Loading...</p>';

  const [ordersRes, postsRes] = await Promise.all([
    fetch('/api/orders', { headers: { Authorization: `Bearer ${getToken()}` } }),
    fetch('/api/posts'),
  ]);

  if (!ordersRes.ok) {
    el.innerHTML = `<p class="muted">Couldn't load dashboard data: ${escapeHtmlHome(await ordersRes.text())}</p>`;
    return;
  }

  const orders = await ordersRes.json();
  const posts = postsRes.ok ? await postsRes.json() : [];
  const today = new Date();

  const ordersToday = orders.filter((o) => isSameDay(o.created_at, today)).length;
  const revenueThisWeek = orders
    .filter((o) => daysAgo(o.created_at, 7) && o.status !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const outForDelivery = orders.filter((o) => o.status === 'out_for_delivery').length;
  const totalComments = posts.reduce((sum, p) => sum + (p.comment_count || 0), 0);

  el.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card">
        <p class="stat-label">Orders today</p>
        <p class="stat-value">${ordersToday}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Revenue this week</p>
        <p class="stat-value">${fmtMoney(revenueThisWeek)}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Out for delivery</p>
        <p class="stat-value">${outForDelivery}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Total comments</p>
        <p class="stat-value">${totalComments}</p>
      </div>
    </div>
    <div class="shortcut-row">
      <button class="secondary shortcut-btn" data-goto="orders"><i class="ti ti-map-pin"></i>View orders</button>
      <button class="secondary shortcut-btn" data-goto="newpost"><i class="ti ti-plus"></i>New post</button>
      <button class="secondary shortcut-btn" data-goto="published"><i class="ti ti-message-circle"></i>Moderate comments</button>
    </div>
  `;

  el.querySelectorAll('.shortcut-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelector(`.admin-tab[data-tab="${btn.dataset.goto}"]`).click();
    });
  });
}

function escapeHtmlHome(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

window.loadHome = loadHome;
