-- Sequential invoice numbers (JHSL-0001, JHSL-0002, ...) for every order.
create sequence if not exists public.invoice_number_seq;

alter table public.orders
  add column if not exists invoice_number text;

-- Backfill existing orders in the order they were placed.
update public.orders o
set invoice_number = 'JHSL-' || lpad(n.seq::text, 4, '0')
from (
  select id, nextval('public.invoice_number_seq') as seq
  from public.orders
  where invoice_number is null
  order by created_at, id
) n
where o.id = n.id;

alter table public.orders
  alter column invoice_number set default 'JHSL-' || lpad(nextval('public.invoice_number_seq')::text, 4, '0');
alter table public.orders
  alter column invoice_number set not null;

create unique index if not exists orders_invoice_number_key on public.orders (invoice_number);
