/*
  Remark plugin custom para ocultar secciones de un artículo.

  Regla de autoría: prefijá el título de una sección con `!` para que el sitio
  publicado la ignore, manteniéndola visible/editable en Obsidian.

    #### !La Sangre X   -> se elimina el heading + todo su contenido
    #### La Sangre Y    -> se muestra normal

  Se borra desde el heading marcado hasta (sin incluir) el próximo heading de
  nivel igual o superior, así que marcar un heading padre también oculta sus
  subsecciones anidadas.

  Corre en la etapa remark (mdast), antes que remark-wikilinks: el texto del
  heading todavía es crudo (los [[...]] no se convirtieron aún) y el heading
  removido tampoco aparece en render().headings.
*/
import { visit, SKIP } from 'unist-util-visit';

const MARKER = '!';

/* Texto plano de un heading: concatena sus nodos `text` (soporta headings con
   wikilinks, negrita, etc.). */
function headingText(node) {
  let s = '';
  visit(node, 'text', (t) => {
    s += t.value;
  });
  return s;
}

/**
 * @param {object} [options]
 * @param {string} [options.marker='!']   prefijo que marca una sección oculta
 */
export default function remarkHideSections({ marker = MARKER } = {}) {
  return (tree) => {
    visit(tree, 'heading', (node, index, parent) => {
      if (parent == null || index == null) return;
      if (!headingText(node).trimStart().startsWith(marker)) return;

      /* Fin de la sección: el próximo heading de nivel <= al marcado. */
      const depth = node.depth;
      let end = index + 1;
      while (end < parent.children.length) {
        const sib = parent.children[end];
        if (sib.type === 'heading' && sib.depth <= depth) break;
        end += 1;
      }
      parent.children.splice(index, end - index); // borra heading + subárbol
      return [SKIP, index]; // reanuda en el mismo índice (ya es el nodo siguiente)
    });
  };
}
