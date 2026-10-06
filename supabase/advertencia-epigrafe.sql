-- ============================================================
--  Camino al andar · advertencia sobre el presentismo como epígrafe
--  Agrega a cada columna, como PRIMER epígrafe, la advertencia con su fecha:
--    "Para evitar la distorsión del presentismo es indispensable tener en cuenta
--     la fecha en que fue escrita esta columna: julio de 1990."
--  Si la columna ya tenía epígrafe, la cita queda debajo. Después se puede editar
--  o quitar en cada columna desde el panel (Editar → Epígrafe).
--  Pégalo en  SQL Editor → New query  y aprieta  Run.
--  Se puede ejecutar más de una vez: no la repite en las columnas que ya la tienen.
-- ============================================================
update public.columnas
set epigrafe = jsonb_build_array(
      'Para evitar la distorsión del presentismo es indispensable tener en cuenta la fecha en que fue escrita esta columna'
      || case when anio is not null and coalesce(fecha, '') <> ''
              then ': ' || lower(left(fecha, 1)) || substr(fecha, 2)
              else '' end
      || '.'
    ) || coalesce(epigrafe, '[]'::jsonb)
where coalesce(epigrafe, '[]'::jsonb)::text not ilike '%presentismo%';

-- Muestra cuántas columnas quedaron con la advertencia
select count(*) as columnas_con_advertencia
from public.columnas
where epigrafe::text ilike '%presentismo%';
