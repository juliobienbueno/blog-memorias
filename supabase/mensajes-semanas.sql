-- ============================================================
--  Camino al andar · mensajes por media semana
--  Agrega a la tabla "mensajes" el tipo de cada mensaje:
--    'bloque' = mensaje de media semana (lunes a miércoles o jueves a domingo)
--    'dia'    = mensaje para un día especial
--  Pégalo en  SQL Editor → New query  y aprieta  Run.  No borra ningún mensaje.
--  Se puede ejecutar más de una vez sin romper nada.
-- ============================================================
alter table public.mensajes add column if not exists tipo text not null default 'dia';

do $$ begin
  alter table public.mensajes add constraint mensajes_tipo_valido check (tipo in ('dia','bloque'));
exception when duplicate_object then null;
end $$;

-- una sola media semana por fecha de inicio (evita duplicados si dos personas guardan a la vez)
create unique index if not exists mensajes_bloque_unico on public.mensajes (fecha) where tipo = 'bloque';
