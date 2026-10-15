-- Firmas guardadas: se comparten entre todas las computadoras.
create table if not exists public.firmas (
  id text primary key,
  nombre text not null,
  data_url text not null,
  fecha_creacion text not null default '',
  created_at timestamptz not null default now()
);

alter table public.firmas enable row level security;
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.firmas to anon, authenticated;

drop policy if exists firmas_read on public.firmas;
create policy firmas_read on public.firmas for select to anon, authenticated using (true);
drop policy if exists firmas_write on public.firmas;
create policy firmas_write on public.firmas for all to anon, authenticated using (true) with check (true);
