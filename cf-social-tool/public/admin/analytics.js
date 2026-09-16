function fmtMoneyA(n) {
  return (n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function dayLabel(date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function bucketRevenue(orders, days) {
  const buckets = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.push({ date: d, revenue: 0, count: 0 });
  }

  orders.forEach((o) => {
    if (o.status === 'cancelled') return;
    const od = new Date(o.created_at);
    od.setHours(0, 0, 0, 0);
    const bucket = buckets.find((b) => b.date.getTime() === od.getTime());
    if (bucket) {
      bucket.revenue += Number(o.amount || 0);
      bucket.count += 1;
    }
  });

  return buckets;
}

function chartHtml(buckets) {
  const max = Math.max(1, ...buckets.map((b) => b.revenue));
  const showLabels = buckets.length <= 14;

  const bars = buckets
    .map((b) => {
      const heightPct = Math.round((b.revenue / max) * 100);
      return `
      <div class="bar-col" title="${dayLabel(b.date)}: ${fmtMoneyA(b.revenue)} (${b.count} order${b.count === 1 ? '' : 's'})">
        <div class="bar" style="height: ${Math.max(heightPct, b.revenue > 0 ? 4 : 0)}%;"></div>
        ${showLabels ? `<span class="bar-label">${b.date.getDate()}</span>` : ''}
      </div>
    `;
    })
    .join('');

  return `
    <div class="chart-wrap">
      <div class="chart-bars">${bars}</div>
    </div>
    ${
      !showLabels
        ? `<div class="chart-range-labels"><span>${dayLabel(buckets[0].date)}</span><span>${dayLabel(buckets[buckets.length - 1].date)}</span></div>`
        : ''
    }
  `;
}

async function renderAnalytics(days) {
  const el = document.getElementById('analytics-content');
  const res = await fetch('/api/orders', { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) {
    el.innerHTML = `<p class="muted">Couldn't load analytics: ${await res.text()}</p>`;
    return;
  }
  const orders = await res.json();
  const buckets = bucketRevenue(orders, days);

  const totalRevenue = buckets.reduce((s, b) => s + b.revenue, 0);
  const totalOrders = buckets.reduce((s, b) => s + b.count, 0);
  const avgOrder = totalOrders ? totalRevenue / totalOrders : 0;

  el.innerHTML = `
    <div class="range-toggle">
      <button class="range-btn ${days === 7 ? 'active' : ''}" data-days="7">7d</button>
      <button class="range-btn ${days === 30 ? 'active' : ''}" data-days="30">30d</button>
      <button class="range-btn ${days === 90 ? 'active' : ''}" data-days="90">90d</button>
    </div>
    ${chartHtml(buckets)}
    <div class="stat-grid" style="margin-top: 18px;">
      <div class="stat-card">
        <p class="stat-label">Revenue</p>
        <p class="stat-value">${fmtMoneyA(totalRevenue)}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Orders</p>
        <p class="stat-value">${totalOrders}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Avg. order</p>
        <p class="stat-value">${fmtMoneyA(avgOrder)}</p>
      </div>
    </div>
  `;

  el.querySelectorAll('.range-btn').forEach((btn) => {
    btn.addEventListener('click', () => renderAnalytics(Number(btn.dataset.days)));
  });
}

function loadAnalytics() {
  const el = document.getElementById('analytics-content');
  if (!el) return;
  el.innerHTML = '<p class="muted">Loading...</p>';
  renderAnalytics(7);
}

window.loadAnalytics = loadAnalytics;
