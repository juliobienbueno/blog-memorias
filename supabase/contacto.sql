-- ============================================================
--  Camino al andar · mensajes del formulario de contacto
--  Cualquiera puede ENVIAR un mensaje desde el sitio; solo los usuarios
--  del panel pueden leerlos, marcarlos como leídos o borrarlos.
--  Pégalo en  SQL Editor → New query  y aprieta  Run.
--  Se puede ejecutar más de una vez sin romper nada.
-- ============================================================
create table if not exists public.contactos (
  id       bigint generated always as identity primary key,
  nombre   text not null check (length(nombre) between 1 and 120),
  correo   text not null check (length(correo) between 3 and 200 and correo ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  mensaje  text not null check (length(mensaje) between 1 and 5000),
  leido    boolean not null default false,
  creado   timestamptz not null default now()
);
create index if not exists contactos_creado on public.contactos (creado desc);

alter table public.contactos enable row level security;
drop policy if exists "enviar contacto"  on public.contactos;
drop policy if exists "leer contacto"    on public.contactos;
drop policy if exists "cambiar contacto" on public.contactos;
drop policy if exists "borrar contacto"  on public.contactos;
create policy "enviar contacto"  on public.contactos for insert to anon, authenticated with check (leido = false);
create policy "leer contacto"    on public.contactos for select to authenticated using (true);
create policy "cambiar contacto" on public.contactos for update to authenticated using (true) with check (true);
create policy "borrar contacto"  on public.contactos for delete to authenticated using (true);
