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

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service-role key; keep this server-side only
- `ADMIN_EMAIL`: Email address that should receive admin access
- `MONIME_API_KEY`: Your Monime API key
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
- `SUPABASE_URL`: Your Supabase URL
- `SUPABASE_ANON_KEY`: Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service-role key
- `ADMIN_EMAIL`: Email address that should receive admin access
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
2. For an existing database, go to SQL Editor and run `supabase/migrate_products.sql`. It modifies the current database without dropping or recreating existing tables. For a brand-new database, run `supabase/schema.sql` instead.
3. Get API keys from Settings → API
4. Add credentials to your deployment environment

After deployment, open the admin panel and use **Products** to edit availability, prices, images, and product details. The **Add Product** tab creates new catalog entries and the edit/delete actions update Supabase directly.

---

## Quick Test (Local)

```bash
cd jersey/server
npm install
npm run dev
# Open http://localhost:3000/jersey.html
```
