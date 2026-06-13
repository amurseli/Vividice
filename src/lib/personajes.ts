import type { CollectionEntry } from 'astro:content';
import { REINOS as REINOS_RAW } from './reinos.data.mjs';
import { url } from './url';

export type Reino = {
  slug: string;
  folder: string;
  label: string;
  subtitle: string;
};

export const REINOS: readonly Reino[] = REINOS_RAW;

export type Personaje = CollectionEntry<'personajes'>;

/* Reino al que pertenece un personaje, derivado del path en Brain.
   filePath viene como "/.../1- Entidades/<folder>/<file>.md". */
export function reinoDe(personaje: Personaje): Reino | undefined {
  const path = personaje.filePath ?? '';
  return REINOS.find((r) => path.includes(`/${r.folder}/`));
}

export function reinoPorSlug(slug: string): Reino | undefined {
  return REINOS.find((r) => r.slug === slug);
}

export function urlPersonaje(personaje: Personaje): string {
  const reino = reinoDe(personaje);
  if (!reino) return url('personajes', personaje.id);
  return url('personajes', reino.slug, personaje.id);
}

export function urlReino(reino: Reino): string {
  return url('personajes', reino.slug);
}
