alter table public.orders
  add column if not exists monime_session_id text;
