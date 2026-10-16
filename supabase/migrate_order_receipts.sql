alter table public.orders
  add column if not exists customer_email text,
  add column if not exists receipt_sent_at timestamptz;
