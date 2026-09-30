-- Categoría del repuesto elegida por hoja al importar el Excel.
--
-- Antes la app derivaba la sección del pañol en cada carga con heurísticas
-- (descripción / proveedor / ubicación) o con el mapa estático `CATEGORY_MAP`.
-- Con esta columna la sección queda FIJA por código: al importar un libro donde
-- cada hoja va a su categoría, esa elección se respeta al recargar la app.
--
-- Aplicar en el SQL Editor de Supabase (Dashboard > SQL Editor) tal cual.
-- Es idempotente: se puede aplicar más de una vez sin romper nada.

alter table public.repuestos add column if not exists categoria text;

create index if not exists repuestos_categoria_idx on public.repuestos (categoria);

-- La columna es opcional a propósito: los repuestos ya cargados siguen sin valor
-- y la app los categoriza como siempre. Se completa sola la próxima vez que se
-- edite o se vuelva a importar ese código (la app escribe `categoria` siempre).

-- Comprobación (devuelve la cantidad de repuestos por sección ya guardada):
-- select coalesce(categoria, '(sin guardar)') as seccion, count(*)
-- from public.repuestos group by 1 order by 2 desc;