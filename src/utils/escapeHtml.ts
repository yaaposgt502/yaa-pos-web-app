// Escapes text before it is inserted into HTML built as a string (print
// windows use document.write). Product, client and store names are typed by
// users, so they must never be interpreted as markup or scripts.
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
