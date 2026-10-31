create table if not exists public.customer_profiles (
  firebase_uid text primary key,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_profiles enable row level security;

drop policy if exists "Customers can read their own profile" on public.customer_profiles;
create policy "Customers can read their own profile"
  on public.customer_profiles for select to authenticated
  using ((select auth.jwt()->>'sub') = firebase_uid);

drop policy if exists "Customers can create their own profile" on public.customer_profiles;
create policy "Customers can create their own profile"
  on public.customer_profiles for insert to authenticated
  with check ((select auth.jwt()->>'sub') = firebase_uid);

drop policy if exists "Customers can update their own profile" on public.customer_profiles;
create policy "Customers can update their own profile"
  on public.customer_profiles for update to authenticated
  using ((select auth.jwt()->>'sub') = firebase_uid)
  with check ((select auth.jwt()->>'sub') = firebase_uid);

grant select, insert, update on public.customer_profiles to authenticated;
