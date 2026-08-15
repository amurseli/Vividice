import type { Script } from './narrative';
import preludioSesion1 from '../data/preludio-sesion-1.json';

/* Preludios por número de sesión → guion (VN). Cada preludio es una novela
   visual con su propio JSON en src/data/. Para sumar el preludio de otra
   sesión: creá src/data/preludio-sesion-N.json, importalo acá y agregá la
   entrada { N: preludioSesionN }. El resto (botón en la línea de tiempo y la
   ruta /historias/preludio/N) se cablea solo desde acá. */
export const PRELUDIOS: Record<number, Script> = {
  1: preludioSesion1 as Script,
};

export function tienePreludio(numero: number): boolean {
  return numero in PRELUDIOS;
}
