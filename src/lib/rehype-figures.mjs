/*
  Rehype plugin para el cuerpo markdown estilo wiki.

  Imágenes:
  - Reescribe el src para prefijar el `base` del sitio (ej: /Vividice), que
    Astro NO agrega en las `![]()` del markdown crudo. Solo rutas absolutas
    de /public (empiezan con "/"); deja las http(s).
  - Toda imagen sola en su línea (aunque no tenga línea en blanco alrededor)
    se extrae a un <figure> con <figcaption> = alt. El `title` elige la
    ubicación (ver PLACEMENT). Las inline en medio de una oración quedan <img>.

  Citas:
  - <blockquote> (markdown `>`) = epígrafe. Una línea que arranca con raya
    (— / – / --) se marca como atribución (.cita__fuente) y se normaliza a "— ".
  - Un párrafo con 2+ líneas que arrancan con guión se detecta como diálogo
    (.dialogo) y sus guiones se convierten en raya "— ".
*/
import { visit, SKIP } from 'unist-util-visit';

/* title (markdown) -> clase modificadora. Estilos en global.css (.prose). */
const PLACEMENT = {
  right: 'figure--right',
  der: 'figure--right',
  derecha: 'figure--right',
  float: 'figure--right',
  left: 'figure--left',
  izq: 'figure--left',
  izquierda: 'figure--left',
  'right-out': 'figure--out',
  out: 'figure--out',
  aparte: 'figure--out',
  full: 'figure--full',
  ancho: 'figure--full',
};

const DASH_START = /^[ \t]*[-–—]/;
const QUOTE_CHAR = /["“”«»]/;

const isWhitespace = (n) => n.type === 'text' && n.value.trim() === '';

function trimWhitespace(nodes) {
  let a = 0;
  let b = nodes.length;
  while (a < b && isWhitespace(nodes[a])) a += 1;
  while (b > a && isWhitespace(nodes[b - 1])) b -= 1;
  return nodes.slice(a, b);
}

function textOf(node) {
  if (node.type === 'text') return node.value;
  if (Array.isArray(node.children)) return node.children.map(textOf).join('');
  return '';
}

function addClass(node, cls) {
  node.properties = node.properties || {};
  const prev = node.properties.className;
  const arr = Array.isArray(prev) ? prev : prev ? [prev] : [];
  node.properties.className = [...arr, cls];
}

/* Convierte guiones al inicio de línea en raya "— ". */
function dashesToRaya(node) {
  visit(node, 'text', (t) => {
    t.value = t.value.replace(/(^|\n)[ \t]*[-–—][ \t]?/g, '$1— ');
  });
}

/* Envuelve lo que está entre comillas en <span class="dicho"> (rojo).
   Alterna al cruzar cualquier comilla; abarca elementos inline (ej: **bold**). */
function wrapQuotes(nodes) {
  if (!nodes.some((n) => QUOTE_CHAR.test(textOf(n)))) return nodes;
  const result = [];
  let span = null;
  const push = (node) => (span ? span.children : result).push(node);
  for (const node of nodes) {
    if (node.type !== 'text') {
      push(node);
      continue;
    }
    let seg = '';
    for (const ch of node.value) {
      if (!QUOTE_CHAR.test(ch)) {
        seg += ch;
        continue;
      }
      if (seg) {
        push({ type: 'text', value: seg });
        seg = '';
      }
      if (span) {
        span.children.push({ type: 'text', value: ch });
        span = null;
      } else {
        span = {
          type: 'element',
          tagName: 'span',
          properties: { className: ['dicho'] },
          children: [{ type: 'text', value: ch }],
        };
        result.push(span);
      }
    }
    if (seg) push({ type: 'text', value: seg });
  }
  return result;
}

export default function rehypeFigures({ base = '' } = {}) {
  const prefix = base.replace(/\/+$/, '');

  const withBase = (src) => {
    if (!src || /^https?:\/\//.test(src) || !src.startsWith('/')) return src;
    if (prefix && (src === prefix || src.startsWith(`${prefix}/`))) return src;
    return `${prefix}${src}`;
  };

  const toFigure = (img) => {
    const alt =
      typeof img.properties.alt === 'string' ? img.properties.alt.trim() : '';
    const title =
      typeof img.properties.title === 'string'
        ? img.properties.title.trim().toLowerCase()
        : '';
    const mod = PLACEMENT[title];
    if (mod) delete img.properties.title;

    const children = [img];
    if (alt) {
      children.push({
        type: 'element',
        tagName: 'figcaption',
        properties: {},
        children: [{ type: 'text', value: alt }],
      });
    }
    return {
      type: 'element',
      tagName: 'figure',
      properties: { className: mod ? ['figure', mod] : ['figure'] },
      children,
    };
  };

  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName === 'img' && node.properties) {
        node.properties.src = withBase(node.properties.src);
      }
    });

    /* Imágenes en su propia línea -> <figure>. */
    visit(tree, 'element', (node, index, parent) => {
      if (
        node.tagName !== 'p' ||
        parent == null ||
        index == null ||
        !Array.isArray(node.children)
      ) {
        return undefined;
      }

      const kids = node.children;
      const replacement = [];
      let buffer = [];
      const flush = () => {
        const trimmed = trimWhitespace(buffer);
        if (trimmed.length) {
          replacement.push({
            type: 'element',
            tagName: 'p',
            properties: {},
            children: trimmed,
          });
        }
        buffer = [];
      };

      let changed = false;
      for (let i = 0; i < kids.length; i += 1) {
        const c = kids[i];
        const prev = kids[i - 1];
        const next = kids[i + 1];
        const onOwnLine =
          c.type === 'element' &&
          c.tagName === 'img' &&
          c.properties &&
          (i === 0 || (prev.type === 'text' && /\n\s*$/.test(prev.value))) &&
          (i === kids.length - 1 ||
            (next.type === 'text' && /^\s*\n/.test(next.value)));

        if (onOwnLine) {
          changed = true;
          flush();
          replacement.push(toFigure(c));
        } else {
          buffer.push(c);
        }
      }
      flush();

      if (!changed) return undefined;
      parent.children.splice(index, 1, ...replacement);
      return [SKIP, index + replacement.length];
    });

    /* Diálogo: párrafo con 2+ líneas que arrancan con guión. */
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'p' || !Array.isArray(node.children)) return;
      const lines = textOf(node)
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2 || !lines.every((l) => DASH_START.test(l))) return;
      addClass(node, 'dialogo');
      dashesToRaya(node);
      node.children = wrapQuotes(node.children);
    });

    /* Epígrafe: atribución dentro de un blockquote. */
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'blockquote' || !Array.isArray(node.children)) return;
      for (const child of node.children) {
        if (child.type !== 'element' || child.tagName !== 'p') continue;
        if (DASH_START.test(textOf(child).trimStart())) {
          addClass(child, 'cita__fuente');
          dashesToRaya(child);
        }
        child.children = wrapQuotes(child.children);
      }
    });
  };
}
