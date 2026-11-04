-- JerseyHub: add national team jerseys (Spain, Portugal, England, Brazil, France)
-- Run in Supabase SQL Editor. Safe to re-run; it does not delete or overwrite rows.
-- Run supabase/migrate_products.sql first.

begin;

-- Per-product sizes (null = all sizes: M, L, XL, XXL)
alter table public.products add column if not exists sizes text[];

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_sizes_valid') then
    alter table public.products add constraint products_sizes_valid
      check (sizes is null or sizes <@ array['M','L','XL','XXL']::text[]);
  end if;
end $$;

-- price = selling price (250), sale = original price shown struck through (350) => 29% off
insert into public.products (club, kit, number, price, sale, color, stripe, image, back_image, available, sizes)
select v.club, v.kit, v.number, v.price, v.sale, v.color, v.stripe, v.image, v.back_image, true, v.sizes
from (values
  ('Spain',    'Home 2026/27', 10, 250, 350, '#C60B1E', '#FFC400', 'images/Spain front.webp',    'images/Spain back.webp',    array['XL']::text[]),
  ('Portugal', 'Home 2026/27', 10, 250, 350, '#8A1538', '#006600', 'images/Portugal front.webp', 'images/Portugal back.webp', array['XXL']::text[]),
  ('England',  'Home 2026/27', 10, 250, 350, '#FFFFFF', '#CF081F', 'images/England front.webp',  'images/England back.webp',  array['XXL']::text[]),
  ('Brazil',   'Home 2026/27', 10, 250, 350, '#FFDF00', '#009C3B', 'images/Brazil front.webp',    'images/Brazil back.jpg',    array['L','XL']::text[]),
  ('France',   'Home 2026/27', 10, 250, 350, '#0055A4', '#EF4135', 'images/France front.webp',   'images/France back.jpg',    array['XL']::text[])
) as v(club, kit, number, price, sale, color, stripe, image, back_image, sizes)
where not exists (
  select 1 from public.products p where p.club = v.club and p.kit = v.kit
);

commit;

-- Check:
-- select id, club, kit, price, sale, sizes from public.products
-- where club in ('Spain','Portugal','England','Brazil','France');
