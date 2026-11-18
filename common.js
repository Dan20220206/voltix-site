// Funções compartilhadas entre as páginas.

export async function loadSite() {
  const res = await fetch('/api/site', { cache: 'no-store' });
  if (!res.ok) throw new Error('Não foi possível carregar as informações do site.');
  return res.json();
}

export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return iso || '—';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ de /g, ' ').replace('.', '');
}

export function fileName(url) {
  try { return decodeURIComponent(new URL(url, location.href).pathname.split('/').pop() || ''); }
  catch { return ''; }
}

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v; // use só com conteúdo do próprio site
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) node.append(c);
  return node;
}

export function setText(selector, value) {
  document.querySelectorAll(selector).forEach((n) => { n.textContent = value; });
}

export function initChrome(data) {
  if (data?.ads?.testMode) document.querySelectorAll('[data-test-badge]').forEach((b) => { b.hidden = false; });
  setText('[data-year]', String(new Date().getFullYear()));
}
