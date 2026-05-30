// @ts-check
import { defineConfig } from 'astro/config';
import { readdirSync } from 'node:fs';

import react from '@astrojs/react';
import remarkWikilinks from './src/lib/remark-wikilinks.mjs';
import { CATEGORIAS } from './src/lib/categorias.data.mjs';

const BRAIN_PATH = process.env.BRAIN_PATH ?? '/home/agusda/Documents/Brain';
const SITE_BASE = '/Vividice';
const LUGARES_BASE = `${BRAIN_PATH}/Brain/Ficción/Vivídice/2 - Lugares`;

/*
  Construye un mapa slug -> href para que el plugin de wikilinks sepa la URL
  exacta de cada entry (ahora bajo /lugares/<categoria>/<slug>).
  Si en Brain se agregan/quitan archivos, hay que reiniciar dev server.
*/
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

const lugaresHref = buildLugaresHrefMap();

// https://astro.build/config
export default defineConfig({
  site: 'https://amurseli.github.io',
  base: '/Vividice',
  integrations: [react()],
  markdown: {
    remarkPlugins: [[remarkWikilinks, { hrefMap: lugaresHref }]],
  },
});
