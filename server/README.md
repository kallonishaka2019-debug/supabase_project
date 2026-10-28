# JerseyHub backend

## Run locally

1. Open a terminal in `server/`.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set the Supabase variables. Use the publishable key for `SUPABASE_PUBLISHABLE_KEY` and the server-only secret key for `SUPABASE_SECRET_KEY`.
4. For a brand-new database, run `supabase/schema.sql`. For an existing database, run any applicable migrations: `supabase/migrate_products.sql`, `supabase/migrate_auth_security.sql`, and `supabase/migrate_monime_checkout.sql`. Then run `supabase/migrate_order_tracking.sql` for both new and existing databases. The server seeds the products table automatically on the next start when it is empty.
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
- `POST /api/orders` (guest or authenticated; guest orders receive a browser-stored access token)
- `GET /api/orders` (authenticated)
- `GET /api/guest/orders/:id` and `GET /api/guest/orders/:id/invoice` (guest order token required in `X-Order-Access-Token`)
- `GET /api/orders/:id` (authenticated owner; includes status history)
- `GET /api/orders/:id/invoice` (authenticated owner)
- `POST /api/orders/:id/share-links` and `DELETE /api/orders/:id/share-links/:shareId` (authenticated owner)
- `GET /api/invoice-share/:token` (time-limited public invoice summary only)
- `GET /api/orders/notifications` and `POST /api/orders/notifications/:id/read` (authenticated owner)
- `PATCH /api/admin/orders/:id` (admin only; validated status transition and optional delivery estimate)

The server stores order item snapshots and the editable product catalog in Supabase. The first server start after the products migration copies the bundled catalog into `public.products` if the table is empty.

## Supabase tables

The Supabase migration is in `../supabase/schema.sql`. In the Supabase Dashboard, open **SQL Editor**, paste that file, and run it.

It creates:

- `auth.users`: Supabase-managed login email, password hash, and sessions
- `public.profiles`: customer name and phone, linked to `auth.users`
- `public.orders`: checkout details, totals, payment plan, delivery, and item snapshots
- `public.order_status_history`: chronological status transitions and actor type
- `public.order_invoices`: unique invoice numbers assigned to orders
- `public.invoice_share_links`: revocable expiring links; only token hashes are stored
- `public.order_status_notifications`: deduplicated in-app status notifications
- `public.guest_order_access`: hashed, expiring browser access tokens for guest orders

The order-tracking migration restricts customer order reads to their own authenticated orders, including excluding guest checkouts. New history, invoice, notification, and share-link tables have RLS enabled without browser policies; the server accesses them with its server-only Supabase secret. Admin status changes and Monime confirmations use a database transition function that audits each change and inserts customer notifications idempotently. API writes reject cross-origin browser requests, and order/share endpoints are rate-limited by IP before authentication and by account after authentication.

After checkout returns, the storefront opens **My Orders**, highlights the just-placed order, and opens its invoice preview. Signed-in customers also receive an in-app order-placed notification. Guest orders can be viewed from the same browser using a random access token stored locally; the database stores only its hash, and the token expires after one year. The order-tracking migration must be applied for invoices, order history, notifications, and guest tracking to be available.

The customer **My Orders** drawer shows order items, history/timeline, delivery estimate, notifications, and invoice preview. **Print / Save PDF** opens the invoice in the browser print dialog; select “Save as PDF” to download a PDF without exposing order details to a third-party PDF service. Social sharing creates a random link that expires after 24 hours by default (up to 168 hours), can be revoked from the order card, and reveals only invoice summary data without customer details or address.

## Connect the site to Supabase

1. Run `../supabase/schema.sql` in the Supabase SQL Editor.
2. In Supabase, open **Project Settings -> API**.
3. In `jersey.html`, replace `SUPABASE_URL` with the Project URL and `SUPABASE_ANON_KEY` with the public anon key near the top of the script.
4. Serve the site through a web server, for example `npm start` from this `server/` folder, then open `http://localhost:3000/jersey.html`.

The publishable key identifies the public app; the secret key bypasses RLS and must remain server-only. Never put the secret key in HTML or browser JavaScript. Legacy `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` variables remain accepted while migrating existing deployments. When Supabase is configured, signup/login use Supabase Auth and **Place order** inserts checkout information into `public.orders` before opening WhatsApp.

New accounts must confirm their email before logging in. Configure the Supabase confirmation email template to use `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup`, and allow the deployed `/api/auth/confirm` callback URL. Public signups always receive the customer role. Grant admin access only to a trusted, confirmed account through Supabase SQL Editor; never use a public signup request to assign roles. Audit existing admin profiles when upgrading.
