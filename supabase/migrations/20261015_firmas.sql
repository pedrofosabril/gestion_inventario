-- Verdu y Cía. — firmas guardadas compartidas entre todas las computadoras.
-- Ejecutar en Supabase Dashboard > SQL Editor.
-- La app tolera que esta migración no esté aplicada: sigue usando las firmas
-- locales de cada navegador hasta que la tabla exista.

create table if not exists public.firmas (
  id text primary key,
  nombre text not null default '',
  data_url text not null,
  fecha_creacion text,
  created_at timestamptz not null default now()
);

alter table public.firmas enable row level security;

-- Sin los GRANT el rol anon recibe "permission denied" aunque existan políticas.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.firmas to anon, authenticated;

-- La app usa la clave anon (login propio con username + password) y las firmas
-- deben verse en todos los perfiles y equipos: política permisiva como `usuarios`.
drop policy if exists firmas_read on public.firmas;
create policy firmas_read on public.firmas for select to anon, authenticated using (true);
drop policy if exists firmas_write on public.firmas;
create policy firmas_write on public.firmas for all to anon, authenticated using (true) with check (true);
