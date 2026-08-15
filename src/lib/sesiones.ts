import type { CollectionEntry } from 'astro:content';
import { url } from './url';

export type Sesion = CollectionEntry<'sesiones'>;

/* Info derivada de una sesión, lista para render/orden. */
export type SesionInfo = {
  numero: number;
  titulo: string;
  /* Desactivada: se muestra en la línea pero sin poder abrir el recap. */
  hidden: boolean;
  entry: Sesion;
};

/* Nombre de archivo original (con mayúsculas), sin .md. El id de la colección
   viene en minúsculas (generateId), así que para el título usamos el filePath. */
function fileBase(s: Sesion): string {
  const file = (s.filePath ?? s.id).split('/').pop() ?? s.id;
  return file.replace(/\.md$/i, '');
}

/* "NN - Título" → número + título. Acepta -, – o — como separador. */
const RE = /^\s*(\d+)\s*[-–—]\s*(.+?)\s*$/;

/* Deriva {numero, titulo} de una entrada. Prioriza overrides de frontmatter
   (sesion / titulo). Devuelve null si no hay número → el sitio la ignora. */
export function sesionInfo(entry: Sesion): SesionInfo | null {
  const base = fileBase(entry);
  const m = base.match(RE);
  const numero = entry.data.sesion ?? (m ? Number(m[1]) : null);
  if (numero == null || Number.isNaN(numero)) return null;
  const titulo = entry.data.titulo ?? (m ? m[2] : base);
  return { numero, titulo, hidden: entry.data.hidden ?? false, entry };
}

/* Todas las sesiones válidas, ordenadas por número. */
export function ordenarSesiones(entries: Sesion[]): SesionInfo[] {
  return entries
    .map(sesionInfo)
    .filter((s): s is SesionInfo => s !== null)
    .sort((a, b) => a.numero - b.numero);
}

export function urlSesion(numero: number): string {
  return url('historias', 'sesion', String(numero));
}
