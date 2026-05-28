export const KEY_API = 'tinymd.cdn.key';

export function loadApiKey(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(KEY_API) || '';
}

export function saveApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  if (key) window.localStorage.setItem(KEY_API, key);
  else window.localStorage.removeItem(KEY_API);
}
