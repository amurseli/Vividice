/*
  Registro de reinos de Personajes — análogo a categorias.data.mjs.
  Es .mjs para que astro.config.mjs lo pueda importar directamente.

  - slug:   segmento de URL (lowercase, kebab)
  - folder: nombre de la subcarpeta en Brain/1- Entidades (autoritativo)
  - label:  display name
*/
export const REINOS = [
  { slug: 'sel',     folder: 'Sel',     label: 'Sel',     subtitle: 'El Alto Reino' },
  { slug: 'kamasco', folder: 'Kamasco', label: 'Kamasco', subtitle: 'Templado a Fuego Irisado'  },
];
