-- ============================================================
--  Camino al andar · estructura de la base de datos en Supabase
--  Pégalo completo en  SQL Editor → New query  y aprieta  Run.
--  Se puede ejecutar más de una vez sin romper nada.
-- ============================================================

-- 1) Columnas ------------------------------------------------
create table if not exists public.columnas (
  id               text primary key,                 -- dirección de la página (ej: zanganos-al-ataque)
  titulo           text not null,
  bajada           text not null default '',
  fecha            text not null default '',          -- como se muestra: "Julio de 1990"
  fecha_original   text not null default '',          -- como venía en el Word
  fecha_manual     text,                              -- si se corrigió en el panel
  anio             int,
  mes              int check (mes between 1 and 12),
  tema             text not null default '',
  notas            jsonb not null default '[]'::jsonb, -- notas del autor (texto en rojo)
  epigrafe         jsonb not null default '[]'::jsonb, -- citas bajo la bajada
  cuerpo           jsonb not null default '[]'::jsonb, -- bloques: {tipo:'p'|'h'|'cita'|'nota', html}
  texto            text not null default '',          -- texto plano (para el buscador)
  archivo          text not null default '',          -- nombre del Word original
  avisos           jsonb not null default '[]'::jsonb,
  editado_en_panel timestamptz,
  actualizado_por  text,
  creado           timestamptz not null default now(),
  actualizado      timestamptz not null default now()
);
create index if not exists columnas_orden on public.columnas (anio, mes, titulo);

-- actualizado = ahora, en cada cambio
create or replace function public.tocar_actualizado() returns trigger
language plpgsql set search_path = '' as $$
begin new.actualizado := now(); return new; end $$;
drop trigger if exists columnas_actualizado on public.columnas;
create trigger columnas_actualizado before update on public.columnas
  for each row execute function public.tocar_actualizado();

-- Reglas de acceso: cualquiera puede LEER (el sitio es público);
-- solo usuarios con sesión iniciada pueden crear, editar o borrar.
alter table public.columnas enable row level security;
drop policy if exists "leer columnas"   on public.columnas;
drop policy if exists "crear columnas"  on public.columnas;
drop policy if exists "editar columnas" on public.columnas;
drop policy if exists "borrar columnas" on public.columnas;
create policy "leer columnas"   on public.columnas for select to anon, authenticated using (true);
create policy "crear columnas"  on public.columnas for insert to authenticated with check (true);
create policy "editar columnas" on public.columnas for update to authenticated using (true) with check (true);
create policy "borrar columnas" on public.columnas for delete to authenticated using (true);

-- 2) Ajustes privados del panel (solo usuarios con sesión) ----
--    Aquí se guarda la dirección que le avisa a Vercel que publique.
create table if not exists public.ajustes (
  clave text primary key,
  valor text not null default ''
);
alter table public.ajustes enable row level security;
drop policy if exists "ajustes panel" on public.ajustes;
create policy "ajustes panel" on public.ajustes for all to authenticated using (true) with check (true);
insert into public.ajustes (clave, valor) values ('vercel_deploy_hook', '') on conflict (clave) do nothing;

-- 3) Word originales (privados) --------------------------------
insert into storage.buckets (id, name, public)
values ('originales', 'originales', false)
on conflict (id) do nothing;
drop policy if exists "originales leer"   on storage.objects;
drop policy if exists "originales subir"  on storage.objects;
drop policy if exists "originales cambiar" on storage.objects;
drop policy if exists "originales borrar" on storage.objects;
create policy "originales leer"    on storage.objects for select to authenticated using (bucket_id = 'originales');
create policy "originales subir"   on storage.objects for insert to authenticated with check (bucket_id = 'originales');
create policy "originales cambiar" on storage.objects for update to authenticated using (bucket_id = 'originales');
create policy "originales borrar"  on storage.objects for delete to authenticated using (bucket_id = 'originales');

-- 4) Mensajes del día ------------------------------------------
create table if not exists public.mensajes (
  id              bigint generated always as identity primary key,
  texto           text not null check (length(texto) between 1 and 400),
  fecha           date,                       -- día especial, o lunes/jueves en que empieza la media semana
  tipo            text not null default 'dia' check (tipo in ('dia','bloque')),
  actualizado_por text,
  creado          timestamptz not null default now()
);
create index if not exists mensajes_fecha on public.mensajes (fecha);
create unique index if not exists mensajes_bloque_unico on public.mensajes (fecha) where tipo = 'bloque';

-- Cualquiera puede leer (se muestran en el sitio); solo usuarios con sesión pueden escribir.
alter table public.mensajes enable row level security;
drop policy if exists "leer mensajes"    on public.mensajes;
drop policy if exists "escribir mensajes" on public.mensajes;
create policy "leer mensajes"     on public.mensajes for select to anon, authenticated using (true);
create policy "escribir mensajes" on public.mensajes for all to authenticated using (true) with check (true);

-- Listo. Comprueba que aparezcan las tablas "columnas", "ajustes" y "mensajes" en Table Editor.
