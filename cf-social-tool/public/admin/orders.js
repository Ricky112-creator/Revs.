const ORDER_STATUSES = ['pending', 'out_for_delivery', 'delivered', 'cancelled'];
const ORDER_STATUS_LABELS = {
  pending: 'Pending',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function escapeHtmlOrders(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function statusOptionsHtml(current) {
  return ORDER_STATUSES.map(
    (s) => `<option value="${s}" ${s === current ? 'selected' : ''}>${ORDER_STATUS_LABELS[s]}</option>`
  ).join('');
}

function orderRowHtml(o) {
  const itemsSummary = (o.items || [])
    .map((i) => `${i.qty ? i.qty + 'x ' : ''}${i.name}`)
    .join(', ');
  const waLink = `https://wa.me/${(o.customer_phone || '').replace(/[^\d]/g, '')}`;

  return `
    <div class="order-row" data-order-id="${o.id}">
      <div class="post-row-main">
        <div>
          <strong>#${escapeHtmlOrders(o.id.slice(0, 8))}</strong> — ${escapeHtmlOrders(o.customer_name)}<br>
          <span class="muted">${escapeHtmlOrders(itemsSummary)} · ${escapeHtmlOrders(o.amount)}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <select class="order-status" data-id="${o.id}">${statusOptionsHtml(o.status)}</select>
          <a class="secondary whatsapp-link" href="${waLink}" target="_blank" rel="noopener">WhatsApp</a>
        </div>
      </div>
    </div>
  `;
}

async function loadOrders() {
  const list = document.getElementById('orders-list');
  if (!list) return;
  list.innerHTML = '<p class="muted">Loading orders...</p>';

  const res = await fetch('/api/orders', {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    list.innerHTML = `<p class="muted">Failed to load orders: ${escapeHtmlOrders(await res.text())}</p>`;
    return;
  }
  const orders = await res.json();
  list.innerHTML = orders.map(orderRowHtml).join('') || '<p class="muted">No orders yet.</p>';

  list.querySelectorAll('.order-status').forEach((select) => {
    select.addEventListener('change', async () => {
      const res = await fetch(`/api/orders/${select.dataset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ status: select.value }),
      });
      if (!res.ok) {
        alert('Failed to update status: ' + (await res.text()));
      }
    });
  });
}

window.loadOrders = loadOrders;
