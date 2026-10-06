# JerseyHub SL Deployment Guide

## Option 1: Vercel (Recommended for Frontend + Backend)

### 1. Install Vercel CLI

```bash
npm i -g vercel
```

### 2. Deploy

```bash
cd jersey
npx vercel
```

### 3. Set Environment Variables in Vercel Dashboard

- `SUPABASE_URL`: https://YOUR-PROJECT-REF.supabase.co
- `SUPABASE_PUBLISHABLE_KEY`: Your Supabase publishable key
- `SUPABASE_SECRET_KEY`: Your Supabase secret key (never commit this)
- `MONIME_SECRET_KEY`: Your Monime secret key
- `MONIME_WEBHOOK_SECRET`: Secret used to verify Monime callbacks
- `MONIME_BASE_URL`: The actual Monime API base URL
- `APP_BASE_URL`: Your deployed HTTPS URL, such as `https://your-project.vercel.app`

---

## Option 2: Railway (Full Stack)

### 1. Create Railway Account

Go to [railway.app](https://railway.app)

### 2. Deploy

```bash
npm install -g railway
cd jersey
railway login
railway init
railway up
```

### 3. Set Environment Variables

Add these in Railway dashboard:

- `PORT`: 3000
- `NODE_ENV`: production
- `SUPABASE_URL`: https://YOUR-PROJECT-REF.supabase.co
- `SUPABASE_PUBLISHABLE_KEY`: Your Supabase publishable key
- `SUPABASE_SECRET_KEY`: Your Supabase secret key (never commit this)
- `MONIME_API_KEY`: Your Monime API key
- `MONIME_SECRET_KEY`: Your Monime secret key
- `MONIME_WEBHOOK_SECRET`: Secret used to verify Monime callbacks
- `MONIME_BASE_URL`: The actual Monime API base URL
- `APP_BASE_URL`: Your deployed HTTPS URL

---

## Option 3: Render

### 1. Create Web Service

- Connect GitHub repo
- Build command: `npm install`
- Start command: `cd server && npm start`

### 2. Environment Variables

Same as Railway above.

---

## Option 4: GitHub Pages (Frontend Only)

For static hosting without backend:

1. Create `index.html` that redirects to `jersey.html`
2. Or rename `jersey.html` to `index.html`
3. Upload to GitHub Pages

**Note:** User accounts and order storage won't work without a backend.

---

## Supabase Setup

1. Create project at [supabase.com](https://supabase.com)
2. For an existing database, run `supabase/migrate_products.sql` and `supabase/migrate_auth_security.sql` in the SQL Editor. For a brand-new database, run `supabase/schema.sql` instead.
3. Get API keys from Settings → API
4. Add credentials to your deployment environment

Set Supabase Auth's **Site URL** and allowed redirect URLs to your deployed HTTPS URL. Set the confirmation email template link to `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup` so it reaches the server's token-hash callback.

Public signups are always customers. To grant admin access, first create and confirm the trusted account, then run this query in the Supabase SQL Editor with its email:

```sql
update public.profiles p
set role = 'admin'
from auth.users u
where p.id = u.id
	and lower(u.email) = lower('trusted-admin@example.com');
```

Review existing `admin` profiles after applying the migration and remove any roles that were not intentionally granted.

After deployment, open the admin panel and use **Products** to edit availability, prices, images, and product details. The **Add Product** tab creates new catalog entries and the edit/delete actions update Supabase directly.

---

## Quick Test (Local)

```bash
cd jersey/server
npm install
npm run dev
# Open http://localhost:3000/jersey.html
```
