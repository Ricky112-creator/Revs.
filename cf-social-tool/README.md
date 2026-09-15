# Social post tool (Cloudflare Pages + D1)

Admin publishes posts from `/admin`. Anyone can react, comment, and share
from `/` — no login. Every post gets a public link at `/post/{id}` with
share-preview tags baked in.

Customers who order on client.com can look up their order and hand off
delivery coordination via WhatsApp at `/track`. Admin manages orders,
posts, and comment moderation from `/admin`.

## First-time setup

1. **Create the D1 database and apply all three migrations, in order:**
   ```
   wrangler d1 create social_posts_db
   # copy the printed database_id into wrangler.toml
   wrangler d1 execute social_posts_db --file=schema.sql
   wrangler d1 execute social_posts_db --file=migration_2.sql
   wrangler d1 execute social_posts_db --file=migration_3.sql
   ```
   `migration_3.sql` adds the `orders` table, the lookup rate-limit table,
   and comment reply columns — required for Orders and comment replies to
   work at all.

2. **Set the admin token as a secret (never in wrangler.toml, never committed):**
   ```
   wrangler pages secret put ADMIN_TOKEN
   ```
   When prompted, paste a long random value — e.g. generate one with:
   ```
   openssl rand -hex 20
   ```
   This is the only thing standing between the public internet and your
   write endpoints, so don't reuse a password from anywhere else.

3. **Set the WhatsApp business number in `wrangler.toml`:**
   Edit the `WHATSAPP_NUMBER` var — digits only, country code first, no `+`
   or spaces (e.g. `254700111222`). This is not a secret; it's the number
   customers' WhatsApp opens to.

4. **Configure Cloudinary** (unsigned upload preset) in the admin dashboard's
   one-time setup box — cloud name + preset name, stored in that browser's
   `localStorage`. Lock down file size/format limits on the preset itself in
   the Cloudinary dashboard; this code doesn't enforce any.

5. **Deploy:**
   ```
   wrangler pages deploy public
   ```

## How orders get in

This tool doesn't have a checkout form — orders are expected to come from
your existing checkout on client.com, which should `POST` to `/api/orders`
when a purchase completes:

```json
POST /api/orders
{
  "customer_name": "Amina W.",
  "customer_email": "amina@example.com",
  "customer_phone": "254700111222",
  "items": [{ "name": "Jollof rice", "qty": 1, "price": 600 }],
  "amount": 900
}
```

No auth on this endpoint — it's the public write path for a completed
purchase, not an admin action. After the order is created, redirect the
customer to:
```
https://yoursite.com/track?order={id}&email={their email}
```
so they land straight on their tracking page instead of typing the lookup
form manually.

## Location sharing — what this does and doesn't do

Customers share their live location with your delivery contact entirely
inside WhatsApp, using WhatsApp's own live-location feature. This system
never receives, stores, or displays coordinates — the "Share location on
WhatsApp" button just opens a chat with the order number pre-filled. If you
later want the admin dashboard to show a live map, that's a materially
different build (WhatsApp Business Platform webhook integration) with real
data-retention and access-control obligations — worth scoping separately.

## Known gaps carried from the security review

- `/api/orders/lookup` has an app-level rate limit (8 attempts / 15 min per
  IP) as a backstop, but IP-based throttling is bypassable with IP rotation.
  Add a Cloudflare rate-limiting rule and/or Turnstile in front of it before
  relying on this alone.
- No moderation queue for comments — they're public the instant they're
  posted. The admin dashboard can delete or reply after the fact, not before.
- One `ADMIN_TOKEN` for the whole deployment, no per-admin accounts.
- Single-tenant: one Pages project + one D1 database per client. See the
  original security review for the multi-tenancy discussion if that changes.
