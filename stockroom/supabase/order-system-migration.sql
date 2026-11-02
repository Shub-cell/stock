-- Stockroom order requests + admin approval workflow.
-- Run this once in Supabase SQL Editor for an EXISTING Stockroom project.
-- Pending orders do not reserve or reduce stock. Stock is reduced atomically only on approval.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  customer_name text not null default '',
  customer_email text not null default '',
  rejection_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete restrict,
  item_name text not null,
  quantity integer not null check (quantity between 1 and 1000000),
  created_at timestamptz not null default now()
);
create index if not exists orders_user_created_idx on public.orders(user_id, created_at desc);
create index if not exists orders_status_created_idx on public.orders(status, created_at desc);
create index if not exists order_items_order_idx on public.order_items(order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
revoke all on public.orders, public.order_items from anon, authenticated;
grant select on public.orders, public.order_items to authenticated;

drop policy if exists orders_read_own_or_admin on public.orders;
create policy orders_read_own_or_admin on public.orders for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists order_items_read_own_or_admin on public.order_items;
create policy order_items_read_own_or_admin on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));

create or replace function public.submit_inventory_order(p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_line jsonb;
  v_item_id uuid;
  v_requested integer;
  v_stock integer;
  v_name text;
  v_profile public.profiles%rowtype;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  select * into v_profile from public.profiles where id = v_user_id and active = true;
  if not found then raise exception 'active account required'; end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'invalid order items';
  end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception 'invalid order items';
  end if;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_items)) <> jsonb_array_length(p_items) then
    raise exception 'duplicate order items';
  end if;

  insert into public.orders(user_id, customer_name, customer_email)
  values (v_user_id, left(v_profile.full_name, 100), left(v_profile.email, 320))
  returning id into v_order_id;

  for v_line in select value from jsonb_array_elements(p_items) loop
    begin
      v_item_id := (v_line->>'id')::uuid;
      v_requested := (v_line->>'quantity')::integer;
    exception when others then
      raise exception 'invalid order item';
    end;
    if v_requested < 1 or v_requested > 1000000 then raise exception 'invalid order quantity'; end if;
    select name, quantity into v_name, v_stock from public.items where id = v_item_id;
    if not found then raise exception 'item not found'; end if;
    if v_stock < v_requested then raise exception 'insufficient stock'; end if;
    insert into public.order_items(order_id, item_id, item_name, quantity)
    values (v_order_id, v_item_id, v_name, v_requested);
  end loop;
  return v_order_id;
end;
$$;

create or replace function public.approve_inventory_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_line record;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status <> 'pending' then raise exception 'order already reviewed'; end if;

  -- Lock and validate every requested stock row before changing any quantity.
  for v_line in
    select i.id, i.quantity as available, oi.quantity as requested
    from public.items i join public.order_items oi on oi.item_id = i.id
    where oi.order_id = p_order_id order by i.id for update of i
  loop
    if v_line.available < v_line.requested then raise exception 'insufficient stock'; end if;
  end loop;

  update public.items i set quantity = i.quantity - oi.quantity
  from public.order_items oi
  where oi.order_id = p_order_id and oi.item_id = i.id;

  update public.orders set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_order_id;
end;
$$;

create or replace function public.reject_inventory_order(p_order_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_order public.orders%rowtype;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status <> 'pending' then raise exception 'order already reviewed'; end if;
  update public.orders set status = 'rejected', rejection_reason = left(nullif(trim(p_reason), ''), 300), reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_order_id;
end;
$$;

revoke all on function public.submit_inventory_order(jsonb) from public, anon;
revoke all on function public.approve_inventory_order(uuid) from public, anon;
revoke all on function public.reject_inventory_order(uuid, text) from public, anon;
grant execute on function public.submit_inventory_order(jsonb) to authenticated;
grant execute on function public.approve_inventory_order(uuid) to authenticated;
grant execute on function public.reject_inventory_order(uuid, text) to authenticated;
