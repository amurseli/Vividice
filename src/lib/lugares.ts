/*
  Helpers tipados para trabajar con la collection "lugares" y sus categorías.
  La fuente de verdad de la lista de categorías es categorias.data.mjs,
  importado acá para mantener una sola declaración.
*/
import type { CollectionEntry } from 'astro:content';
import { CATEGORIAS as CATEGORIAS_RAW } from './categorias.data.mjs';
import { url } from './url';

export type Categoria = {
  slug: string;
  folder: string;
  label: string;
};

export const CATEGORIAS: readonly Categoria[] = CATEGORIAS_RAW;

export type Lugar = CollectionEntry<'lugares'>;

/* Nombre para mostrar: usa el del frontmatter si existe, si no lo deriva del
   filename original (preservando mayúsculas, que el id pierde al normalizar).
   Así un stub sin frontmatter igual muestra un título razonable. */
export function nombreDe(lugar: Lugar): string {
  if (lugar.data.nombre) return lugar.data.nombre;
  const file = (lugar.filePath ?? lugar.id).split('/').pop() ?? lugar.id;
  return file.replace(/\.md$/i, '');
}

/* Categoría a la que pertenece una entry, derivada del path en Brain.
   filePath viene como "/.../2 - Lugares/<folder>/<file>.md". */
export function categoriaDe(lugar: Lugar): Categoria | undefined {
  const path = lugar.filePath ?? '';
  return CATEGORIAS.find((c) => path.includes(`/${c.folder}/`));
}

/* Subcarpeta dentro de una categoría: el segmento inmediatamente después de la
   carpeta de categoría, si la entry está anidada. Ej:
     ".../2- Reinos e Imperios/Islas/A'des.md"  → "Islas"
     ".../2- Reinos e Imperios/Sel.md"          → null (directo en la categoría)
   Permite que una categoría tenga sub-agrupaciones navegables. */
export function subcarpetaDe(lugar: Lugar): string | null {
  const cat = categoriaDe(lugar);
  if (!cat) return null;
  const path = lugar.filePath ?? '';
  const marker = `/${cat.folder}/`;
  const idx = path.indexOf(marker);
  if (idx === -1) return null;
  const rest = path.slice(idx + marker.length);
  const parts = rest.split('/');
  return parts.length > 1 ? parts[0] : null;
}

/* Slug de URL a partir de un nombre libre (subcarpeta): minúsculas, sin
   acentos, kebab-case. */
export function slugSubcarpeta(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* URL del listado de una subcarpeta. El segmento "grupo" evita chocar con la
   ruta de detalle /lugares/<categoria>/<slug>. */
export function urlSubcarpeta(cat: Categoria, subcarpeta: string): string {
  return url('lugares', cat.slug, 'grupo', slugSubcarpeta(subcarpeta));
}

export function categoriaPorSlug(slug: string): Categoria | undefined {
  return CATEGORIAS.find((c) => c.slug === slug);
}

/* URL canónica de una entry. */
export function urlLugar(lugar: Lugar): string {
  const cat = categoriaDe(lugar);
  if (!cat) return url('lugares', lugar.id);
  return url('lugares', cat.slug, lugar.id);
}

/* URL de una categoría (su listado). */
export function urlCategoria(cat: Categoria): string {
  return url('lugares', cat.slug);
}
