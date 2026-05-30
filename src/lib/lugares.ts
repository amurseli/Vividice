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

/* Categoría a la que pertenece una entry, derivada del path en Brain.
   filePath viene como "/.../2 - Lugares/<folder>/<file>.md". */
export function categoriaDe(lugar: Lugar): Categoria | undefined {
  const path = lugar.filePath ?? '';
  return CATEGORIAS.find((c) => path.includes(`/${c.folder}/`));
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
