/*
  Historias intermedias de la línea de tiempo (VN sueltas, no atadas a una
  sesión). Es .mjs por consistencia con el resto de los *.data.mjs.

  Las SESIONES ya no viven acá: se cargan desde Brain (colección `sesiones`,
  carpeta "4- Sesiones y recaps", ver src/lib/sesiones.ts). Este archivo es solo
  para las intermedias mientras sus guiones sean JSON locales.

  Campos:
    tipo:        'intermedia' (fijo por ahora)
    slug:        ruta /historias/intermedias/<slug>
    titulo:      display
    descripcion: bajada corta
    orden:       posición en la línea de tiempo. Se ordena junto a las sesiones,
                 que usan su número como orden. Ej: orden 0 = antes de la Sesión 1;
                 orden 2.5 = entre la Sesión 2 y la 3.
*/
export const HISTORIAS = [
  {
    tipo: 'intermedia',
    slug: 'prologo',
    titulo: 'Charla de Tormenta',
    orden: 0,
  },
];
