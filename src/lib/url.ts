/*
  Helper centralizado para construir URLs internas que respetan el `base`
  del sitio (ej: "/Vividice").

  Por qué: import.meta.env.BASE_URL puede devolver el base con o sin
  trailing slash dependiendo de la versión de Astro y del modo (dev vs
  build). Concatenar a mano con template strings rompe en producción
  (resultado: /Vividicelugares en vez de /Vividice/lugares).

  Uso:
    url('lugares', lugar.id)              -> "/Vividice/lugares/axioma"
    url('lugares/axioma.jpg')             -> "/Vividice/lugares/axioma.jpg"
    url()                                  -> "/Vividice/"
*/
export function url(...parts: string[]): string {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  const path = parts
    .filter(Boolean)
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .join('/');
  return path ? `${base}/${path}` : `${base}/`;
}
