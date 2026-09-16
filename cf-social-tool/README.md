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

3. **Create the KV namespace for media uploads (photos and video):**
   ```
   npx wrangler kv namespace create MEDIA
   ```
   Copy the `id` it prints into `wrangler.toml` under `[[kv_namespaces]]`
   (see below). No third-party account, no signup, **no card required** —
   Workers KV is included free on the same plan you're already using for
   D1 and Pages. Limits: 1GB total storage, 1,000 writes/day, 25MB max per
   file. Fine for a small site's pace of posting; if you ever outgrow it,
   Cloudflare R2 is the natural next step, but it requires adding a card
   to your account even to use its free tier, so there's no rush.

   Add this to `wrangler.toml`, right after the `[[d1_databases]]` block:
   ```toml
   [[kv_namespaces]]
   binding = "MEDIA"
   id = "PASTE_THE_ID_FROM_THE_CREATE_COMMAND_HERE"
   ```

   The admin dashboard's photo/video picker uploads straight here through
   `/api/upload`, which is gated by `ADMIN_TOKEN` — unlike the old
   Cloudinary unsigned-preset setup, there's no way for someone outside the
   admin login to upload directly to your storage and burn through your
   quota.

4. **Set the WhatsApp business number in `wrangler.toml`:**
   Edit the `WHATSAPP_NUMBER` var — digits only, country code first, no `+`
   or spaces (e.g. `254700111222`). This is not a secret; it's the number
   customers' WhatsApp opens to.

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
- `/api/upload` accepts JPEG/PNG/WebP/GIF images and MP4/WebM/MOV video up to
  25MB, gated by `ADMIN_TOKEN`. There's no virus/content scanning on uploads —
  fine for a trusted single admin, worth revisiting if multiple people ever
  get admin access. Storage is Workers KV (1GB total, 1,000 writes/day) —
  fine to start, but if you're posting media heavily, watch usage in the
  Cloudflare dashboard and consider R2 once you're ready to add a card.
- Single-tenant: one Pages project + one D1 database per client. See the
  original security review for the multi-tenancy discussion if that changes.
