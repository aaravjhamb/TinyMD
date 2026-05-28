import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { escapeHTML } from './utils';

let configured = false;
function configure() {
  if (configured) return;
  marked.setOptions({ gfm: true, breaks: true });
  configured = true;
}

function preprocessComponentBlocks(src: string): string {
  return src.replace(/^:::component\s*\n([\s\S]*?)^:::\s*$/gm, (_m, body: string) => {
    const fields = body
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const i = line.indexOf(':');
        if (i < 0) return null;
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
      })
      .filter(Boolean) as [string, string][];
    if (!fields.length) return '';
    const inner = fields
      .map(([k, v]) => `<dt>${escapeHTML(k)}</dt><dd>${escapeHTML(v)}</dd>`)
      .join('');
    return `<dl class="component-card">${inner}</dl>`;
  });
}

export function renderMarkdown(src: string): string {
  if (typeof window === 'undefined') return '';
  configure();
  const html = marked.parse(preprocessComponentBlocks(src)) as string;
  return DOMPurify.sanitize(html, { ADD_TAGS: ['dl', 'dt', 'dd'], ADD_ATTR: ['class'] });
}
