/*
  Registro de categorías de Lugares.
  Es un .mjs (no TS) para que astro.config.mjs lo pueda importar sin tooling
  extra. Los tipos viven en src/lib/lugares.ts y se derivan de esto.

  - slug:   segmento de URL (lowercase, kebab)
  - folder: nombre de la subcarpeta en Brain (autoritativo)
  - label:  display name
*/
export const CATEGORIAS = [
  {
    slug: 'regiones-y-continentes',
    folder: '1- Regiones y Continentes',
    label: 'Regiones y Continentes',
  },
  {
    slug: 'reinos-e-imperios',
    folder: '2- Reinos e Imperios',
    label: 'Reinos e Imperios',
  },
  {
    slug: 'ciudades-y-pueblos',
    folder: '3- Ciudades y Pueblos',
    label: 'Ciudades y Pueblos',
  },
  {
    slug: 'edificios-y-estructuras',
    folder: '4- Edificios y Estructuras',
    label: 'Edificios y Estructuras',
  },
];
