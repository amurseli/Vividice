import type { Script } from './narrative';
import preludioSesion1 from '../data/preludio-sesion-1.json';

/* Parámetros del shader de fondo (espejo de los props de ShaderBackground).
   Todos opcionales: lo que no se setea cae al default del componente. */
export type ShaderParams = {
  color?: string;
  direction?: number;
  intensity?: number;
  speed?: number;
  seed?: number;
};

export type Preludio = {
  script: Script;
  /* Fondo propio del preludio; pisa campo por campo al default de preludio. */
  bg?: ShaderParams;
};

/* Fondo por defecto de TODOS los preludios. Distinto del rojo diagonal que usan
   la intro y las historias intermedias, para que un preludio se sienta otro
   lugar. Cada preludio puede pisarlo con su propio `bg`. */
export const PRELUDIO_BG_DEFAULT: ShaderParams = {
  color: '#fcfcfc', 
  direction: 0, 
  intensity: 0.85,
  speed: 0.30,
};

/* Preludios por número de sesión → { guion, fondo? }. Cada preludio es una VN
   con su propio JSON en src/data/. Para sumar el de otra sesión: creá
   src/data/preludio-sesion-N.json, importalo y agregá { N: { script, bg? } }.
   El botón en la línea de tiempo y la ruta /historias/preludio/N se cablean
   solos desde acá. */
export const PRELUDIOS: Record<number, Preludio> = {
  1: { script: preludioSesion1 as Script },
};

export function tienePreludio(numero: number): boolean {
  return numero in PRELUDIOS;
}

/* Fondo efectivo de un preludio: default de preludio + su override. */
export function bgDePreludio(p: Preludio): ShaderParams {
  return { ...PRELUDIO_BG_DEFAULT, ...(p.bg ?? {}) };
}
