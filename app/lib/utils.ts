export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function escapeHTML(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c] as string));
}

export function escapeAlt(s: string): string {
  return s.replace(/[\[\]]/g, '');
}

export function formatBytes(n: number): string {
  if (n < 1024) return n + ' B';
  const u = ['KB', 'MB', 'GB', 'TB'];
  let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  return n.toFixed(n < 10 ? 1 : 0) + ' ' + u[i];
}

export function relTime(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return d.toLocaleDateString();
}

export function getCaretCoords(el: HTMLTextAreaElement, pos: number) {
  const div = document.createElement('div');
  const style = getComputedStyle(el);
  const props = [
    'boxSizing','width','height','overflow','borderTopWidth','borderRightWidth',
    'borderBottomWidth','borderLeftWidth','paddingTop','paddingRight','paddingBottom',
    'paddingLeft','fontStyle','fontVariant','fontWeight','fontStretch','fontSize',
    'fontSizeAdjust','lineHeight','fontFamily','textAlign','textTransform','textIndent',
    'textDecoration','letterSpacing','wordSpacing','tabSize','MozTabSize'
  ];
  props.forEach((p) => { (div.style as any)[p] = (style as any)[p]; });
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';
  div.style.top = '0';
  div.style.left = '0';
  div.textContent = el.value.substring(0, pos);
  const span = document.createElement('span');
  span.textContent = el.value.substring(pos) || '.';
  div.appendChild(span);
  el.parentElement!.appendChild(div);
  const divRect = div.getBoundingClientRect();
  const spanRect = span.getBoundingClientRect();
  const coords = {
    left: (spanRect.left - divRect.left) + el.offsetLeft,
    top:  (spanRect.top  - divRect.top)  + el.offsetTop,
    height: spanRect.height || parseFloat(style.lineHeight) || 18,
  };
  el.parentElement!.removeChild(div);
  return coords;
}
