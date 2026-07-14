import type { CollectionEntry } from 'astro:content';
import { CATEGORIAS_COSMOLOGIA as CATEGORIAS_RAW } from './cosmologia.data.mjs';
import { url } from './url';

export type CategoriaCosmologia = {
  slug: string;
  folder: string;
  label: string;
};

export const CATEGORIAS: readonly CategoriaCosmologia[] = CATEGORIAS_RAW;

export type Concepto = CollectionEntry<'cosmologia'>;

/* Nombre para mostrar: usa el del frontmatter si existe, si no lo deriva del
   filename original (preservando mayúsculas, que el id pierde al normalizar). */
export function nombreDe(concepto: Concepto): string {
  if (concepto.data.nombre) return concepto.data.nombre;
  const file = (concepto.filePath ?? concepto.id).split('/').pop() ?? concepto.id;
  return file.replace(/\.md$/, '');
}

export function categoriaDe(concepto: Concepto): CategoriaCosmologia | undefined {
  const path = concepto.filePath ?? '';
  return CATEGORIAS.find((c) => path.includes(`/${c.folder}/`));
}

export function categoriaPorSlug(slug: string): CategoriaCosmologia | undefined {
  return CATEGORIAS.find((c) => c.slug === slug);
}

export function urlConcepto(concepto: Concepto): string {
  const cat = categoriaDe(concepto);
  if (!cat) return url('cosmologia', concepto.id);
  return url('cosmologia', cat.slug, concepto.id);
}

export function urlCategoria(cat: CategoriaCosmologia): string {
  return url('cosmologia', cat.slug);
}
