// @ts-check
import { defineConfig } from 'astro/config';
import { readdirSync } from 'node:fs';

import react from '@astrojs/react';
import remarkWikilinks from './src/lib/remark-wikilinks.mjs';
import { CATEGORIAS } from './src/lib/categorias.data.mjs';
import { REINOS } from './src/lib/reinos.data.mjs';

const BRAIN_PATH = process.env.BRAIN_PATH ?? '/home/agusda/Documents/Brain';
const SITE_BASE = '/Vividice';
const LUGARES_BASE = `${BRAIN_PATH}/Brain/Ficción/Vivídice/2 - Lugares`;
const ENTIDADES_BASE = `${BRAIN_PATH}/Brain/Ficción/Vivídice/1- Entidades`;

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

const lugaresHref = buildLugaresHrefMap();
const personajesHref = buildPersonajesHrefMap();
const hrefMap = new Map([...lugaresHref, ...personajesHref]);

// https://astro.build/config
export default defineConfig({
  site: 'https://amurseli.github.io',
  base: '/Vividice',
  integrations: [react()],
  markdown: {
    remarkPlugins: [[remarkWikilinks, { hrefMap }]],
  },
});
