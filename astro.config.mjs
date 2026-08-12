// @ts-check
import { defineConfig } from 'astro/config';
import { readdirSync } from 'node:fs';

import react from '@astrojs/react';
import remarkHideSections from './src/lib/remark-hide-sections.mjs';
import remarkWikilinks from './src/lib/remark-wikilinks.mjs';
import rehypeFigures from './src/lib/rehype-figures.mjs';
import { CATEGORIAS } from './src/lib/categorias.data.mjs';
import { REINOS } from './src/lib/reinos.data.mjs';
import { CATEGORIAS_COSMOLOGIA } from './src/lib/cosmologia.data.mjs';

const BRAIN_PATH = process.env.BRAIN_PATH ?? '/home/agusda/Documents/Brain';
const SITE_BASE = '/Vividice';
const LUGARES_BASE = `${BRAIN_PATH}/Brain/Ficción/Vivídice/2 - Lugares`;
const ENTIDADES_BASE = `${BRAIN_PATH}/Brain/Ficción/Vivídice/1- Entidades`;
const COSMOLOGIA_BASE = `${BRAIN_PATH}/Brain/Ficción/Vivídice/3- Cosmología`;

function buildLugaresHrefMap() {
  const map = new Map();
  for (const cat of CATEGORIAS) {
    const dir = `${LUGARES_BASE}/${cat.folder}`;
    try {
      for (const file of readdirSync(dir)) {
        if (!file.endsWith('.md')) continue;
        const slug = file.replace(/\.md$/, '').toLowerCase();
        map.set(slug, `${SITE_BASE}/lugares/${cat.slug}/${slug}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[wikilinks] No se pudo leer ${dir}: ${msg}`);
    }
  }
  return map;
}

function buildPersonajesHrefMap() {
  const map = new Map();
  for (const reino of REINOS) { 
    const dir = `${ENTIDADES_BASE}/${reino.folder}`;
    try {
      for (const file of readdirSync(dir)) {
        if (!file.endsWith('.md')) continue;
        const slug = file.replace(/\.md$/, '').toLowerCase();
        map.set(slug, `${SITE_BASE}/personajes/${reino.slug}/${slug}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[wikilinks] No se pudo leer ${dir}: ${msg}`);
    }
  }
  return map;
}

function buildCosmologiaHrefMap() {
  const map = new Map();
  for (const cat of CATEGORIAS_COSMOLOGIA) {
    const dir = `${COSMOLOGIA_BASE}/${cat.folder}`;
    try {
      for (const file of readdirSync(dir)) {
        if (!file.endsWith('.md')) continue;
        const slug = file.replace(/\.md$/, '').toLowerCase();
        map.set(slug, `${SITE_BASE}/cosmologia/${cat.slug}/${slug}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[wikilinks] No se pudo leer ${dir}: ${msg}`);
    }
  }
  return map;
}

const lugaresHref = buildLugaresHrefMap();
const personajesHref = buildPersonajesHrefMap();
const cosmologiaHref = buildCosmologiaHrefMap();
const hrefMap = new Map([...lugaresHref, ...personajesHref, ...cosmologiaHref]);

// https://astro.build/config
export default defineConfig({
  site: 'https://amurseli.github.io',
  base: '/Vividice',
  integrations: [react()],
  markdown: {
    /* remarkHideSections primero: elimina secciones marcadas con `!` antes de
       procesar wikilinks sobre contenido que se va a borrar. */
    remarkPlugins: [remarkHideSections, [remarkWikilinks, { hrefMap }]],
    rehypePlugins: [[rehypeFigures, { base: SITE_BASE }]],
  },
});
