async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(text || res.statusText);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

const STATUS_LABELS = {
  pending: 'Pending',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function formHtml() {
  return `
    <div class="track-card">
      <h1>Track your order</h1>
      <p class="muted">Enter your order ID and the email you used at checkout.</p>
      <label>Order ID</label>
      <input type="text" id="order-id" placeholder="e.g. f03e">
      <label>Email</label>
      <input type="email" id="order-email" placeholder="name@example.com">
      <p id="lookup-error" class="error" style="display:none;"></p>
      <button class="primary" id="lookup-btn">Find my order</button>
    </div>
  `;
}

function orderHtml(order, whatsappNumber) {
  const itemLines = (order.items || [])
    .map((i) => {
      const qty = i.qty ? `${escapeHtml(String(i.qty))}x ` : '';
      const price = i.price != null ? escapeHtml(String(i.price)) : '';
      return `<div class="order-line"><span>${qty}${escapeHtml(i.name || '')}</span><span>${price}</span></div>`;
    })
    .join('');

  const waText = encodeURIComponent(`Hi, this is order #${order.id}, sharing my location for delivery`);
  const waLink = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${waText}` : null;

  return `
    <div class="track-card">
      <p class="muted">Order #${escapeHtml(order.id)}</p>
      <h1>${escapeHtml(STATUS_LABELS[order.status] || order.status)}</h1>
      <div class="order-summary">
        ${itemLines}
        <div class="order-line total"><span>Total</span><span>${escapeHtml(String(order.amount))}</span></div>
      </div>
      ${
        waLink && order.status !== 'delivered' && order.status !== 'cancelled'
          ? `
        <p class="muted">Help your rider find you — share your live location on WhatsApp.</p>
        <a class="whatsapp-btn" href="${waLink}" target="_blank" rel="noopener">Share location on WhatsApp</a>
        <div class="info-note">This opens WhatsApp. Tap the attachment icon, choose location, then share live location so we can find you.</div>
      `
          : ''
      }
      <button class="secondary" id="track-another" style="margin-top:12px;">Track another order</button>
    </div>
  `;
}

async function loadWhatsappNumber() {
  try {
    const cfg = await fetchJSON('/api/config');
    return cfg.whatsappNumber;
  } catch {
    return '';
  }
}

function wireForm() {
  document.getElementById('lookup-btn').addEventListener('click', () => {
    doLookup(
      document.getElementById('order-id').value.trim(),
      document.getElementById('order-email').value.trim()
    );
  });
}

function renderForm() {
  document.getElementById('app').innerHTML = formHtml();
  wireForm();
}

async function doLookup(orderId, email) {
  const errEl = document.getElementById('lookup-error');
  if (!orderId || !email) {
    errEl.textContent = 'Enter both your order ID and email.';
    errEl.style.display = 'block';
    return;
  }

  errEl.style.display = 'none';
  const btn = document.getElementById('lookup-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Looking up...';
  }

  try {
    const order = await fetchJSON('/api/orders/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, email }),
    });
    const whatsappNumber = await loadWhatsappNumber();
    document.getElementById('app').innerHTML = orderHtml(order, whatsappNumber);
    document.getElementById('track-another').addEventListener('click', renderForm);
  } catch (err) {
    renderForm();
    const msg =
      err.status === 429
        ? 'Too many attempts. Please try again in a few minutes.'
        : 'No matching order found. Check your order ID and email.';
    document.getElementById('order-id').value = orderId;
    document.getElementById('order-email').value = email;
    const e = document.getElementById('lookup-error');
    e.textContent = msg;
    e.style.display = 'block';
  }
}

const params = new URLSearchParams(location.search);
if (params.get('order') && params.get('email')) {
  document.getElementById('app').innerHTML = formHtml();
  wireForm();
  doLookup(params.get('order'), params.get('email'));
} else {
  renderForm();
}
