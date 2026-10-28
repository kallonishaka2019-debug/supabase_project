# JerseyHub backend

## Run locally

1. Open a terminal in `server/`.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set the Supabase variables. Use the publishable key for `SUPABASE_PUBLISHABLE_KEY` and the server-only secret key for `SUPABASE_SECRET_KEY`.
4. For an existing database, run `supabase/migrate_products.sql`, `supabase/migrate_auth_security.sql`, `supabase/migrate_monime_checkout.sql` and then `supabase/migrate_order_tracking.sql` in the Supabase SQL Editor. For a brand-new database, run `supabase/schema.sql` followed by `supabase/migrate_order_tracking.sql`. Run the migration **before** deploying this version of the server; it is safe to re-run. The server seeds the products table automatically on the next start when it is empty.
5. Run `npm start`.
6. Open `http://localhost:3000/jersey.html` or `http://localhost:3000/admin.html`.

The server creates `jerseyhub.sqlite` on first start. It serves the existing static page and assets, so browser cookies and the API use the same origin.

## API

- `POST /api/auth/register` with `{ name, email, password }`
- `POST /api/auth/login` with `{ email, password }`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/products`
- `POST /api/payments/create` with `{ orderId }` to create a Monime Checkout Session
- `GET /api/payments/return` verifies a returned Monime session before confirming its order
- `POST /api/admin/products` (admin only)
- `PATCH /api/admin/products/:id` (admin only)
- `DELETE /api/admin/products/:id` (admin only)
- `DELETE /api/admin/orders/:id` (admin only)
- `POST /api/orders` (authenticated)
- `GET /api/orders` (authenticated) returns the caller's orders with status history and invoice number
- `GET /api/orders/:id` (owner or admin)
- `GET /api/orders/:id/invoice` and `GET /api/orders/:id/invoice/pdf` (owner or admin) return the server-computed invoice / PDF download
- `POST /api/orders/:id/invoice/shares` with `{ expiresInHours }` (1 hour to 30 days, default 24) creates a tokenized share link; `GET` lists active links; `DELETE /api/orders/:id/invoice/shares[/:shareId]` revokes one or all
- `GET /api/invoices/shared/:token` and `/pdf` (public) return a redacted invoice (no phone, address or notes) while the link is active
- `GET /api/notifications` and `POST /api/notifications/read` with `{ ids }` (authenticated)
- `PATCH /api/admin/orders/:id` (admin only) with any of `{ status, note, estimatedDelivery, paymentStatus: "paid" | "refunded" }`
- `GET /api/admin/orders/:id/history` (admin only)

The server stores order item snapshots and the editable product catalog in Supabase. The first server start after the products migration copies the bundled catalog into `public.products` if the table is empty.

## Order tracking, invoices and sharing

`supabase/migrate_order_tracking.sql` adds payment/estimated-delivery columns to `orders`, plus `order_status_history`, `invoices`, `invoice_share_links` and `order_notifications`.

- **Statuses:** `pending → confirmed → processing → fulfilled → returned`, and `cancelled` from `pending`, `confirmed` or `processing`. A database trigger rejects any other transition for every writer (admin API, Monime webhook, return flow), and records each change in `order_status_history`. Admin notes are visible to the customer.
- **Invoices:** one invoice per order with a unique number (`INV-YYYY-NNNNNN`), created by a trigger when the order is inserted. Line items, totals and payment state are always computed on the server from the stored order. Fully paid orders render as a **receipt**; otherwise as an **invoice** with the balance due. The page is `invoice.html?order=<id>` (preview, print, PDF download, share).
- **Sharing:** share links are 256-bit random tokens placed in the URL fragment (`invoice.html#share=<token>`); only their SHA-256 hash is stored, and they expire (max 30 days) or can be revoked. Public responses omit contact details, address, notes and payment identifiers.
- **Notifications:** database triggers create one `order_notifications` row per order for "confirmed" and "processing" (unique per order and event, so repeated updates never duplicate). The storefront shows unread ones through its existing toast notifications and marks them read.
- **Admin:** `admin.html` lets admins change status (only valid next statuses are offered), add notes, set the estimated delivery date and mark payment received.
- **Access:** RLS limits customers to their own orders/history/invoices/notifications; guest orders are no longer readable through the public API key and direct client inserts into `orders` are removed (the API inserts with the secret key). `admin_update_order()` is executable only by the service role.

Optional environment variables for invoices: `STORE_NAME`, `STORE_ADDRESS`, `STORE_PHONE`, `STORE_EMAIL`. Set `APP_BASE_URL` to the public site URL so share links point to the right host. Run tests with `npm test` in `server/`.

## Supabase tables

The Supabase migration is in `../supabase/schema.sql`. In the Supabase Dashboard, open **SQL Editor**, paste that file, and run it.

It creates:

- `auth.users`: Supabase-managed login email, password hash, and sessions
- `public.profiles`: customer name and phone, linked to `auth.users`
- `public.orders`: checkout details, totals, payment plan, delivery, and item snapshots

Row Level Security lets customers read and create only their own profile and orders. The API requires Supabase configuration for authentication and orders.

## Connect the site to Supabase

1. Run `../supabase/schema.sql` in the Supabase SQL Editor.
2. In Supabase, open **Project Settings -> API**.
3. In `jersey.html`, replace `SUPABASE_URL` with the Project URL and `SUPABASE_ANON_KEY` with the public anon key near the top of the script.
4. Serve the site through a web server, for example `npm start` from this `server/` folder, then open `http://localhost:3000/jersey.html`.

The publishable key identifies the public app; the secret key bypasses RLS and must remain server-only. Never put the secret key in HTML or browser JavaScript. Legacy `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` variables remain accepted while migrating existing deployments. When Supabase is configured, signup/login use Supabase Auth and **Place order** inserts checkout information into `public.orders` before opening WhatsApp.

New accounts must confirm their email before logging in. Configure the Supabase confirmation email template to use `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup`, and allow the deployed `/api/auth/confirm` callback URL. Public signups always receive the customer role. Grant admin access only to a trusted, confirmed account through Supabase SQL Editor; never use a public signup request to assign roles. Audit existing admin profiles when upgrading.
