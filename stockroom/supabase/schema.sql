-- Run once in Supabase > SQL Editor.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 100),
  email text not null,
  role text not null default 'user' check (role in ('admin','user')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 1 and 60),
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  category_id uuid not null references public.categories(id) on delete restrict,
  image_path text,
  quantity integer not null default 0 check (quantity between 0 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index items_category_idx on public.items(category_id);
create table public.activity_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  record_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- Role helpers (SECURITY DEFINER; roles live only in public.profiles)
create function public.is_member() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and active) $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and active and role = 'admin') $$;

-- New sign-ups are ALWAYS role 'user'; client-supplied metadata never sets a role.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, left(coalesce(new.raw_user_meta_data->>'full_name',''), 100));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger categories_touch before update on public.categories for each row execute function public.touch();
create trigger items_touch before update on public.items for each row execute function public.touch();

-- Only admins may edit profiles; nobody may change their own role/status.
-- auth.uid() is null in the SQL Editor, which is how the first admin is created.
create function public.guard_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    if not is_admin() then raise exception 'forbidden'; end if;
    if new.id = auth.uid() and (new.role <> old.role or new.active <> old.active) then
      raise exception 'You cannot change your own role or status'; end if;
  end if;
  if new.id <> old.id or new.email <> old.email then raise exception 'immutable column'; end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile();

-- Audit trail written by the database itself, so the app cannot skip it.
create function public.audit() returns trigger language plpgsql security definer set search_path = public as $$
declare r jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
begin
  if tg_table_name = 'profiles' and tg_op = 'UPDATE' then
    if old.active = new.active and old.role = new.role then return new; end if;
  end if;
  insert into activity_logs (user_id, action, record_id, details)
  values (auth.uid(), tg_table_name || '.' || lower(tg_op), (r->>'id')::uuid,
          case when tg_op = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new)) else r end);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger categories_audit after insert or update or delete on public.categories for each row execute function public.audit();
create trigger items_audit after insert or update or delete on public.items for each row execute function public.audit();
create trigger profiles_audit after update on public.profiles for each row execute function public.audit();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.activity_logs enable row level security;

revoke all on public.profiles, public.categories, public.items, public.activity_logs from anon, authenticated;
grant select on public.profiles, public.categories, public.items, public.activity_logs to authenticated;
grant update (role, active) on public.profiles to authenticated;
grant insert, update, delete on public.categories, public.items to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or is_admin());
create policy profiles_admin_update on public.profiles for update to authenticated using (is_admin()) with check (is_admin());
create policy categories_read on public.categories for select to authenticated using (is_member());
create policy categories_admin on public.categories for all to authenticated using (is_admin()) with check (is_admin());
create policy items_read on public.items for select to authenticated using (is_member());
create policy items_admin on public.items for all to authenticated using (is_admin()) with check (is_admin());
create policy logs_read on public.activity_logs for select to authenticated using (is_admin());
-- activity_logs has no insert/update/delete grant or policy: clients cannot alter the audit trail.

-- Image bucket: public read by random filename; only admins can write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inventory-images', 'inventory-images', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy img_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'inventory-images' and public.is_admin());
create policy img_admin_update on storage.objects for update to authenticated using (bucket_id = 'inventory-images' and public.is_admin());
create policy img_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'inventory-images' and public.is_admin());


-- Order request tables, RLS, and approval RPCs.

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
