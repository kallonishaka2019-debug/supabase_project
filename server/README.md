# JerseyHub backend

## Run locally

1. Open a terminal in `server/`.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set the Supabase variables.
4. Run `supabase/migrate_products.sql` in the Supabase SQL Editor if the database already exists. For a brand-new database, run `supabase/schema.sql`. The server seeds the products table automatically on the next start when it is empty.
5. Run `npm start`.
6. Open `http://localhost:3000/jersey.html` or `http://localhost:3000/admin.html`.

The server creates `jerseyhub.sqlite` on first start. It serves the existing static page and assets, so browser cookies and the API use the same origin.

## API

- `POST /api/auth/register` with `{ name, email, password }`
- `POST /api/auth/login` with `{ email, password }`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/products`
- `POST /api/admin/products` (admin only)
- `PATCH /api/admin/products/:id` (admin only)
- `DELETE /api/admin/products/:id` (admin only)
- `POST /api/orders` (authenticated)
- `GET /api/orders` (authenticated)

The server stores order item snapshots and the editable product catalog in Supabase. The first server start after the products migration copies the bundled catalog into `public.products` if the table is empty.

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

The anon key is intended for browser use. Do not put a Supabase service-role key in the HTML. When Supabase is configured, signup/login use Supabase Auth and **Place order** inserts checkout information into `public.orders` before opening WhatsApp.
