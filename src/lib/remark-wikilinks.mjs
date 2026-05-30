/*
  Remark plugin custom para wikilinks de Obsidian.

  Convierte:
    [[Axioma]]              -> <a class="wikilink" href="...">Axioma</a>
    [[Axioma|Continente]]   -> <a class="wikilink" href="...">Continente</a>
    [[NoExiste]]            -> <a class="wikilink wikilink--missing" href="#">NoExiste</a>

  Por qué custom: probé @portaljs/remark-wiki-link y rompía la renderización
  del body markdown completo en Astro 6.
*/
import { visit, SKIP } from 'unist-util-visit';

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

/**
 * @param {object} options
 * @param {Map<string, string>} options.hrefMap   slug -> href
 * @param {string} [options.aliasDivider='|']
 */
export default function remarkWikilinks({ hrefMap, aliasDivider = '|' }) {
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
        const href = hrefMap.get(slug);
        const isMissing = !href;

        if (match.index > lastIdx) {
          replacements.push({
            type: 'text',
            value: node.value.slice(lastIdx, match.index),
          });
        }

        replacements.push({
          type: 'link',
          url: href ?? '#',
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
