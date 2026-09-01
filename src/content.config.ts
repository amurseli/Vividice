/*
  Content Collections: cada "tipo" de contenido (lugares, personajes, etc.)
  se define acá con su schema. El schema con Zod:
    1. Valida los .md al build — si falta un campo obligatorio, falla.
    2. Te da tipos en TS: lugar.data.region tiene autocompletado.

  La fuente de contenido vive afuera del repo, en el repo "Brain".
  Apuntamos el loader allá vía env var BRAIN_PATH:
    - Local:  default a /home/agusda/Documents/Brain
    - CI:     se setea como step previo al build (ver workflow)
*/
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';
import { pathToFileURL } from 'node:url';

const BRAIN_PATH = process.env.BRAIN_PATH ?? '/home/agusda/Documents/Brain';
const VIVIDICE_BASE = `${BRAIN_PATH}/Brain/Ficción/Vivídice`;

/* base de cada colección como file:// URL. En Windows una ruta con letra de
   unidad (ej. Q:\...) hace que Astro interprete "Q:" como scheme de URL al
   resolver `new URL(base, root)` y el build revienta ("The URL must be of
   scheme file"). pathToFileURL la vuelve un file:// válido; en Linux/CI el
   resultado es equivalente al string path de antes. */
const brainDir = (sub: string) => pathToFileURL(`${VIVIDICE_BASE}/${sub}/`);

const lugares = defineCollection({
  // pattern recursivo: agarra los .md adentro de las subcarpetas de categoría
  // (1- Regiones y Continentes, etc.). generateId aplana el id a solo el
  // filename (sin la carpeta) para que el slug de URL sea limpio. La categoría
  // se deriva del filePath en runtime vía src/lib/lugares.ts.
  loader: glob({
    pattern: '**/*.md',
    base: brainDir('2 - Lugares'),
    generateId: ({ entry }) => {
      const filename = entry.split('/').pop() ?? entry;
      return filename.replace(/\.md$/, '').toLowerCase();
    },
  }),
  schema: z.object({
    /* nombre/tipo opcionales: una entry puede ser un stub (un .md vacío recién
       creado en Obsidian) sin que rompa el build. El nombre a mostrar cae al
       filename vía nombreDe() en src/lib/lugares.ts. */
    nombre: z.string().nullish(),
    /* preprocess normaliza mayúsculas/acentos antes del enum check.
       Obsidian no fuerza un formato; aceptamos "Región", "region", etc. */
    tipo: z.preprocess(
      (v) =>
        typeof v === 'string'
          ? v
              .toLowerCase()
              .normalize('NFD')
              .replace(/[̀-ͯ]/g, '')
          : v,
      z.enum([
        'continente', 'region',
        'reino', 'imperio',
        'ciudad', 'pueblo', 'barrio',
        'edificio', 'estructura', 'ruina',
        'bosque', 'montana', 'rio',
        'otro',
      ]).nullish().catch(null),
    ),

    /* nullish() acepta string | null | undefined.
       Obsidian deja los campos opcionales vacíos como null (no como ausentes),
       así que esto evita que el build falle cuando el usuario no completa
       un campo opcional desde el property panel. */
    region: z.string().nullish(),
    descripcionCorta: z.string().max(200).nullish(),

    /* Ruta relativa a /public, ej: "lugares/axioma.jpg".
       También acepta URLs absolutas (https://...). */
    imagen: z.string().nullish(),

    /* aliases puede venir como [null] cuando Obsidian crea una entrada vacía
       en una lista. Filtramos nulls y devolvemos un array limpio. */
    aliases: z
      .array(z.string().nullable())
      .nullish()
      .transform((arr) => (arr ?? []).filter((v): v is string => Boolean(v))),
  }),
});

const personajes = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: brainDir('1- Entidades'),
    generateId: ({ entry }) => {
      const filename = entry.split('/').pop() ?? entry;
      return filename.replace(/\.md$/, '').toLowerCase();
    },
  }),
  schema: z.object({
    nombre: z.string(),
    /* .catch('NPC') — fallback para entradas con tipo desconocido (ej: "personaje"
       del template viejo). Actualizar tipo en Brain a PC | NPC | deidad. */
    tipo: z.preprocess(
      (v) => (typeof v === 'string' ? v.trim() : v),
      z.enum(['PC', 'NPC', 'deidad']).catch('NPC'),
    ),
    raza: z.string().nullish(),
    genero: z.string().nullish(),
    estado: z.preprocess(
      (v) => (typeof v === 'string' ? v.toLowerCase() : v),
      z.enum(['vivo', 'muerto', 'desconocido']).nullish(),
    ),
    ocupacion: z.string().nullish(),
    aliases: z
      .array(z.string().nullable())
      .nullish()
      .transform((arr) => (arr ?? []).filter((v): v is string => Boolean(v))),
    hidden: z.boolean().default(false),
  }),
});

const cosmologia = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: brainDir('3- Cosmología'),
    generateId: ({ entry }) => {
      const filename = entry.split('/').pop() ?? entry;
      return filename.replace(/\.md$/, '').toLowerCase();
    },
  }),
  /* Todo opcional: una entry puede ser un .md con solo texto, sin frontmatter.
     El nombre para mostrar se deriva del filename vía nombreDe() si falta. */
  schema: z.object({
    nombre: z.string().nullish(),
    descripcionCorta: z.string().nullish(),
    imagen: z.string().nullish(),
    aliases: z
      .array(z.string().nullable())
      .nullish()
      .transform((arr) => (arr ?? []).filter((v): v is string => Boolean(v))),
  }),
});

/* Sesiones y recaps. Sin frontmatter obligatorio: el número y el título salen
   del nombre de archivo ("NN - Título.md"), parseados en src/lib/sesiones.ts.
   Los archivos que no siguen ese patrón (borradores, "Sin título", etc.) se
   cargan igual pero el sitio los ignora al no poder derivarles un número.
   pattern no-recursivo: solo los .md sueltos en la carpeta. */
const sesiones = defineCollection({
  loader: glob({
    pattern: '*.md',
    base: brainDir('4- Sesiones y recaps'),
    generateId: ({ entry }) => {
      const filename = entry.split('/').pop() ?? entry;
      return filename.replace(/\.md$/, '').toLowerCase();
    },
  }),
  /* Todo opcional; overrides por si alguna vez hace falta forzar algo. */
  schema: z.object({
    titulo: z.string().nullish(),
    sesion: z.number().nullish(),
    descripcionCorta: z.string().nullish(),
    imagen: z.string().nullish(),
    /* Desactiva la sesión: sigue apareciendo en la línea de tiempo pero su caja
       queda deshabilitada (no se puede abrir el recap ni se genera su página).
       Se controla desde el frontmatter de Obsidian: `hidden: true/false`. */
    hidden: z.preprocess(
      (v) => (typeof v === 'string' ? v.trim().toLowerCase() === 'true' : v),
      z.boolean().nullish(),
    ),
  }),
});

export const collections = { lugares, personajes, cosmologia, sesiones };
