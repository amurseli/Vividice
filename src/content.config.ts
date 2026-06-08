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

const BRAIN_PATH = process.env.BRAIN_PATH ?? '/home/agusda/Documents/Brain';
const VIVIDICE_BASE = `${BRAIN_PATH}/Brain/Ficción/Vivídice`;

const lugares = defineCollection({
  // pattern recursivo: agarra los .md adentro de las subcarpetas de categoría
  // (1- Regiones y Continentes, etc.). generateId aplana el id a solo el
  // filename (sin la carpeta) para que el slug de URL sea limpio. La categoría
  // se deriva del filePath en runtime vía src/lib/lugares.ts.
  loader: glob({
    pattern: '**/*.md',
    base: `${VIVIDICE_BASE}/2 - Lugares`,
    generateId: ({ entry }) => {
      const filename = entry.split('/').pop() ?? entry;
      return filename.replace(/\.md$/, '').toLowerCase();
    },
  }),
  schema: z.object({
    nombre: z.string(),
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
      ]),
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

export const collections = { lugares };
