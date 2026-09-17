-- Verdu y Cía. — esquema inicial de inventario
-- Ejecutar UNA vez en Supabase Dashboard > SQL Editor.
-- Las claves secretas no se almacenan aquí ni en el frontend.

create extension if not exists pgcrypto;

create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username = lower(username)),
  nombre text not null,
  rol text not null default 'observador'
    check (rol in ('administracion', 'panolero', 'ventas', 'observador')),
  created_at timestamptz not null default now()
);

create table if not exists public.repuestos (
  codigo text primary key,
  descripcion text not null,
  proveedor text not null default '',
  equivalencias text,
  uso_destino text,
  categoria text not null default 'panol',
  subcategoria text,
  stock_minimo integer not null default 0 check (stock_minimo >= 0),
  por_encargo boolean not null default false,
  codigo_barras text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists repuestos_codigo_barras_unique
  on public.repuestos (codigo_barras) where codigo_barras is not null and codigo_barras <> '';

create table if not exists public.stock (
  id uuid primary key default gen_random_uuid(),
  codigo text not null references public.repuestos(codigo) on delete cascade,
  cantidad integer not null default 0 check (cantidad >= 0),
  ubicacion text not null default '',
  precio numeric(14,2) not null default 0 check (precio >= 0),
  fecha_control date not null default current_date,
  unique (codigo, ubicacion)
);

create table if not exists public.movimiento_grupos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  tipo text not null check (tipo in ('ingreso', 'salida', 'devolucion', 'ajuste')),
  fecha timestamptz not null default now(),
  comprobante text,
  cliente_proveedor text,
  responsable text,
  notas text,
  firma_digital text,
  firmado_por text,
  firma_fecha timestamptz,
  creado_por uuid references public.perfiles(id) on delete set null
);

create table if not exists public.movimientos (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid references public.movimiento_grupos(id) on delete cascade,
  codigo text not null references public.repuestos(codigo),
  tipo text not null check (tipo in ('ingreso', 'salida', 'devolucion', 'ajuste')),
  cantidad integer not null check (cantidad > 0),
  fecha timestamptz not null default now(),
  comprobante text,
  cliente_proveedor text,
  retira_responsable text,
  descripcion text not null default '',
  proveedor text not null default '',
  ubicacion text not null default '',
  precio_unitario numeric(14,2) not null default 0,
  motivo text
);

create index if not exists movimientos_codigo_fecha_idx on public.movimientos (codigo, fecha desc);
create index if not exists movimientos_grupo_idx on public.movimientos (grupo_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists repuestos_set_updated_at on public.repuestos;
create trigger repuestos_set_updated_at before update on public.repuestos
for each row execute function public.set_updated_at();

-- Un usuario autenticado puede leer inventario y movimientos. Las escrituras
-- quedan restringidas a administración y pañolero mediante una única regla.
alter table public.perfiles enable row level security;
alter table public.repuestos enable row level security;
alter table public.stock enable row level security;
alter table public.movimiento_grupos enable row level security;
alter table public.movimientos enable row level security;

create or replace function public.puede_operar_inventario()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol in ('administracion', 'panolero')
  );
$$;

grant execute on function public.puede_operar_inventario() to authenticated;

drop policy if exists perfiles_read on public.perfiles;
create policy perfiles_read on public.perfiles for select to authenticated using (true);
drop policy if exists perfiles_update_own on public.perfiles;
create policy perfiles_update_own on public.perfiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists inventory_read_repuestos on public.repuestos;
create policy inventory_read_repuestos on public.repuestos for select to authenticated using (true);
drop policy if exists inventory_write_repuestos on public.repuestos;
create policy inventory_write_repuestos on public.repuestos for all to authenticated using (public.puede_operar_inventario()) with check (public.puede_operar_inventario());
drop policy if exists inventory_read_stock on public.stock;
create policy inventory_read_stock on public.stock for select to authenticated using (true);
drop policy if exists inventory_write_stock on public.stock;
create policy inventory_write_stock on public.stock for all to authenticated using (public.puede_operar_inventario()) with check (public.puede_operar_inventario());
drop policy if exists inventory_read_grupos on public.movimiento_grupos;
create policy inventory_read_grupos on public.movimiento_grupos for select to authenticated using (true);
drop policy if exists inventory_write_grupos on public.movimiento_grupos;
create policy inventory_write_grupos on public.movimiento_grupos for all to authenticated using (public.puede_operar_inventario()) with check (public.puede_operar_inventario());
drop policy if exists inventory_read_movimientos on public.movimientos;
create policy inventory_read_movimientos on public.movimientos for select to authenticated using (true);
drop policy if exists inventory_write_movimientos on public.movimientos;
create policy inventory_write_movimientos on public.movimientos for all to authenticated using (public.puede_operar_inventario()) with check (public.puede_operar_inventario());
