-- Orders placed on client.com, tracked here for status + WhatsApp handoff.
-- No location data is ever stored: live location goes customer -> WhatsApp
-- -> whoever runs delivery, entirely outside this system. See README.
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  items TEXT NOT NULL,               -- JSON array: [{ "name": "...", "qty": 1, "price": 600 }]
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | out_for_delivery | delivered | cancelled
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email);

-- App-level backstop against brute-forcing order ID + email combos.
-- This is a floor, not the real fix -- put a Cloudflare rate-limiting rule
-- and/or Turnstile in front of /api/orders/lookup too (per the security
-- review, §5). IP-based throttling alone is bypassable with IP rotation.
CREATE TABLE IF NOT EXISTS lookup_attempts (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL
);

-- Lets an admin reply to a comment inline instead of only being able to
-- delete it.
ALTER TABLE comments ADD COLUMN admin_reply TEXT;
ALTER TABLE comments ADD COLUMN admin_reply_at TEXT;
