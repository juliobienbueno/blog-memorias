# Camino al andar

Blog de columnas de Raúl Gutiérrez.

- **Sitio público**: páginas fijas (rápidas y buenas para Google), publicadas en **Vercel**.
- **Columnas**: guardadas en **Supabase** (base de datos gratis).
- **Panel** en `/admin/`: para cargar Word, editar columnas y publicar. Se entra con usuario y contraseña de Supabase, desde cualquier computador.

```
Word (.docx) ──► Panel /admin/ ──► Supabase ──► Vercel arma el sitio ──► sitio público
```

---

## Puesta en marcha (una sola vez)

### 1. Supabase: crear la base de datos
1. En tu proyecto de Supabase, abre **SQL Editor → New query**.
2. Pega todo el contenido de `supabase/esquema.sql` y aprieta **Run**.
3. En **Table Editor** deberían aparecer las tablas `columnas` y `ajustes`.

### 2. Supabase: usuarios y seguridad
1. **Authentication → Sign In / Providers** (o *Settings*): desactiva **Allow new users to sign up**. Así nadie puede crearse una cuenta por su cuenta.
2. **Authentication → Users → Add user → Create new user**: crea a las dos personas con su correo y una contraseña, marcando **Auto Confirm User**.
3. Después de publicar en Vercel (paso 3): **Authentication → URL Configuration**:
   - **Site URL**: la dirección del sitio (ej. `https://camino-al-andar.vercel.app`)
   - **Redirect URLs**: agrega `https://camino-al-andar.vercel.app/admin/`
   Esto es necesario para el correo de "¿Olvidaste tu contraseña?".

### 3. Vercel: publicar el sitio
1. Sube esta carpeta a GitHub (repositorio `blog-memorias`).
2. En Vercel: **Add New → Project → Import** el repositorio. No hay que cambiar nada: `vercel.json` ya dice cómo armarlo.
3. Cuando termine, anota la dirección del sitio y completa el paso 2.3.

### 4. Publicación automática
1. En Vercel: **Settings → Git → Deploy Hooks**: crea uno (nombre `panel`, rama `main`) y copia la dirección.
2. En el panel (`/admin/`) → **Ajustes** → pega esa dirección → **Guardar**.

Desde ahí, cada vez que alguien carga o edita una columna, el sitio se vuelve a publicar solo (unos 20 segundos después del último cambio; tarda 1–2 minutos en verse).

### 5. Pasar las 153 columnas
En el panel → **Ajustes** → **Cargar respaldo…** → elige el archivo `datos/columnas.json` de la carpeta de la versión de escritorio (`Escritorio\columnas\camino-al-andar\datos\columnas.json`).

---

## Uso diario (panel `/admin/`)

- **Cargar columnas**: arrastra los Word (.docx) al recuadro. Si ya existe una columna con el mismo título, se actualiza.
- **Editar**: título, bajada, fecha, tema, epígrafe, nota del autor y texto completo. Guarda con el botón o **Ctrl+S**.
- **Fecha y tema**: se pueden corregir directo en la lista.
- **Quitar** una columna.
- **Cambiar contraseña**: botón arriba. Si alguien la olvida: **¿Olvidaste tu contraseña?** en la pantalla de entrada (llega un correo).
- **Respaldo**: en Ajustes puedes descargar todas las columnas en un archivo.
- **Mensajes del día** (bajo el título de la portada): botón arriba. Cada semana lleva dos mensajes: uno de lunes a miércoles y otro de jueves a domingo; si una mitad queda vacía, sigue el último que hubo. Un mensaje para un día especial reemplaza al de la semana ese día. El cambio es a medianoche, hora de Chile, sin volver a publicar. (Requiere haber ejecutado `supabase/mensajes.sql` y `supabase/mensajes-semanas.sql` en el SQL Editor de Supabase.)
- **Presentación**: la foto que acompaña el texto es `plantilla/presentacion.jpg` (si se borra, la presentación queda solo con texto).
- **El autor**: la foto es `plantilla/autor.jpg` y el texto está en `autor.md` (el primer párrafo es el pie de foto; lo demás va debajo).
- **Presentación** (la ventana "Leer la presentación"): su texto está en `presentacion.md`.

Marcas en el texto de una columna:
- Una línea en blanco separa párrafos.
- `## Texto` → intertítulo · `> Texto` → cita · `!! Texto` → nota en rojo
- `*texto*` → cursiva · `**texto**` → negrita

### Cómo tiene que venir el Word
1. **Título**: primer párrafo, en negrita.
2. **Bajada**: lo que va entre el título y la fecha (normalmente en cursiva).
3. **Nota del autor** (opcional): texto en **rojo**.
4. **Epígrafe** (opcional): texto **resaltado en amarillo** antes de la fecha.
5. **Fecha**: "Julio de 2024", "Agosto 1992", "Santiago, año 1993"… (entiende también "Juliode 1990" o "Julo 1992").
6. **Texto**: todo lo demás. Líneas cortas en MAYÚSCULAS o negrita → intertítulos.

Los .doc antiguos no se leen: ábrelos en Word → *Guardar como → .docx*.

---

## Seguridad

- Solo los usuarios creados en Supabase pueden entrar al panel. El registro público está desactivado.
- Aunque alguien encuentre la dirección `/admin/`, sin usuario y contraseña no puede cambiar nada: la base de datos rechaza cualquier escritura sin sesión (reglas de acceso en `supabase/esquema.sql`).
- La clave que aparece en `sitio.config.json` es la **publicable** de Supabase: está hecha para ir en páginas públicas y solo permite leer. **Nunca** pongas en este proyecto la clave *secret / service_role*.
- La sesión se cierra al cerrar la pestaña.

## Textos y ajustes del sitio

- `sitio.config.json`: título, subtítulo, autor, descripción, correo de contacto, `segundosPorTarjeta` (cuánto se queda quieto cada grupo del carrusel: segundos por tarjeta visible), `advertencia` (texto que el panel pone como primer epígrafe de cada columna nueva, con su fecha; luego se edita en cada columna. Para las columnas que ya existían se usó `supabase/advertencia-epigrafe.sql`), `goatcounter` (visitas) y `urlSitio` (si luego usas un dominio propio).
- `presentacion.md`: texto de la ventana "Leer la presentación" de la portada.
- `autor.md`: página "El autor".
- `plantilla/`: diseño (estilos y carrusel).

Después de cambiar uno de estos archivos, súbelo a GitHub: Vercel vuelve a publicar solo.

## Probar en tu computador (opcional)

```
node construir.js                                  (lee desde Supabase)
node construir.js --local ruta\a\columnas.json     (desde un respaldo, sin internet)
```
El resultado queda en la carpeta `sitio`.
