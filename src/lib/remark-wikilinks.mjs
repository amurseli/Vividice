/*
  Remark plugin custom para wikilinks de Obsidian.

  Convierte:
    [[Axioma]]              -> <a class="wikilink" href="/Vividice/lugares/axioma">Axioma</a>
    [[Axioma|Continente]]   -> <a class="wikilink" href="/Vividice/lugares/axioma">Continente</a>
    [[Nada que existe]]     -> <a class="wikilink wikilink--missing" ...>Nada que existe</a>

  Por qué custom: probé @portaljs/remark-wiki-link y rompía la renderización
  del body markdown completo en Astro 6 (sospecha: dependencia desactualizada
  del AST mdast). 20 líneas propias funcionan igual y son auditables.
*/
import { visit, SKIP } from 'unist-util-visit';

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

/**
 * @param {object} options
 * @param {string[]} options.permalinks      Slugs existentes (lowercase).
 * @param {(slug: string) => string} options.hrefTemplate
 * @param {string} [options.aliasDivider='|']
 */
export default function remarkWikilinks({
  permalinks,
  hrefTemplate,
  aliasDivider = '|',
}) {
  const existing = new Set(permalinks);

  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      if (parent == null || index == null) return;
      if (!node.value.includes('[[')) return;

      const replacements = [];
      let lastIdx = 0;
      let match;
      WIKILINK_RE.lastIndex = 0;

      while ((match = WIKILINK_RE.exec(node.value)) !== null) {
        const [whole, inner] = match;
        const [target, alias] = inner.split(aliasDivider);
        const slug = target.trim().toLowerCase();
        const display = (alias ?? target).trim();
        const isMissing = !existing.has(slug);

        if (match.index > lastIdx) {
          replacements.push({
            type: 'text',
            value: node.value.slice(lastIdx, match.index),
          });
        }

        replacements.push({
          type: 'link',
          url: hrefTemplate(slug),
          data: {
            hProperties: {
              className: isMissing
                ? ['wikilink', 'wikilink--missing']
                : ['wikilink'],
              ...(isMissing ? { title: 'Entrada todavía no creada' } : {}),
            },
          },
          children: [{ type: 'text', value: display }],
        });

        lastIdx = match.index + whole.length;
      }

      if (lastIdx < node.value.length) {
        replacements.push({
          type: 'text',
          value: node.value.slice(lastIdx),
        });
      }

      parent.children.splice(index, 1, ...replacements);
      return [SKIP, index + replacements.length];
    });
  };
}
