/*
  Registro de categorías de Cosmología — análogo a categorias.data.mjs.
  Es .mjs para que astro.config.mjs lo pueda importar directamente.

  - slug:   segmento de URL (lowercase, kebab)
  - folder: nombre de la subcarpeta en Brain/6- Cosmología (autoritativo)
  - label:  display name
*/
export const CATEGORIAS_COSMOLOGIA = [
  {
    slug: 'magia-y-tecnologia',
    folder: 'Magia y Tecnología',
    label: 'Magia y Tecnología',
  },
  {
    slug: 'fe-y-deidades',
    folder: 'Fé y Deidades',
    label: 'Fe y Deidades',
  },
  {
    slug: 'organizaciones-y-ordenes',
    folder: 'Organizaciones y Órdenes',
    label: 'Organizaciones y Órdenes',
  },
  {
    slug: 'burocracia-y-sistemas',
    folder: 'Burocracia y Sistemas',
    label: 'Burocracia y Sistemas',
  },
];
