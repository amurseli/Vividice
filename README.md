# Vividice

Wiki estática de un mundo de fantasía. Sitio público en
`https://amurseli.github.io/Vividice/`.

## Stack

- **Astro** con integración React (componentes interactivos como islands)
- **Content Collections** con schema en Zod para validar entries
- Contenido en Markdown (Obsidian-flavored) consumido desde el repo
  externo `Brain`
- Deploy automático a **GitHub Pages** vía GitHub Actions

## Estructura

```
src/
├── content.config.ts         Schemas Zod de las collections (lugares, ...)
├── layouts/BaseLayout.astro  Layout base: head, navbar, footer, slot
├── components/
│   ├── Navbar.tsx            React, interactivo (menú móvil)
│   ├── Footer.astro          Astro estático
│   └── EntryCard.astro       Card reusable (lugares, personajes futuros)
├── pages/
│   ├── index.astro           Home
│   └── lugares/
│       ├── index.astro       Listado (hero + grid 2 col)
│       └── [...slug].astro   Detalle dinámico por entry
├── styles/global.css         Variables CSS (paleta, tipografía, espacios)
└── content/lugares/          Vacío: el contenido viene de Brain
```

## Fuente de contenido (repo Brain)

El contenido vive en `amurseli/Brain`, en la subcarpeta
`Brain/Ficción/Vivídice/2 - Lugares/`. Vividice no edita Brain, solo lo
lee.

- **Local**: se espera Brain clonado en `/home/agusda/Documents/Brain`.
  La ruta se puede override con la env var `BRAIN_PATH`.
- **CI**: el workflow clona Brain con sparse-checkout (solo la
  subcarpeta) usando un PAT guardado en el secret `BRAIN_REPO_TOKEN`.

## Crear una entry nueva (Lugar)

1. En Obsidian, crear una nota dentro de `2 - Lugares/`.
2. Aplicar el template `lugar.template.md` (o copiar el frontmatter):
   ```yaml
   ---
   nombre: Nombre del lugar
   tipo: ciudad | pueblo | bosque | montana | rio | ruina | continente | region | otro
   region: 
   descripcionCorta: 
   aliases:
     - 
   imagen: lugares/<filename>.jpg  # opcional
   ---
   ```
3. Si tiene imagen, dropearla en `public/lugares/<filename>.jpg` y
   commitear en Vividice.
4. Commit y push en Brain.
5. El workflow de Vividice se puede re-correr desde la pestaña Actions
   (o pushear cualquier cambio acá).

## Comandos

| Comando            | Acción                                                |
| ------------------ | ----------------------------------------------------- |
| `make install`     | Instala dependencias                                  |
| `make dev`         | Dev server en `http://localhost:4321/Vividice/`       |
| `make up-fresh`    | Limpia cache de Astro y arranca dev (tras tocar       |
|                    | `content.config.ts` o agregar nuevas entries)         |
| `make build`       | Build estático a `./dist/`                            |
| `make preview`     | Sirve el build local                                  |
| `make clean`       | Borra `node_modules`, `dist`, `.astro`                |

## Schema y validación

Los `.md` de Brain deben cumplir el schema definido en
`src/content.config.ts`. Si un campo obligatorio falta o un valor de
enum es inválido, el build falla con un error explícito apuntando al
archivo y la línea.

Los campos opcionales aceptan `null` (lo que Obsidian escribe cuando
dejás un property vacío en el panel).

## Deploy

- Cualquier push a `main` en Vividice dispara build + deploy.
- El workflow también acepta `repository_dispatch` con
  `event_type: brain-updated`, para que un push en Brain pueda
  automáticamente refrescar la wiki (no configurado todavía).

## TODO conocido

- Renderizar `[[wikilinks]]` de Obsidian como links HTML reales.
- Slugs limpios (sin caracteres URL-encoded como `viv%C3%ADdice`).
- Collection de personajes.
- Página de mapa interactivo.
