/*
  Rehype plugin para imágenes estilo wiki en el cuerpo markdown.

  - Reescribe el src de las imágenes para prefijar el `base` del sitio
    (ej: /Vividice), que Astro NO agrega en las `![]()` del markdown crudo.
    Solo toca rutas absolutas de /public (empiezan con "/"); deja las http(s).
  - Toda imagen que esté sola en su línea (aunque no tenga línea en blanco
    alrededor) se extrae a un <figure> con <figcaption> tomado del alt. El
    `title` elige la ubicación (ver PLACEMENT). Las imágenes inline en medio
    de una oración se dejan como <img> (solo se les reescribe el src).
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

const isWhitespace = (n) => n.type === 'text' && n.value.trim() === '';

function trimWhitespace(nodes) {
  let a = 0;
  let b = nodes.length;
  while (a < b && isWhitespace(nodes[a])) a += 1;
  while (b > a && isWhitespace(nodes[b - 1])) b -= 1;
  return nodes.slice(a, b);
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
  };
}
