-- ============================================================
--  Camino al andar · mensajes del día (bajo el título de la portada)
--  Pégalo en  SQL Editor → New query  y aprieta  Run.
--  Se puede ejecutar más de una vez sin romper nada.
-- ============================================================
create table if not exists public.mensajes (
  id              bigint generated always as identity primary key,
  texto           text not null check (length(texto) between 1 and 400),
  fecha           date,                       -- opcional: si tiene fecha, sale solo ese día
  actualizado_por text,
  creado          timestamptz not null default now()
);
create index if not exists mensajes_fecha on public.mensajes (fecha);

-- Cualquiera puede leer (se muestran en el sitio); solo usuarios con sesión pueden escribir.
alter table public.mensajes enable row level security;
drop policy if exists "leer mensajes"    on public.mensajes;
drop policy if exists "escribir mensajes" on public.mensajes;
create policy "leer mensajes"     on public.mensajes for select to anon, authenticated using (true);
create policy "escribir mensajes" on public.mensajes for all to authenticated using (true) with check (true);
