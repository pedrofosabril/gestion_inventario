-- Política para que la app (rol anon) pueda VACIAR la tabla `movimientos`.
-- La app usa la clave anon de Supabase; `movimientos` tiene RLS activado y
-- solo políticas para el rol authenticated, por eso el botón "Vaciar la base
-- de datos" no alcanzaba a borrar esta tabla.
--
-- Aplicar en el SQL Editor de Supabase (Dashboard > SQL Editor) tal cual.

drop policy if exists movimientos_delete_anon on public.movimientos;
create policy movimientos_delete_anon on public.movimientos
  for delete to anon
  using (true);

-- En proyectos donde `movimientos` se creó con RLS desactivado esto no es
-- necesario; la política es idempotente y no rompe nada aplicarla igual.