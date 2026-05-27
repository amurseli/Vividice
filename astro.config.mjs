// @ts-check
import { defineConfig } from 'astro/config';
import { readdirSync } from 'node:fs';

import react from '@astrojs/react';
import remarkWikilinks from './src/lib/remark-wikilinks.mjs';

/*
  Wikilinks: [[Axioma]] en el markdown se convierte en
  <a href="/Vividice/lugares/axioma">. Links a archivos inexistentes se
  marcan con la clase "wikilink--missing".

  Trade-off: si se agregan/quitan archivos en Brain, hay que reiniciar
  el dev server para refrescar la lista de permalinks.
*/
const BRAIN_PATH = process.env.BRAIN_PATH ?? '/home/agusda/Documents/Brain';
const SITE_BASE = '/Vividice';

/** @param {string} dir */
function readPermalinks(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, '').toLowerCase());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[wikilinks] No se pudo leer ${dir}: ${msg}`);
    return [];
  }
}

const lugaresPermalinks = readPermalinks(
  `${BRAIN_PATH}/Brain/Ficción/Vivídice/2 - Lugares`,
);

// https://astro.build/config
export default defineConfig({
  site: 'https://amurseli.github.io',
  base: '/Vividice',
  integrations: [react()],
  markdown: {
    remarkPlugins: [
      [
        remarkWikilinks,
        {
          permalinks: lugaresPermalinks,
          hrefTemplate: (/** @type {string} */ slug) =>
            `${SITE_BASE}/lugares/${slug}`,
        },
      ],
    ],
  },
});
