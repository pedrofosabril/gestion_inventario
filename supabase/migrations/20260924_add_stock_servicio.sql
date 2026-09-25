-- Migración: separar Stock Normal de P/SERVICIO
-- Ejecutar UNA vez en Supabase Dashboard > SQL Editor.
--
-- Agrega la columna `stock_servicio` a la tabla `stock`. A partir de ahora:
--   cantidad       = Stock Normal (venta)
--   stock_servicio = Stock P/SERVICIO
-- El total del producto es cantidad + stock_servicio.

alter table public.stock
  add column if not exists stock_servicio integer not null default 0
  check (stock_servicio >= 0);