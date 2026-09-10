import { renderMarkdown } from './markdown';
import { escapeHTML } from './utils';
import type { Entry, Project } from './types';

// Page presets, in millimetres. `@page { size }` takes the literal dimensions,
// so the aspect ratio the user picks is the shape of every page in the PDF.
export type PageSizeId = 'a4' | 'letter' | 'square' | 'a4-landscape' | 'slide' | 'slide-4-3';

export type PageSize = {
  id: PageSizeId;
  label: string;
  note: string;
  width: number;
  height: number;
};

export const PAGE_SIZES: PageSize[] = [
  { id: 'a4',           label: 'A4',        note: 'Portrait · 210 × 297 mm',  width: 210,   height: 297 },
  { id: 'letter',       label: 'US Letter', note: 'Portrait · 8.5 × 11 in',   width: 215.9, height: 279.4 },
  { id: 'square',       label: 'Square',    note: '1:1 · 210 × 210 mm',       width: 210,   height: 210 },
  { id: 'a4-landscape', label: 'A4 wide',   note: 'Landscape · 297 × 210 mm', width: 297,   height: 210 },
  { id: 'slide',        label: '16:9',      note: 'Slides · 13.3 × 7.5 in',   width: 338.7, height: 190.5 },
  { id: 'slide-4-3',    label: '4:3',       note: 'Slides · 10 × 7.5 in',     width: 254,   height: 190.5 },
];

export function pageSizeById(id: PageSizeId): PageSize {
  return PAGE_SIZES.find((p) => p.id === id) || PAGE_SIZES[0];
}

export type PdfOptions = {
  size: PageSizeId;
  coverPage: boolean;
  entryTitles: boolean;
  pageBreaks: boolean;
};

const ACCENTS: Record<string, string> = {
  red: '#ec3750', orange: '#ff8c37', yellow: '#f1c40f', green: '#33d6a6',
  cyan: '#5bc0de', blue: '#338eda', purple: '#a633d6',
};

function longDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

// Print styles are deliberately light-on-white — the app's dark theme is
// unreadable on paper and drinks ink. Layout mirrors `.preview` otherwise.
function printCss(size: PageSize, opts: PdfOptions): string {
  const margin = size.height < 220 ? 12 : 16; // wide/short pages need slimmer margins
  const contentW = size.width - margin * 2;
  // An image's own border and vertical margins sit inside the page too, so the
  // tallest it can be and still land on one page is a little under the content
  // height. Give it back everything beyond that — the printer slices anything
  // taller, which looks far worse than a slightly smaller photo.
  const contentH = size.height - margin * 2;
  const imgMaxH = Math.round(contentH - 8);
  // Landscape and slide pages are far wider than a comfortable line length, and
  // a column that wide also makes photos look tiny next to it. Cap the measure
  // like the on-screen preview does (720px) and centre it.
  const measure = Math.min(contentW, 190);
  return `
@font-face {
  font-family: 'Phantom Sans';
  src: url('https://assets.hackclub.com/fonts/Phantom_Sans_0.8/Regular.woff2') format('woff2');
  font-weight: 400; font-style: normal; font-display: block;
}
@font-face {
  font-family: 'Phantom Sans';
  src: url('https://assets.hackclub.com/fonts/Phantom_Sans_0.8/Italic.woff2') format('woff2');
  font-weight: 400; font-style: italic; font-display: block;
}
@font-face {
  font-family: 'Phantom Sans';
  src: url('https://assets.hackclub.com/fonts/Phantom_Sans_0.8/Bold.woff2') format('woff2');
  font-weight: 700; font-style: normal; font-display: block;
}

@page {
  size: ${size.width}mm ${size.height}mm;
  margin: ${margin}mm;
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body {
  font-family: 'Phantom Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #16181d;
  font-size: 10.5pt;
  line-height: 1.6;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* Cover --------------------------------------------------------- */
.pdf-cover {
  ${opts.pageBreaks ? 'break-after: page;' : 'margin-bottom: 22mm;'}
  padding-top: 6mm;
}
.pdf-cover-image {
  width: 100%;
  max-height: ${Math.round(size.height * 0.34)}mm;
  object-fit: cover;
  border-radius: 3mm;
  margin-bottom: 8mm;
}
.pdf-cover-rule { height: 3px; width: 22mm; background: var(--accent); border-radius: 2px; }
.pdf-cover-title {
  font-size: ${size.height < 220 ? '26pt' : '30pt'};
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
  margin: 5mm 0 3mm;
}
.pdf-cover-sub { font-size: 11pt; color: #5c636e; margin: 0; }
.pdf-cover-meta { font-size: 9pt; color: #868d97; margin-top: 1.5mm; }
.pdf-toc { margin-top: 10mm; }
.pdf-toc-head {
  font-size: 8pt; text-transform: uppercase; letter-spacing: 0.12em;
  color: #868d97; margin-bottom: 3mm;
}
.pdf-toc ol { margin: 0; padding-left: 5mm; font-size: 10pt; }
.pdf-toc li { margin-bottom: 1.5mm; }
.pdf-toc .kind { color: #868d97; font-size: 8.5pt; }

/* Entries ------------------------------------------------------- */
.pdf-entry {
  ${opts.pageBreaks ? 'break-before: page;' : 'margin-top: 12mm;'}
  max-width: ${measure}mm;
  margin-left: auto;
  margin-right: auto;
}
.pdf-entry:first-of-type { break-before: auto; margin-top: 0; }
.pdf-entry-head {
  border-bottom: 1px solid #e3e6ea;
  padding-bottom: 2.5mm;
  margin-bottom: 5mm;
  break-after: avoid;
}
.pdf-entry-title {
  font-size: 16pt; font-weight: 700; letter-spacing: -0.015em;
  margin: 0; line-height: 1.25;
}
.pdf-entry-date { font-size: 8.5pt; color: #868d97; margin-top: 1mm; }
.pdf-entry-date .kind {
  display: inline-block; margin-left: 2mm; padding: 0 1.6mm;
  border: 1px solid var(--accent); border-radius: 999px;
  color: var(--accent); font-size: 7pt; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase;
}
.pdf-divider { border: 0; height: 1px; background: #e3e6ea; margin: 10mm 0; }

/* Markdown body ------------------------------------------------- */
.pdf-body { overflow-wrap: break-word; }
.pdf-body h1, .pdf-body h2, .pdf-body h3, .pdf-body h4 {
  font-weight: 700; letter-spacing: -0.015em; line-height: 1.25;
  margin: 1.2em 0 0.35em; break-after: avoid;
}
.pdf-body h1 { font-size: 15pt; }
.pdf-body h2 { font-size: 13pt; border-bottom: 1px solid #e3e6ea; padding-bottom: 0.2em; }
.pdf-body h3 { font-size: 11.5pt; }
.pdf-body h4 { font-size: 10.5pt; color: #5c636e; }
.pdf-body p { margin: 0.7em 0; }
.pdf-body a { color: var(--accent); text-decoration: underline; }
.pdf-body img {
  width: auto;
  height: auto;          /* never let width/height attrs squash the ratio */
  max-width: 100%;
  max-height: ${imgMaxH}mm;
  border: 1px solid #e3e6ea;
  border-radius: 2mm;
  margin: 0.5em 0;
  break-inside: avoid;
}
.pdf-body code:not(pre code) {
  font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  background: #f4f5f7; border: 1px solid #e3e6ea; border-radius: 3px;
  padding: 0.05em 0.3em; font-size: 0.88em; color: #a8243a;
}
.pdf-body pre {
  background: #f7f8fa; border: 1px solid #e3e6ea; border-radius: 2mm;
  padding: 3mm 4mm; margin: 0.8em 0;
  font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 8.5pt; line-height: 1.5;
  white-space: pre-wrap;   /* paper cannot scroll horizontally */
  word-break: break-word;
  break-inside: avoid;
}
.pdf-body pre code { background: none; border: 0; padding: 0; color: inherit; font-size: inherit; }
.pdf-body blockquote {
  margin: 0.9em 0; padding: 0.2em 0 0.2em 3mm;
  border-left: 2px solid var(--accent); color: #5c636e; font-style: italic;
}
.pdf-body hr { border: 0; height: 1px; background: #e3e6ea; margin: 1.6em 0; }
.pdf-body table {
  width: 100%; border-collapse: collapse; font-size: 9pt; margin: 0.9em 0;
}
.pdf-body th, .pdf-body td {
  border: 1px solid #d8dce2; padding: 1.6mm 2.2mm; text-align: left;
  vertical-align: top;
}
.pdf-body th { background: #f4f5f7; font-weight: 700; }
.pdf-body thead { display: table-header-group; }  /* repeat header across pages */
.pdf-body tr { break-inside: avoid; }
.pdf-body ul, .pdf-body ol { padding-left: 5mm; margin: 0.7em 0; }
.pdf-body li { margin-bottom: 0.2em; }
.pdf-body input[type="checkbox"] { margin-right: 1.5mm; }
.pdf-body .component-card {
  display: grid; grid-template-columns: 28mm 1fr; gap: 1mm 4mm;
  background: #f7f8fa; border: 1px solid #e3e6ea; border-radius: 2mm;
  padding: 3mm 4mm; margin: 0.9em 0; font-size: 9.5pt;
  break-inside: avoid;
}
.pdf-body .component-card dt {
  color: #868d97; text-transform: uppercase; font-size: 7.5pt; letter-spacing: 0.1em;
}
.pdf-body .component-card dd { margin: 0; }
`;
}

// Same short labels the sidebar uses for the entry tags.
const KIND_LABEL: Record<string, string> = { readme: 'README', bom: 'BOM' };

// The badge is only worth showing when it adds something the title does not —
// a README titled "README" needs no badge.
function kindBadge(entry: Entry): string {
  const label = KIND_LABEL[entry.kind];
  if (!label) return '';
  return (entry.title || '').trim().toLowerCase() === label.toLowerCase() ? '' : label;
}

function buildDocument(project: Project, entries: Entry[], opts: PdfOptions): string {
  const size = pageSizeById(opts.size);
  const accent = ACCENTS[project.color] || '#a8243a';
  const count = entries.length;

  const cover = opts.coverPage
    ? `<section class="pdf-cover">
${project.cover_image ? `<img class="pdf-cover-image" src="${escapeHTML(project.cover_image)}" alt="" />` : ''}
  <div class="pdf-cover-rule"></div>
  <h1 class="pdf-cover-title">${escapeHTML(project.name || 'Untitled project')}</h1>
  <p class="pdf-cover-sub">Build journal · ${count} ${count === 1 ? 'entry' : 'entries'}</p>
  <div class="pdf-cover-meta">Exported ${escapeHTML(longDate(new Date().toISOString()))} from TinyMD</div>
${count ? `  <nav class="pdf-toc">
    <div class="pdf-toc-head">Contents</div>
    <ol>
${entries.map((e) => {
        const badge = kindBadge(e);
        return `      <li>${escapeHTML(e.title || 'Untitled')}${badge ? ` <span class="kind">· ${badge}</span>` : ''}</li>`;
      }).join('\n')}
    </ol>
  </nav>` : ''}
</section>`
    : '';

  const body = entries
    .map((entry, i) => {
      const badge = kindBadge(entry);
      const head = opts.entryTitles
        ? `  <header class="pdf-entry-head">
    <h2 class="pdf-entry-title">${escapeHTML(entry.title || 'Untitled')}</h2>
    <div class="pdf-entry-date">${escapeHTML(longDate(entry.created_at))}${badge ? `<span class="kind">${escapeHTML(badge)}</span>` : ''}</div>
  </header>`
        : '';
      // Without page breaks the entries run together, so keep a visible rule.
      const rule = !opts.pageBreaks && i > 0 ? '<hr class="pdf-divider" />' : '';
      return `${rule}<article class="pdf-entry">
${head}
  <div class="pdf-body">${renderMarkdown(entry.body || '')}</div>
</article>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHTML(project.name || 'project')}</title>
<style>:root { --accent: ${accent}; }
${printCss(size, opts)}</style>
</head>
<body>
${cover}
${body}
</body>
</html>`;
}

function waitForAssets(win: Window, doc: Document, timeoutMs = 10000): Promise<void> {
  const images = Array.from(doc.images).map(
    (img) =>
      new Promise<void>((resolve) => {
        if (img.complete) return resolve();
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      })
  );
  const fonts = (doc as any).fonts?.ready ? [(doc as any).fonts.ready] : [];
  const ready = Promise.all([...images, ...fonts]).then(() => undefined);
  // A dead CDN image must not wedge the export — print what we have instead.
  const timeout = new Promise<void>((resolve) => win.setTimeout(resolve, timeoutMs));
  return Promise.race([ready, timeout]);
}

/**
 * Renders every entry into one printable document and opens the browser's
 * print dialog, where the user saves it as a single PDF. Printing is used
 * rather than a canvas rasteriser so text stays selectable and CDN images
 * are embedded at full resolution without CORS trouble.
 */
export async function exportEntriesToPdf(
  project: Project,
  entries: Entry[],
  opts: PdfOptions
): Promise<void> {
  const size = pageSizeById(opts.size);
  const html = buildDocument(project, entries, opts);

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.title = 'PDF export';
  // Offscreen but at real page width, so layout matches the printed page.
  frame.style.cssText =
    `position:fixed;left:-20000px;top:0;width:${size.width}mm;height:${size.height}mm;border:0;visibility:hidden;`;
  document.body.appendChild(frame);

  const cleanup = () => {
    if (frame.parentNode) frame.parentNode.removeChild(frame);
  };

  try {
    await new Promise<void>((resolve, reject) => {
      frame.addEventListener('load', () => resolve(), { once: true });
      frame.addEventListener('error', () => reject(new Error('Could not build the PDF document')), { once: true });
      frame.srcdoc = html;
    });

    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    if (!win || !doc) throw new Error('Could not build the PDF document');

    await waitForAssets(win, doc);

    // Removing the frame while the dialog is open cancels the print in some
    // browsers, so wait for afterprint (with a fallback for those that never
    // fire it).
    const done = new Promise<void>((resolve) => {
      win.addEventListener('afterprint', () => resolve(), { once: true });
      window.setTimeout(resolve, 60000);
    });

    win.focus();
    win.print();
    await done;
  } finally {
    // Give the browser a tick to finish spooling before tearing the frame down.
    window.setTimeout(cleanup, 1000);
  }
}
