import { createServer } from 'node:http';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
/* Historia a editar: `npm run editor -- <nombre>` o STORY=<nombre> (con o sin
   .json). Default: intro.json. Los guiones viven en src/data/. */
const STORY = process.argv[2] || process.env.STORY || 'intro';
const SCRIPT_FILE = STORY.endsWith('.json') ? STORY : `${STORY}.json`;
const SCRIPT_PATH = resolve(here, '..', 'src', 'data', SCRIPT_FILE);
const HTML_PATH = resolve(here, 'intro-editor.html');
const MUSIC_DIR = resolve(here, '..', 'public', 'music');
const PORT = Number(process.env.PORT) || 4330;

function looksLikeScript(v) {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof v.start === 'string' &&
    !!v.steps &&
    typeof v.steps === 'object'
  );
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'content-type': type });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/') {
      const html = await readFile(HTML_PATH, 'utf8');
      return send(res, 200, html, 'text/html; charset=utf-8');
    }

    if (req.method === 'GET' && req.url === '/api/script') {
      try {
        const raw = await readFile(SCRIPT_PATH, 'utf8');
        return send(res, 200, raw);
      } catch {
        /* Historia nueva (archivo aún inexistente): un nodo vacío. Se crea al
           guardar (PUT). */
        return send(
          res,
          200,
          JSON.stringify({ start: '1', steps: { 1: { text: '' } } }, null, 2),
        );
      }
    }

    /* Lista de temas disponibles (basenames sin .mp3) en public/music. */
    if (req.method === 'GET' && req.url === '/api/music') {
      let files = [];
      try {
        files = (await readdir(MUSIC_DIR))
          .filter((f) => f.toLowerCase().endsWith('.mp3'))
          .map((f) => f.replace(/\.mp3$/i, ''));
      } catch {
        /* sin carpeta o vacía: lista vacía */
      }
      return send(res, 200, JSON.stringify(files));
    }

    /* Sirve los mp3 de public/music para el preview (sólo basename, sin subir
       de directorio). */
    if (req.method === 'GET' && req.url.startsWith('/music/')) {
      const name = decodeURIComponent(req.url.slice('/music/'.length).split('?')[0]);
      if (name.includes('/') || name.includes('\\') || name.includes('..') ||
          !name.toLowerCase().endsWith('.mp3')) {
        return send(res, 404, JSON.stringify({ error: 'not found' }));
      }
      try {
        const buf = await readFile(resolve(MUSIC_DIR, name));
        res.writeHead(200, { 'content-type': 'audio/mpeg', 'content-length': buf.length });
        return res.end(buf);
      } catch {
        return send(res, 404, JSON.stringify({ error: 'not found' }));
      }
    }

    if (req.method === 'PUT' && req.url === '/api/script') {
      const body = await readBody(req);
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        return send(res, 400, JSON.stringify({ error: 'JSON inválido' }));
      }
      if (!looksLikeScript(parsed)) {
        return send(res, 400, JSON.stringify({ error: 'Falta start o steps' }));
      }
      await writeFile(SCRIPT_PATH, JSON.stringify(parsed, null, 2) + '\n');
      return send(res, 200, JSON.stringify({ ok: true }));
    }

    send(res, 404, JSON.stringify({ error: 'not found' }));
  } catch (err) {
    send(res, 500, JSON.stringify({ error: String(err) }));
  }
});

server.listen(PORT, () => {
  console.log(`\n  Editor de intro → http://localhost:${PORT}`);
  console.log(`  Editando: ${SCRIPT_PATH}\n`);
});
